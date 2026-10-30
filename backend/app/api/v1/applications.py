from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_candidate, require_hr, get_current_hr_membership
from app.models.models import Application, ApplicationStatusHistory, Job, ResumeFile, User, OrganizationMembership
from app.schemas.schemas import ApplicationCreate, ApplicationOut, ApplicationStatusUpdate, JobSummary
from app.services.resume_service import analyze_resume_against_job
from app.services.notification_service import create_notification, record_user_activity, record_audit_log

router = APIRouter(prefix="/applications", tags=["Applications"])

@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def apply_to_job(
    app_in: ApplicationCreate,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Candidate submits application for an active job opening."""
    job = db.query(Job).filter(Job.id == app_in.job_id).first()
    if not job or job.status != "published":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job is not open for applications")

    # Prevent duplicate applications
    existing_app = db.query(Application).filter(
        Application.job_id == job.id,
        Application.candidate_id == candidate.id
    ).first()
    if existing_app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted an active application for this role"
        )

    # Resume handling
    resume = None
    if app_in.resume_file_id:
        resume = db.query(ResumeFile).filter(
            ResumeFile.id == app_in.resume_file_id,
            ResumeFile.candidate_id == candidate.id
        ).first()
    else:
        # Default to candidate's latest uploaded resume
        resume = db.query(ResumeFile).filter(
            ResumeFile.candidate_id == candidate.id
        ).order_by(ResumeFile.uploaded_at.desc()).first()

    resume_match = 75.0
    sbert_sim = 0.70
    skills_score = 70.0

    if resume:
        analysis = analyze_resume_against_job(
            resume_text=resume.parsed_text or "",
            job_description=job.description,
            required_skills=job.required_skills
        )
        resume_match = analysis["match_score"]
        sbert_sim = analysis["sbert_similarity"]
        skills_score = analysis["skills_score"]

    app = Application(
        job_id=job.id,
        candidate_id=candidate.id,
        resume_file_id=resume.id if resume else None,
        status="submitted",
        resume_match_score=resume_match,
        sbert_similarity=sbert_sim,
        skills_match_score=skills_score,
        overall_ranking_score=round((resume_match * 0.4) + (skills_score * 0.6), 1)
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # Record initial status in history
    history = ApplicationStatusHistory(
        application_id=app.id,
        previous_status=None,
        new_status="submitted",
        changed_by_id=candidate.id,
        note="Application submitted by candidate."
    )
    db.add(history)
    db.commit()

    # User activity & notification
    record_user_activity(
        db=db,
        user_id=candidate.id,
        event_type="application_submitted",
        resource_type="application",
        resource_id=app.id,
        description=f"Submitted application for {job.title} at {job.organization.name if job.organization else 'Company'}.",
        metadata_json={"job_id": job.id, "match_score": resume_match}
    )

    create_notification(
        db=db,
        user_id=candidate.id,
        title="Application Received",
        message=f"Your application for {job.title} has been submitted successfully.",
        notification_type="status_change",
        link=f"/candidate/applications/{app.id}"
    )

    out = ApplicationOut.model_validate(app)
    out.job = JobSummary(id=job.id, title=job.title, department=job.department, location=job.location)
    out.candidate_name = candidate.full_name
    out.candidate_email = candidate.email
    return out

@router.get("/candidate/all", response_model=List[ApplicationOut])
def list_candidate_applications(
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Candidate views all past applications and status tracking."""
    apps = (
        db.query(Application)
        .filter(Application.candidate_id == candidate.id)
        .order_by(Application.applied_at.desc())
        .all()
    )
    results = []
    for a in apps:
        out = ApplicationOut.model_validate(a)
        out.job = JobSummary(id=a.job.id, title=a.job.title, department=a.job.department, location=a.job.location)
        out.candidate_name = candidate.full_name
        out.candidate_email = candidate.email
        results.append(out)
    return results

@router.get("/{application_id}", response_model=ApplicationOut)
def get_application_details(
    application_id: str,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(
        Application.id == application_id,
        Application.candidate_id == candidate.id
    ).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    out = ApplicationOut.model_validate(app)
    out.job = JobSummary(id=app.job.id, title=app.job.title, department=app.job.department, location=app.job.location)
    out.candidate_name = candidate.full_name
    out.candidate_email = candidate.email
    return out

@router.get("/job/{job_id}/applicants", response_model=List[ApplicationOut])
def list_job_applicants(
    job_id: str,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """HR views all applicants for a job under their organization."""
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.organization_id == membership.organization_id
    ).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found or access denied")

    apps = db.query(Application).filter(Application.job_id == job.id).order_by(Application.applied_at.desc()).all()
    results = []
    for a in apps:
        cand: User = a.candidate
        profile = cand.candidate_profile if cand else None
        alias = profile.anonymized_alias if profile and profile.anonymized_alias else f"Candidate #{cand.id[:4].upper()}"
        
        out = ApplicationOut.model_validate(a)
        out.candidate_name = cand.full_name if cand else "Candidate"
        out.candidate_email = cand.email if cand else ""
        out.anonymized_alias = alias
        out.job = JobSummary(id=job.id, title=job.title, department=job.department, location=job.location)
        results.append(out)
    return results

@router.patch("/{application_id}/status", response_model=ApplicationOut)
def update_application_status(
    application_id: str,
    status_update: ApplicationStatusUpdate,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """HR advances application stage with an audit note."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    if app.job.organization_id != membership.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this application")

    prev_status = app.status
    app.status = status_update.status
    db.commit()

    # Record in history
    hist = ApplicationStatusHistory(
        application_id=app.id,
        previous_status=prev_status,
        new_status=status_update.status,
        changed_by_id=hr_user.id,
        note=status_update.note or f"Status advanced by HR to {status_update.status}"
    )
    db.add(hist)
    db.commit()

    # Notify candidate
    create_notification(
        db=db,
        user_id=app.candidate_id,
        title="Application Status Updated",
        message=f"Your application for {app.job.title} status changed to: {status_update.status.replace('_', ' ').title()}.",
        notification_type="status_change",
        link=f"/candidate/applications/{app.id}"
    )

    record_audit_log(
        db=db,
        organization_id=membership.organization_id,
        actor_id=hr_user.id,
        actor_role="hr",
        action="APPLICATION_STATUS_UPDATED",
        resource_type="application",
        resource_id=app.id,
        details_json={"prev_status": prev_status, "new_status": status_update.status}
    )

    out = ApplicationOut.model_validate(app)
    out.job = JobSummary(id=app.job.id, title=app.job.title, department=app.job.department, location=app.job.location)
    return out
