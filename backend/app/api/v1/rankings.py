from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import Job, User, OrganizationMembership
from app.schemas.schemas import TopCandidateRecommendation
from app.services.ranking_service import get_job_top_five_recommendations

router = APIRouter(prefix="/rankings", tags=["Candidate Ranking & Recommendations"])

@router.get("/job/{job_id}/top-candidates", response_model=List[TopCandidateRecommendation])
def get_top_five_candidates(
    job_id: str,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Returns AI-recommended Top 5 candidates for an HR job opening.
    Job-specific, strictly database backed, explainable weights (30% resume, 50% interview, 20% skills).
    If fewer than 5 eligible applicants exist, returns available pool without inventing records.
    """
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.organization_id == membership.organization_id
    ).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found or access denied")

    top_candidates = get_job_top_five_recommendations(db, job.id)
    return top_candidates
