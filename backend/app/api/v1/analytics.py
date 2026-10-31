from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import Job, Application, InterviewSession, HiringDecision, AuditEvent, User, OrganizationMembership
from app.schemas.schemas import ResolvedAuditEventOut, AuditTrailSummaryOut, AuditTrailPageOut
from app.services.audit_service import (
    get_organization_audit_trail_paginated,
    get_organization_audit_summary,
    export_audit_trail_csv
)

router = APIRouter(prefix="/analytics", tags=["HR Analytics & Compliance"])
audit_router = APIRouter(prefix="/hr/audit-trail", tags=["HR Compliance Audit Trail"])

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

@audit_router.get("/summary", response_model=AuditTrailSummaryOut)
@router.get("/audit-summary", response_model=AuditTrailSummaryOut)
def get_audit_trail_summary(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """Returns summary metrics across audit categories for the organization."""
    return get_organization_audit_summary(db, membership.organization_id)

@audit_router.get("", response_model=AuditTrailPageOut)
@router.get("/audit-trail", response_model=AuditTrailPageOut)
def get_compliance_audit_trail_page(
    category: Optional[str] = Query(None, description="hiring, application, interview, resume, security, job, system"),
    event_type: Optional[str] = Query(None, description="Exact action type filter"),
    search: Optional[str] = Query(None, description="Search candidate, job, reviewer, or notes"),
    reviewer_id: Optional[str] = Query(None, description="HR Reviewer user ID"),
    candidate_id: Optional[str] = Query(None, description="Candidate user ID"),
    job_id: Optional[str] = Query(None, description="Job ID"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    sort_order: str = Query("desc", description="'desc' or 'asc'"),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Enterprise-grade Immutable Responsible AI Compliance Audit Trail.
    Dynamically resolves raw UUIDs into Candidate Names, Job Titles, and Reviewer Details.
    """
    return get_organization_audit_trail_paginated(
        db=db,
        organization_id=membership.organization_id,
        category=category,
        event_type=event_type,
        search=search,
        reviewer_id=reviewer_id,
        candidate_id=candidate_id,
        job_id=job_id,
        start_date=start_date,
        end_date=end_date,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )

@audit_router.get("/export")
@router.get("/audit-logs/export")
def export_audit_trail(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """Exports the complete immutable compliance audit trail as an official CSV report."""
    csv_data = export_audit_trail_csv(db, membership.organization_id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=compliance_audit_trail_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )

@router.get("/audit-logs")
def get_compliance_audit_trail_legacy(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """Legacy backward-compatible audit log endpoint returning resolved audit items."""
    page_out = get_organization_audit_trail_paginated(
        db=db,
        organization_id=membership.organization_id,
        category=category,
        search=search,
        page=1,
        page_size=limit
    )
    return [
        {
            "id": a.id,
            "event_reference": a.event_reference,
            "action": a.action,
            "action_display": a.action_display,
            "category": a.category,
            "category_display": a.category_display,
            "actor_role": a.actor_role,
            "actor_name": a.actor_name,
            "actor_designation": a.actor_designation,
            "actor_reference": a.actor_reference,
            "candidate_name": a.candidate_name,
            "candidate_reference": a.candidate_reference,
            "job_title": a.job_title,
            "job_reference": a.job_reference,
            "company_name": a.company_name,
            "previous_status": a.previous_status,
            "new_status": a.new_status,
            "decision_notes": a.decision_notes,
            "resource_type": a.resource_type,
            "resource_id": a.resource_id,
            "details": a.details_json,
            "created_at": a.created_at
        }
        for a in page_out.items
    ]
