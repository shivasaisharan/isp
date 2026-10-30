from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import Application, ApplicationStatusHistory, HiringDecision, User, OrganizationMembership
from app.schemas.schemas import HiringDecisionCreate, HiringDecisionOut
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

    prev_status = app.status
    target_status = "selected" if decision_in.decision == "selected" else ("rejected" if decision_in.decision == "rejected" else "hr_review")

    existing_decision = db.query(HiringDecision).filter(HiringDecision.application_id == app.id).first()
    if existing_decision:
        existing_decision.decision = decision_in.decision
        existing_decision.rationale = decision_in.rationale
        existing_decision.recruiter_id = hr_user.id
        decision_record = existing_decision
    else:
        decision_record = HiringDecision(
            application_id=app.id,
            job_id=app.job_id,
            recruiter_id=hr_user.id,
            decision=decision_in.decision,
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
        note=f"Final human decision recorded by {hr_user.full_name}: {decision_in.decision.upper()}. Rationale: {decision_in.rationale}"
    )
    db.add(hist)
    db.commit()
    db.refresh(decision_record)

    # Candidate notification
    status_text = "Selected for Offer" if decision_in.decision == "selected" else ("Status Updated" if decision_in.decision == "rejected" else "Under Further Review")
    create_notification(
        db=db,
        user_id=app.candidate_id,
        title=f"Application Outcome: {app.job.title}",
        message=f"An official HR update has been recorded for your application: {status_text}.",
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
            "decision": decision_in.decision,
            "rationale": decision_in.rationale
        }
    )

    return decision_record

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
