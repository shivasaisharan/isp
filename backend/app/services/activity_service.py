from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.models.models import (
    CandidateRecruitmentActivity, UserActivityEvent, User,
    Application, Job, Organization, ResumeFile, InterviewSession, InterviewReport
)

# Categorization mapping
CATEGORY_MAP = {
    "resume": ["RESUME_UPLOADED", "RESUME_UPDATED", "RESUME_ANALYZED", "RESUME_DELETED"],
    "application": ["APPLICATION_SUBMITTED", "APPLICATION_STATUS_UPDATED", "APPLICATION_WITHDRAWN", "NEXT_ROUND"],
    "interview": ["INTERVIEW_SCHEDULED", "INTERVIEW_STARTED", "INTERVIEW_COMPLETED", "ASSESSMENT_GENERATED"],
    "decision": ["APPLICATION_ACCEPTED", "APPLICATION_REJECTED"]
}

def get_activity_category(act_type: str) -> str:
    norm = act_type.upper()
    for cat, types in CATEGORY_MAP.items():
        if norm in types:
            return cat
    return "general"

def record_recruitment_activity(
    db: Session,
    candidate_id: str,
    activity_type: str,
    activity_title: str,
    activity_description: str,
    application_id: Optional[str] = None,
    job_id: Optional[str] = None,
    company_id: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None,
    occurred_at: Optional[datetime] = None
) -> Optional[CandidateRecruitmentActivity]:
    """
    Safely records a structured recruitment milestone.
    Enforces idempotency to avoid duplicates from retries or rapid double-clicks.
    """
    norm_type = activity_type.upper().strip()
    now_time = occurred_at or datetime.now(timezone.utc)
    meta = metadata_json or {}

    # Prevent duplicate identical activities within a 10-minute window or for the same application/event
    query = (
        db.query(CandidateRecruitmentActivity)
        .filter(
            CandidateRecruitmentActivity.candidate_id == candidate_id,
            CandidateRecruitmentActivity.activity_type == norm_type
        )
    )
    if application_id:
        query = query.filter(CandidateRecruitmentActivity.application_id == application_id)
    
    existing = query.first()
    # For one-off events like submission, acceptance, rejection, completion on an application, don't duplicate
    if existing and norm_type in [
        "APPLICATION_SUBMITTED", "APPLICATION_ACCEPTED", "APPLICATION_REJECTED",
        "INTERVIEW_COMPLETED", "RESUME_UPLOADED"
    ]:
        return existing

    # Auto-resolve company_id and job_id from application if missing
    if application_id and (not job_id or not company_id):
        app = db.query(Application).filter(Application.id == application_id).first()
        if app and app.job:
            job_id = job_id or app.job_id
            company_id = company_id or app.job.organization_id

    activity = CandidateRecruitmentActivity(
        candidate_id=candidate_id,
        application_id=application_id,
        job_id=job_id,
        company_id=company_id,
        activity_type=norm_type,
        activity_title=activity_title,
        activity_description=activity_description,
        metadata_json=meta,
        occurred_at=now_time,
        created_at=now_time
    )
    db.add(activity)

    # Also record in general UserActivityEvent for audit compatibility (without auth logs)
    db.add(UserActivityEvent(
        user_id=candidate_id,
        event_type=norm_type.lower(),
        resource_type="application" if application_id else "resume",
        resource_id=application_id or job_id,
        description=activity_description,
        metadata_json=meta,
        created_at=now_time
    ))

    db.commit()
    db.refresh(activity)
    return activity

def backfill_historical_recruitment_activities(db: Session) -> int:
    """
    Idempotent recovery migration:
    Scans existing candidate applications, resumes, interview sessions, and decisions
    and generates structured recruitment activities with full company and job titles.
    """
    count = 0

    # 1. Backfill Resume Uploads
    resumes = db.query(ResumeFile).all()
    for res in resumes:
        existing_res_acts = (
            db.query(CandidateRecruitmentActivity)
            .filter(
                CandidateRecruitmentActivity.candidate_id == res.candidate_id,
                CandidateRecruitmentActivity.activity_type == "RESUME_UPLOADED"
            )
            .all()
        )
        exists = any(
            (act.metadata_json or {}).get("filename") == res.file_name or
            (act.metadata_json or {}).get("file_id") == res.id
            for act in existing_res_acts
        )
        if not exists:
            occur_time = getattr(res, "uploaded_at", None) or datetime.now(timezone.utc)
            activity = CandidateRecruitmentActivity(
                candidate_id=res.candidate_id,
                activity_type="RESUME_UPLOADED",
                activity_title="Resume Uploaded",
                activity_description=f"You uploaded your resume: {res.file_name}.",
                metadata_json={"filename": res.file_name, "file_id": res.id},
                occurred_at=occur_time,
                created_at=occur_time
            )
            db.add(activity)
            count += 1

    # 2. Backfill Job Applications
    apps = db.query(Application).all()
    for app in apps:
        job = app.job
        company = job.organization if job else None
        company_name = company.name if company else "Hiring Company"
        job_title = job.title if job else "Position"

        # Application Submitted
        sub_exists = (
            db.query(CandidateRecruitmentActivity)
            .filter(
                CandidateRecruitmentActivity.candidate_id == app.candidate_id,
                CandidateRecruitmentActivity.application_id == app.id,
                CandidateRecruitmentActivity.activity_type == "APPLICATION_SUBMITTED"
            )
            .first()
        )
        if not sub_exists:
            app_time = getattr(app, "applied_at", None) or getattr(app, "updated_at", None) or datetime.now(timezone.utc)
            db.add(CandidateRecruitmentActivity(
                candidate_id=app.candidate_id,
                application_id=app.id,
                job_id=app.job_id,
                company_id=job.organization_id if job else None,
                activity_type="APPLICATION_SUBMITTED",
                activity_title="Job Application Submitted",
                activity_description=f"You successfully applied for {job_title} at {company_name}.",
                metadata_json={
                    "company_name": company_name,
                    "job_title": job_title,
                    "application_ref": f"APP-{app.id[:8].upper()}"
                },
                occurred_at=app_time,
                created_at=app_time
            ))
            count += 1

        # Application Accepted
        if app.status in ["accepted", "selected"]:
            acc_exists = (
                db.query(CandidateRecruitmentActivity)
                .filter(
                    CandidateRecruitmentActivity.candidate_id == app.candidate_id,
                    CandidateRecruitmentActivity.application_id == app.id,
                    CandidateRecruitmentActivity.activity_type == "APPLICATION_ACCEPTED"
                )
                .first()
            )
            if not acc_exists:
                dec_time = getattr(app, "updated_at", None) or getattr(app, "applied_at", None) or datetime.now(timezone.utc)
                db.add(CandidateRecruitmentActivity(
                    candidate_id=app.candidate_id,
                    application_id=app.id,
                    job_id=app.job_id,
                    company_id=job.organization_id if job else None,
                    activity_type="APPLICATION_ACCEPTED",
                    activity_title="Application Accepted",
                    activity_description=f"Your application for {job_title} at {company_name} was accepted by the recruitment team.",
                    metadata_json={
                        "company_name": company_name,
                        "job_title": job_title,
                        "status": "ACCEPTED",
                        "application_ref": f"APP-{app.id[:8].upper()}"
                    },
                    occurred_at=dec_time,
                    created_at=dec_time
                ))
                count += 1

        # Application Rejected
        elif app.status == "rejected":
            rej_exists = (
                db.query(CandidateRecruitmentActivity)
                .filter(
                    CandidateRecruitmentActivity.candidate_id == app.candidate_id,
                    CandidateRecruitmentActivity.application_id == app.id,
                    CandidateRecruitmentActivity.activity_type == "APPLICATION_REJECTED"
                )
                .first()
            )
            if not rej_exists:
                dec_time = getattr(app, "updated_at", None) or getattr(app, "applied_at", None) or datetime.now(timezone.utc)
                db.add(CandidateRecruitmentActivity(
                    candidate_id=app.candidate_id,
                    application_id=app.id,
                    job_id=app.job_id,
                    company_id=job.organization_id if job else None,
                    activity_type="APPLICATION_REJECTED",
                    activity_title="Application Update",
                    activity_description=f"Your application for {job_title} at {company_name} has concluded at this stage.",
                    metadata_json={
                        "company_name": company_name,
                        "job_title": job_title,
                        "status": "REJECTED",
                        "application_ref": f"APP-{app.id[:8].upper()}"
                    },
                    occurred_at=dec_time,
                    created_at=dec_time
                ))
                count += 1

    # 3. Backfill Interview Sessions & Completed Assessments
    sessions = db.query(InterviewSession).filter(InterviewSession.status == "completed").all()
    for s in sessions:
        app = s.application
        if not app or not app.job:
            continue
        company_name = app.job.organization.name if app.job.organization else "Company"
        job_title = app.job.title
        report = s.report
        score_val = report.overall_score if report else None

        int_exists = (
            db.query(CandidateRecruitmentActivity)
            .filter(
                CandidateRecruitmentActivity.candidate_id == s.candidate_id,
                CandidateRecruitmentActivity.application_id == s.application_id,
                CandidateRecruitmentActivity.activity_type == "INTERVIEW_COMPLETED"
            )
            .first()
        )
        if not int_exists:
            score_desc = f" with overall evaluation score of {score_val}%" if score_val is not None else ""
            db.add(CandidateRecruitmentActivity(
                candidate_id=s.candidate_id,
                application_id=s.application_id,
                job_id=app.job_id,
                company_id=app.job.organization_id,
                activity_type="INTERVIEW_COMPLETED",
                activity_title="AI Interview Completed",
                activity_description=f"You completed the AI technical interview for {job_title} at {company_name}{score_desc}.",
                metadata_json={
                    "company_name": company_name,
                    "job_title": job_title,
                    "score": score_val,
                    "application_ref": f"APP-{app.id[:8].upper()}"
                },
                occurred_at=getattr(s, "completed_at", None) or getattr(s, "started_at", None) or datetime.now(timezone.utc),
                created_at=getattr(s, "completed_at", None) or getattr(s, "started_at", None) or datetime.now(timezone.utc)
            ))
            count += 1

    if count > 0:
        db.commit()
    return count

def get_candidate_recruitment_activities_paginated(
    db: Session,
    candidate_id: str,
    category: Optional[str] = None,
    activity_type: Optional[str] = None,
    company_name: Optional[str] = None,
    job_title: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 15
) -> Dict[str, Any]:
    """
    Retrieves candidate's chronological recruitment journey.
    Strictly excludes login/logout/session system noise.
    """
    query = (
        db.query(CandidateRecruitmentActivity)
        .outerjoin(Job, CandidateRecruitmentActivity.job_id == Job.id)
        .outerjoin(Organization, CandidateRecruitmentActivity.company_id == Organization.id)
        .filter(CandidateRecruitmentActivity.candidate_id == candidate_id)
    )

    # Exclude system/auth noise explicitly
    excluded_types = ["LOGIN", "LOGOUT", "SESSION_CREATED", "TOKEN_REFRESHED", "PAGE_VISIT"]
    query = query.filter(~CandidateRecruitmentActivity.activity_type.in_(excluded_types))

    # Filter: Category (resume, application, interview, decision)
    if category and category.lower() in CATEGORY_MAP:
        allowed = CATEGORY_MAP[category.lower()]
        query = query.filter(CandidateRecruitmentActivity.activity_type.in_(allowed))

    # Filter: Specific Activity Type
    if activity_type and activity_type.strip().lower() not in ["all", ""]:
        query = query.filter(CandidateRecruitmentActivity.activity_type == activity_type.upper().strip())

    # Filter: Company Name
    if company_name and company_name.strip():
        term = f"%{company_name.strip()}%"
        query = query.filter(
            or_(
                Organization.name.ilike(term),
                CandidateRecruitmentActivity.activity_description.ilike(term)
            )
        )

    # Filter: Job Title
    if job_title and job_title.strip():
        term = f"%{job_title.strip()}%"
        query = query.filter(
            or_(
                Job.title.ilike(term),
                CandidateRecruitmentActivity.activity_description.ilike(term)
            )
        )

    # Filter: Date range
    if start_date:
        query = query.filter(CandidateRecruitmentActivity.occurred_at >= start_date)
    if end_date:
        query = query.filter(CandidateRecruitmentActivity.occurred_at <= end_date)

    total_count = query.count()

    # Sort
    if sort_order.lower() == "asc":
        query = query.order_by(CandidateRecruitmentActivity.occurred_at.asc())
    else:
        query = query.order_by(CandidateRecruitmentActivity.occurred_at.desc())

    offset = (page - 1) * page_size
    records: List[CandidateRecruitmentActivity] = query.offset(offset).limit(page_size).all()

    items = []
    for r in records:
        comp_name = r.company.name if r.company else r.metadata_json.get("company_name")
        pos_title = r.job.title if r.job else r.metadata_json.get("job_title")

        # Status badge determination
        act_type = r.activity_type
        if "ACCEPTED" in act_type:
            badge = "Accepted"
        elif "REJECTED" in act_type:
            badge = "Concluded"
        elif "COMPLETED" in act_type:
            score = r.metadata_json.get("score")
            badge = f"Score: {score}%" if score is not None else "Completed"
        elif "SUBMITTED" in act_type:
            badge = "Applied"
        elif "ANALYZED" in act_type:
            badge = "Analyzed"
        elif "UPLOADED" in act_type:
            badge = "Uploaded"
        else:
            badge = act_type.replace("_", " ").title()

        items.append({
            "id": r.id,
            "candidate_id": r.candidate_id,
            "application_id": r.application_id,
            "job_id": r.job_id,
            "company_id": r.company_id,
            "activity_type": r.activity_type,
            "activity_title": r.activity_title,
            "activity_description": r.activity_description,
            "metadata_json": r.metadata_json,
            "occurred_at": r.occurred_at,
            "created_at": r.created_at,
            "company_name": comp_name,
            "job_title": pos_title,
            "category": get_activity_category(r.activity_type),
            "status_badge": badge
        })

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

def get_candidate_activity_summary_metrics(db: Session, candidate_id: str) -> Dict[str, int]:
    """
    Computes top-level summary cards for the candidate portal:
    - Total Resumes Uploaded
    - Total Jobs Applied
    - Interviews Completed
    - Applications Accepted
    Zero login/logout events are counted.
    """
    total_resumes = (
        db.query(ResumeFile)
        .filter(ResumeFile.candidate_id == candidate_id)
        .count()
    )

    total_applied = (
        db.query(Application)
        .filter(Application.candidate_id == candidate_id)
        .count()
    )

    interviews_completed = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.candidate_id == candidate_id,
            InterviewSession.status == "completed"
        )
        .count()
    )

    accepted_apps = (
        db.query(Application)
        .filter(
            Application.candidate_id == candidate_id,
            Application.status.in_(["accepted", "selected"])
        )
        .count()
    )

    return {
        "total_resumes_uploaded": total_resumes,
        "total_jobs_applied": total_applied,
        "interviews_completed": interviews_completed,
        "applications_accepted": accepted_apps
    }
