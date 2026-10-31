from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import (
    User, HrDecisionHistory, OrganizationMembership, Application, Job, InterviewSession
)
from app.schemas.schemas import (
    HrDecisionHistoryPageOut, HrDecisionSummaryOut, HrDecisionHistoryOut
)
from app.services.decision_service import (
    get_hr_decision_history_paginated,
    get_hr_decision_summary_counts,
    export_hr_decisions_csv
)
from app.services.ranking_service import calculate_composite_rank_score

router = APIRouter(prefix="/hr/decisions", tags=["HR Confirmed Hiring Decisions"])

@router.get("", response_model=HrDecisionHistoryPageOut)
def list_hr_decisions(
    decision_type: Optional[str] = Query(None, description="ACCEPTED, REJECTED, or all"),
    candidate_search: Optional[str] = Query(None, description="Search by candidate name or email"),
    job_title_search: Optional[str] = Query(None, description="Search by job title or department"),
    reviewer_id: Optional[str] = Query(None, description="Filter by HR reviewer user ID"),
    start_date: Optional[datetime] = Query(None, description="Filter decisions after this timestamp"),
    end_date: Optional[datetime] = Query(None, description="Filter decisions before this timestamp"),
    sort_order: str = Query("desc", description="'desc' for newest first, 'asc' for oldest first"),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Retrieves full chronological hiring decision history for authorized HR organization.
    Supports multi-criteria filtering, search, date range, and pagination.
    """
    return get_hr_decision_history_paginated(
        db=db,
        organization_id=membership.organization_id,
        decision_type=decision_type,
        candidate_search=candidate_search,
        job_title_search=job_title_search,
        reviewer_id=reviewer_id,
        start_date=start_date,
        end_date=end_date,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )

@router.get("/summary", response_model=HrDecisionSummaryOut)
def get_hr_decisions_summary(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Provides top-level metrics for HR decision audit dashboard:
    Total Decisions, Total Accepted, Total Rejected, Decisions this month.
    """
    return get_hr_decision_summary_counts(
        db=db,
        organization_id=membership.organization_id
    )

@router.get("/reviewers")
def list_hr_reviewers(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Lists distinct HR reviewers who have recorded decisions in this organization.
    """
    reviewers = (
        db.query(User)
        .join(HrDecisionHistory, HrDecisionHistory.reviewer_id == User.id)
        .filter(HrDecisionHistory.organization_id == membership.organization_id)
        .distinct()
        .all()
    )
    return [
        {"id": u.id, "name": u.full_name, "email": u.email}
        for u in reviewers
    ]

@router.get("/export")
def export_decisions_csv(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Exports decision audit trail as CSV for compliance and record-keeping.
    """
    csv_content = export_hr_decisions_csv(
        db=db,
        organization_id=membership.organization_id
    )
    filename = f"hiring_decisions_{membership.organization_id[:8]}_{datetime.now().strftime('%Y%m%d')}.csv"
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{decision_id}", response_model=HrDecisionHistoryOut)
def get_hr_decision_detail(
    decision_id: str,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Inspects granular decision audit record with associated application and scores.
    """
    record = (
        db.query(HrDecisionHistory)
        .filter(
            HrDecisionHistory.id == decision_id,
            HrDecisionHistory.organization_id == membership.organization_id
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hiring decision record not found"
        )

    app = record.application
    job = record.job
    cand = record.candidate
    rev = record.reviewer

    resume_match = app.resume_match_score if app else 0.0
    session = db.query(InterviewSession).filter(InterviewSession.application_id == record.application_id).first()
    report = session.report if session else None
    int_score = report.overall_score if report else None

    overall_fit = calculate_composite_rank_score(
        resume_match=resume_match,
        interview_score=int_score or 0.0,
        required_skills=app.skills_match_score if app else 0.0
    ) if app else 0.0

    return {
        "id": record.id,
        "organization_id": record.organization_id,
        "application_id": record.application_id,
        "candidate_id": record.candidate_id,
        "job_id": record.job_id,
        "reviewer_id": record.reviewer_id,
        "decision": record.decision,
        "decision_notes": record.decision_notes,
        "previous_status": record.previous_status,
        "new_status": record.new_status,
        "decided_at": record.decided_at,
        "created_at": record.created_at,
        "candidate_name": cand.full_name if cand else "Unknown Candidate",
        "candidate_email": cand.email if cand else "",
        "candidate_alias": f"Candidate-{record.candidate_id[:6].upper()}",
        "job_title": job.title if job else "Unknown Position",
        "job_department": job.department if job else "General",
        "reviewer_name": rev.full_name if rev else "Historical / System Record",
        "reviewer_email": rev.email if rev else "",
        "resume_match_score": round(resume_match, 1),
        "interview_score": round(int_score, 1) if int_score is not None else None,
        "overall_fit_score": round(overall_fit, 1)
    }
