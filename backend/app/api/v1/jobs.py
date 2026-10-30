from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_hr, get_current_hr_membership, get_current_user
from app.models.models import Job, User, OrganizationMembership, Application
from app.schemas.schemas import JobCreate, JobUpdate, JobOut
from app.services.notification_service import record_audit_log

router = APIRouter(prefix="/jobs", tags=["Job Management"])

@router.get("", response_model=List[JobOut])
def list_published_jobs(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    experience_level: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Public & Candidate endpoint to browse active published job postings."""
    query = db.query(Job).filter(Job.status == "published")
    if search:
        search_filter = f"%{search}%"
        query = query.filter((Job.title.ilike(search_filter)) | (Job.description.ilike(search_filter)))
    if department:
        query = query.filter(Job.department.ilike(f"%{department}%"))
    if experience_level:
        query = query.filter(Job.experience_level == experience_level)
    
    jobs = query.order_by(Job.created_at.desc()).all()
    results = []
    for j in jobs:
        out = JobOut.model_validate(j)
        out.organization_name = j.organization.name if j.organization else "Smart Recruit Client"
        out.applicants_count = len(j.applications)
        results.append(out)
    return results

@router.get("/organization/all", response_model=List[JobOut])
def list_organization_jobs(
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """HR endpoint to manage all organizational jobs (published, draft, paused, closed)."""
    jobs = db.query(Job).filter(Job.organization_id == membership.organization_id).order_by(Job.created_at.desc()).all()
    results = []
    for j in jobs:
        out = JobOut.model_validate(j)
        out.organization_name = membership.organization.name
        out.applicants_count = len(j.applications)
        results.append(out)
    return results

@router.get("/{job_id}", response_model=JobOut)
def get_job_by_id(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")
    out = JobOut.model_validate(job)
    out.organization_name = job.organization.name if job.organization else "Smart Recruit Client"
    out.applicants_count = len(job.applications)
    return out

@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    job_in: JobCreate,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """HR endpoint to create a new job opening under their tenant."""
    # Check subscription entitlement limits
    active_jobs_count = db.query(Job).filter(
        Job.organization_id == membership.organization_id,
        Job.status.in_(["published", "draft"])
    ).count()
    if active_jobs_count >= membership.organization.active_jobs_limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Active jobs limit ({membership.organization.active_jobs_limit}) reached for your {membership.organization.plan} plan."
        )

    job = Job(
        organization_id=membership.organization_id,
        created_by_id=hr_user.id,
        title=job_in.title,
        department=job_in.department,
        experience_level=job_in.experience_level,
        location=job_in.location,
        employment_type=job_in.employment_type,
        salary_range=job_in.salary_range,
        required_skills=job_in.required_skills,
        preferred_skills=job_in.preferred_skills,
        description=job_in.description,
        status=job_in.status
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    record_audit_log(
        db=db,
        organization_id=membership.organization_id,
        actor_id=hr_user.id,
        actor_role="hr",
        action="JOB_CREATED",
        resource_type="job",
        resource_id=job.id,
        details_json={"title": job.title, "status": job.status}
    )

    out = JobOut.model_validate(job)
    out.organization_name = membership.organization.name
    out.applicants_count = 0
    return out

@router.put("/{job_id}", response_model=JobOut)
def update_job(
    job_id: str,
    job_in: JobUpdate,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """HR endpoint to update an existing job posting."""
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.organization_id == membership.organization_id
    ).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found or access denied")

    update_data = job_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(job, field, val)

    db.commit()
    db.refresh(job)

    record_audit_log(
        db=db,
        organization_id=membership.organization_id,
        actor_id=hr_user.id,
        actor_role="hr",
        action="JOB_UPDATED",
        resource_type="job",
        resource_id=job.id,
        details_json={"title": job.title}
    )

    out = JobOut.model_validate(job)
    out.organization_name = membership.organization.name
    out.applicants_count = len(job.applications)
    return out

@router.delete("/{job_id}")
def delete_job(
    job_id: str,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.organization_id == membership.organization_id
    ).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found or access denied")

    db.delete(job)
    db.commit()

    record_audit_log(
        db=db,
        organization_id=membership.organization_id,
        actor_id=hr_user.id,
        actor_role="hr",
        action="JOB_DELETED",
        resource_type="job",
        resource_id=job_id
    )

    return {"message": "Job successfully deleted"}
