from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import Application, ApplicationStatusHistory, HiringDecision, User, OrganizationMembership
from app.schemas.schemas import HiringDecisionCreate, HiringDecisionOut, DecisionActionRequest
from app.services.notification_service import create_notification, record_audit_log

router = APIRouter(prefix="/decisions", tags=["Hiring Decisions"])

@router.post("", response_model=HiringDecisionOut, status_code=status.HTTP_201_CREATED)
def record_final_hiring_decision(
    decision_in: HiringDecisionCreate,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    CRITICAL RULE: AI NEVER makes final hiring decisions.
    Only authorized HR recruiters can confirm candidate selection or rejection.
    Saves immutable rationale and updates application state transactionally.
    """
    app = db.query(Application).filter(Application.id == decision_in.application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    
    # Check tenant isolation
    if app.job.organization_id != membership.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: application belongs to another organization")

    decision_key = decision_in.decision.lower()
    if decision_key == "accepted":
        if app.status in ["accepted", "selected"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidate application has already been accepted.")
        target_status = "accepted"
        decision_val = "accepted"
    elif decision_key == "selected":
        if app.status in ["accepted", "selected"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidate application has already been accepted.")
        target_status = "selected"
        decision_val = "selected"
    elif decision_key == "rejected":
        if app.status == "rejected":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidate application has already been rejected.")
        target_status = "rejected"
        decision_val = "rejected"
    else:
        target_status = "hr_review"
        decision_val = "on_hold"

    prev_status = app.status

    existing_decision = db.query(HiringDecision).filter(HiringDecision.application_id == app.id).first()
    if existing_decision:
        existing_decision.decision = decision_val
        existing_decision.rationale = decision_in.rationale
        existing_decision.recruiter_id = hr_user.id
        decision_record = existing_decision
    else:
        decision_record = HiringDecision(
            application_id=app.id,
            job_id=app.job_id,
            recruiter_id=hr_user.id,
            decision=decision_val,
            rationale=decision_in.rationale
        )
        db.add(decision_record)

    app.status = target_status

    # Record in application status history
    hist = ApplicationStatusHistory(
        application_id=app.id,
        previous_status=prev_status,
        new_status=target_status,
        changed_by_id=hr_user.id,
        note=f"Final human decision recorded by {hr_user.full_name}: {decision_val.upper()}. Notes: {decision_in.rationale}"
    )
    db.add(hist)
    db.commit()
    db.refresh(decision_record)

    # Candidate notification
    if decision_val in ["accepted", "selected"]:
        title = f"Application Accepted: {app.job.title}"
        msg = f"Congratulations! Your application for {app.job.title} has been officially accepted by our hiring team."
    elif decision_val == "rejected":
        title = f"Application Update: {app.job.title}"
        msg = f"Thank you for interviewing for {app.job.title}. Our team has decided to proceed with other candidates at this time."
    else:
        title = f"Application Under Review: {app.job.title}"
        msg = f"Your application for {app.job.title} is currently under secondary recruiter review."

    create_notification(
        db=db,
        user_id=app.candidate_id,
        title=title,
        message=msg,
        notification_type="decision",
        link=f"/candidate/applications/{app.id}"
    )

    # Audit event
    record_audit_log(
        db=db,
        organization_id=membership.organization_id,
        actor_id=hr_user.id,
        actor_role="hr",
        action="FINAL_HIRING_DECISION",
        resource_type="hiring_decision",
        resource_id=decision_record.id,
        details_json={
            "candidate_id": app.candidate_id,
            "decision": decision_val,
            "rationale": decision_in.rationale,
            "previous_status": prev_status,
            "new_status": target_status
        }
    )

    return decision_record

@router.post("/applications/{application_id}/accept", response_model=HiringDecisionOut)
def accept_candidate_application(
    application_id: str,
    action_in: DecisionActionRequest,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Accepts candidate for the job opening. Updates status to ACCEPTED and records audit trail.
    """
    decision_payload = HiringDecisionCreate(
        application_id=application_id,
        decision="accepted",
        rationale=action_in.notes
    )
    return record_final_hiring_decision(
        decision_in=decision_payload,
        hr_user=hr_user,
        membership=membership,
        db=db
    )

@router.post("/applications/{application_id}/reject", response_model=HiringDecisionOut)
def reject_candidate_application(
    application_id: str,
    action_in: DecisionActionRequest,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Rejects candidate application with mandatory HR rejection notes. Updates status to REJECTED.
    """
    decision_payload = HiringDecisionCreate(
        application_id=application_id,
        decision="rejected",
        rationale=action_in.notes
    )
    return record_final_hiring_decision(
        decision_in=decision_payload,
        hr_user=hr_user,
        membership=membership,
        db=db
    )

@router.get("/applications/{application_id}/decision-history", response_model=List[Dict[str, Any]])
def get_application_decision_history(
    application_id: str,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Retrieves full chronological status and decision audit history for an application.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    if app.job.organization_id != membership.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    history = (
        db.query(ApplicationStatusHistory)
        .filter(ApplicationStatusHistory.application_id == application_id)
        .order_by(ApplicationStatusHistory.created_at.desc())
        .all()
    )

    return [
        {
            "id": h.id,
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "changed_by": h.changed_by.full_name if h.changed_by else "System",
            "note": h.note,
            "timestamp": h.created_at
        }
        for h in history
    ]

@router.get("", response_model=List[HiringDecisionOut])
def list_organization_decisions(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """HR reviews past confirmed hiring decisions."""
    decisions = (
        db.query(HiringDecision)
        .join(Application, HiringDecision.application_id == Application.id)
        .filter(Application.job.has(organization_id=membership.organization_id))
        .order_by(HiringDecision.decided_at.desc())
        .all()
    )
    return decisions

