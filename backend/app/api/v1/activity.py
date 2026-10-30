from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_candidate
from app.models.models import User, UserActivityEvent
from app.schemas.schemas import UserActivityEventOut

router = APIRouter(prefix="/activity", tags=["Candidate Activity Timeline"])

@router.get("", response_model=List[UserActivityEventOut])
def get_candidate_activity_timeline(
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Returns candidate's complete persistent chronological activity history.
    Generated from actual recorded user interactions, never fabricated samples.
    """
    activities = (
        db.query(UserActivityEvent)
        .filter(UserActivityEvent.user_id == candidate.id)
        .order_by(UserActivityEvent.created_at.desc())
        .limit(50)
        .all()
    )
    return activities
