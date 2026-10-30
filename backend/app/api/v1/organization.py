from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import Organization, OrganizationMembership, User

router = APIRouter(prefix="/organization", tags=["Organization & Tenancy"])

@router.get("/details")
def get_organization_details(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    org = membership.organization
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "logo_url": org.logo_url,
        "website": org.website,
        "plan": org.plan,
        "active_jobs_limit": org.active_jobs_limit,
        "monthly_interview_allowance": org.monthly_interview_allowance,
        "created_at": org.created_at,
        "your_role": membership.role
    }

@router.get("/team")
def get_organization_team(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    members = (
        db.query(OrganizationMembership)
        .filter(OrganizationMembership.organization_id == membership.organization_id)
        .all()
    )
    return [
        {
            "id": m.id,
            "user_id": m.user.id,
            "full_name": m.user.full_name,
            "email": m.user.email,
            "role": m.role,
            "joined_at": m.created_at
        }
        for m in members
    ]
