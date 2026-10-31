from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import (
    Application, ApplicationStatusHistory, HiringDecision,
    HrDecisionHistory, User, OrganizationMembership
)
from app.schemas.schemas import (
    HiringDecisionCreate, HiringDecisionOut, DecisionActionRequest,
    HrDecisionHistoryPageOut, HrDecisionSummaryOut, HrDecisionHistoryOut
)
from app.services.decision_service import (
    record_hr_decision_workflow,
    get_hr_decision_history_paginated,
    get_hr_decision_summary_counts
)

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
    history_rec, legacy_rec = record_hr_decision_workflow(
        db=db,
        hr_user=hr_user,
        membership=membership,
        application_id=decision_in.application_id,
        raw_decision=decision_in.decision,
        notes=decision_in.rationale
    )
    return legacy_rec

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
    history_rec, legacy_rec = record_hr_decision_workflow(
        db=db,
        hr_user=hr_user,
        membership=membership,
        application_id=application_id,
        raw_decision="accepted",
        notes=action_in.notes
    )
    return legacy_rec

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
    history_rec, legacy_rec = record_hr_decision_workflow(
        db=db,
        hr_user=hr_user,
        membership=membership,
        application_id=application_id,
        raw_decision="rejected",
        notes=action_in.notes
    )
    return legacy_rec

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
    """HR reviews past confirmed hiring decisions (backward-compatible)."""
    decisions = (
        db.query(HiringDecision)
        .join(Application, HiringDecision.application_id == Application.id)
        .filter(Application.job.has(organization_id=membership.organization_id))
        .order_by(HiringDecision.decided_at.desc())
        .all()
    )
    return decisions
