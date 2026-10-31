from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse, FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_hr, get_current_hr_membership
from app.models.models import (
    User, HrDecisionHistory, OrganizationMembership, Application, Job, InterviewSession, ResumeFile
)
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token
from app.schemas.schemas import (
    HrDecisionHistoryPageOut, HrDecisionSummaryOut, HrDecisionHistoryOut,
    ApplicationDecisionRequest, ApplicationDecisionResponse
)
from app.services.decision_service import (
    get_hr_decision_history_paginated,
    get_hr_decision_summary_counts,
    export_hr_decisions_csv,
    get_organization_reviewers_list,
    record_hr_decision_workflow
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
    Lists all authorized HR reviewers belonging to the authenticated user's organization.
    """
    return get_organization_reviewers_list(
        db=db,
        organization_id=membership.organization_id
    )

hr_base_router = APIRouter(prefix="/hr", tags=["HR Reviewers Management"])

@hr_base_router.post("/applications/{application_id}/decision", response_model=ApplicationDecisionResponse)
def submit_hr_application_decision_direct(
    application_id: str,
    payload: ApplicationDecisionRequest,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Unified HR Hiring Decision Endpoint:
    POST /api/v1/hr/applications/{application_id}/decision
    Accepts: { "decision": "ACCEPTED"|"REJECTED", "decision_notes": "..." }
    """
    notes_val = payload.decision_notes or payload.notes or payload.rationale or ""
    history_rec, legacy_rec = record_hr_decision_workflow(
        db=db,
        hr_user=hr_user,
        membership=membership,
        application_id=application_id,
        raw_decision=payload.decision,
        notes=notes_val
    )
    is_rev = history_rec.previous_status in ["accepted", "selected"] and history_rec.decision == "REJECTED"
    return {
        "message": "Hiring decision successfully revised to REJECTED following verification." if is_rev else f"Candidate successfully marked as {history_rec.decision}!",
        "decision": history_rec.decision,
        "status": history_rec.new_status,
        "application_id": history_rec.application_id,
        "candidate_id": history_rec.candidate_id,
        "job_id": history_rec.job_id,
        "reviewer_id": hr_user.id,
        "decision_notes": history_rec.decision_notes,
        "decided_at": history_rec.decided_at,
        "is_revision": is_rev,
        "previous_decision": "ACCEPTED" if is_rev else None
    }

@hr_base_router.get("/reviewers")
def list_hr_reviewers_direct(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Direct endpoint for retrieving authorized HR reviewers: GET /api/v1/hr/reviewers.
    """
    return get_organization_reviewers_list(
        db=db,
        organization_id=membership.organization_id
    )

def resolve_application_resume(db: Session, application_id: str, organization_id: str):
    """
    Helper to safely retrieve an application and its associated resume snapshot
    while enforcing strict multi-tenant organization boundary checks.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if not app.job or app.job.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Candidate application belongs to another organization"
        )

    resume = None
    if app.resume_file_id:
        resume = db.query(ResumeFile).filter(ResumeFile.id == app.resume_file_id).first()

    if not resume and app.candidate_id:
        resume = db.query(ResumeFile).filter(
            ResumeFile.candidate_id == app.candidate_id
        ).order_by(ResumeFile.uploaded_at.desc()).first()
        if resume and not app.resume_file_id:
            app.resume_file_id = resume.id
            db.commit()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume Not Available: No resume document has been uploaded for this candidate application."
        )

    return app, resume

@hr_base_router.get("/applications/{application_id}/resume")
def get_hr_application_resume(
    application_id: str,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Retrieves candidate resume document metadata and short-lived access references.
    Enforces HR role verification and tenant isolation.
    GET /api/v1/hr/applications/{application_id}/resume
    """
    app, resume = resolve_application_resume(db, application_id, membership.organization_id)

    # 1. Attempt Supabase Storage signed URL if Supabase is enabled
    signed_url = None
    if settings.is_supabase_enabled:
        try:
            from app.services.supabase_service import SupabaseStorageService
            signed_url = SupabaseStorageService.get_signed_url(
                bucket=SupabaseStorageService.BUCKET_RESUMES,
                path=resume.file_path,
                expires_in=3600
            )
        except Exception as e:
            print(f"[Supabase Storage Warning] Error generating signed url: {e}")
            signed_url = None

    # 2. Generate secure, time-limited token for direct streaming & download
    view_token = create_access_token(
        subject=hr_user.id,
        role=hr_user.role,
        expires_delta=timedelta(hours=2)
    )
    direct_stream_url = f"/api/v1/hr/applications/{app.id}/resume/file?token={view_token}"
    download_url = f"/api/v1/hr/applications/{app.id}/resume/file?token={view_token}&download=true"

    cand_name = app.candidate.full_name if app.candidate else "Candidate"
    job_title = app.job.title if app.job else "Position"
    app_ref = f"APP-{app.id[:8].upper()}"

    return {
        "application_id": app.id,
        "candidate_id": app.candidate_id,
        "candidate_name": cand_name,
        "job_title": job_title,
        "application_reference": app_ref,
        "resume": {
            "resume_id": resume.id,
            "file_name": resume.file_name,
            "file_type": resume.mime_type or "application/pdf",
            "file_size": resume.file_size,
            "signed_url": signed_url or direct_stream_url,
            "stream_url": direct_stream_url,
            "download_url": download_url,
            "uploaded_at": resume.uploaded_at.isoformat() if resume.uploaded_at else None
        }
    }

@hr_base_router.get("/applications/{application_id}/resume/file")
def stream_hr_application_resume_file(
    application_id: str,
    token: Optional[str] = Query(None, description="Short-lived token for iframe or direct download"),
    download: bool = Query(False, description="Set true to force attachment download"),
    db: Session = Depends(get_db)
):
    """
    Streams the resume PDF binary securely.
    Supports either token query parameter (for standard browser iframes) or Bearer authorization.
    Verifies user role and organization isolation before serving file bytes.
    """
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication token required")

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        role = payload.get("role")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "hr":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR users may access candidate resumes")

    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active organization membership")

    app, resume = resolve_application_resume(db, application_id, membership.organization_id)

    # Locate file on disk
    file_path = Path(resume.file_path)
    if not file_path.is_absolute():
        file_path = settings.UPLOAD_DIR / file_path
    if not file_path.exists():
        # Fallback to file name in UPLOAD_DIR
        file_path = settings.UPLOAD_DIR / Path(resume.file_path).name

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume file '{resume.file_name}' not found on storage server"
        )

    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=str(file_path),
        media_type=resume.mime_type or "application/pdf",
        filename=resume.file_name,
        headers={
            "Content-Disposition": f'{disposition}; filename="{resume.file_name}"',
            "Cache-Control": "private, max-age=3600"
        }
    )

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

