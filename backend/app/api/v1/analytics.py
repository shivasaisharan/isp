from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import Job, Application, InterviewSession, HiringDecision, AuditEvent, User, OrganizationMembership

router = APIRouter(prefix="/analytics", tags=["HR Analytics & Compliance"])

@router.get("/metrics")
def get_hr_analytics_overview(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    org_id = membership.organization_id

    total_jobs = db.query(Job).filter(Job.organization_id == org_id).count()
    active_jobs = db.query(Job).filter(Job.organization_id == org_id, Job.status == "published").count()
    
    apps_query = db.query(Application).join(Job, Application.job_id == Job.id).filter(Job.organization_id == org_id)
    total_applications = apps_query.count()
    
    under_review = apps_query.filter(Application.status.in_(["submitted", "under_review"])).count()
    interviews_completed = apps_query.filter(Application.status.in_(["interview_completed", "hr_review"])).count()
    selected_count = apps_query.filter(Application.status == "selected").count()
    rejected_count = apps_query.filter(Application.status == "rejected").count()

    # Average match score
    all_apps = apps_query.all()
    avg_match = round(sum(a.resume_match_score for a in all_apps) / len(all_apps), 1) if all_apps else 0.0

    return {
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "total_applications": total_applications,
        "awaiting_review": under_review,
        "interviews_completed": interviews_completed,
        "selected_candidates": selected_count,
        "rejected_candidates": rejected_count,
        "average_resume_match": avg_match,
        "pipeline_stages": [
            {"stage": "Submitted", "count": apps_query.filter(Application.status == "submitted").count()},
            {"stage": "Under Review", "count": apps_query.filter(Application.status == "under_review").count()},
            {"stage": "Interview Pending", "count": apps_query.filter(Application.status == "interview_pending").count()},
            {"stage": "Interview Completed", "count": interviews_completed},
            {"stage": "HR Final Review", "count": apps_query.filter(Application.status == "hr_review").count()},
            {"stage": "Selected", "count": selected_count},
            {"stage": "Rejected", "count": rejected_count}
        ]
    }

@router.get("/audit-logs")
def get_compliance_audit_trail(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """Immutable audit trail for responsible AI governance and hiring oversight."""
    audits = (
        db.query(AuditEvent)
        .filter(AuditEvent.organization_id == membership.organization_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": a.id,
            "action": a.action,
            "actor_role": a.actor_role,
            "resource_type": a.resource_type,
            "resource_id": a.resource_id,
            "details": a.details_json,
            "created_at": a.created_at
        }
        for a in audits
    ]
