from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_candidate
from app.models.models import User, UserActivityEvent, CandidateRecruitmentActivity
from app.schemas.schemas import (
    UserActivityEventOut,
    CandidateRecruitmentActivityOut,
    CandidateRecruitmentActivityPageOut,
    CandidateActivitySummaryOut
)
from app.services.activity_service import (
    get_candidate_recruitment_activities_paginated,
    get_candidate_activity_summary_metrics
)

router = APIRouter(prefix="/activity", tags=["Candidate Activity Timeline"])
candidate_activities_router = APIRouter(prefix="/candidate/activities", tags=["Candidate Recruitment Activities"])

EXCLUDED_EVENT_TYPES = [
    "login", "logout", "session_created", "session_expired",
    "token_refreshed", "page_visit", "dashboard_opened",
    "navigation_event", "browser_focus"
]

@router.get("", response_model=List[UserActivityEventOut])
def get_candidate_activity_timeline(
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Returns candidate's persistent chronological recruitment activity history.
    Excludes repeated login, logout, and system noise.
    """
    activities = (
        db.query(UserActivityEvent)
        .filter(
            UserActivityEvent.user_id == candidate.id,
            ~UserActivityEvent.event_type.in_(EXCLUDED_EVENT_TYPES)
        )
        .order_by(UserActivityEvent.created_at.desc())
        .limit(100)
        .all()
    )
    return activities

@router.get("/summary", response_model=CandidateActivitySummaryOut)
@candidate_activities_router.get("/summary", response_model=CandidateActivitySummaryOut)
def get_activity_summary_counts(
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Summary metrics for candidate dashboard:
    Total Resumes, Jobs Applied, Interviews Completed, Applications Accepted.
    Zero auth/session events counted.
    """
    return get_candidate_activity_summary_metrics(db, candidate.id)

@router.get("/recruitment", response_model=CandidateRecruitmentActivityPageOut)
@candidate_activities_router.get("", response_model=CandidateRecruitmentActivityPageOut)
def get_candidate_recruitment_activities(
    category: Optional[str] = Query(None, description="resume, application, interview, decision"),
    activity_type: Optional[str] = Query(None, description="Specific activity type"),
    company_name: Optional[str] = Query(None, description="Search by company name"),
    job_title: Optional[str] = Query(None, description="Search by job title"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    sort_order: str = Query("desc", description="'desc' for newest first, 'asc' for oldest first"),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Official Candidate Recruitment Activity Timeline.
    Contains verified milestones: resume events, job submissions, interviews, and decisions.
    """
    return get_candidate_recruitment_activities_paginated(
        db=db,
        candidate_id=candidate.id,
        category=category,
        activity_type=activity_type,
        company_name=company_name,
        job_title=job_title,
        start_date=start_date,
        end_date=end_date,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )
