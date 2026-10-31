import csv
import io
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import or_, and_, func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.models import (
    Application, ApplicationStatusHistory, HiringDecision,
    HrDecisionHistory, User, Job, OrganizationMembership,
    InterviewSession, InterviewReport, AuditEvent
)
from app.services.notification_service import create_notification, record_audit_log
from app.services.ranking_service import calculate_composite_rank_score

def normalize_decision_type(raw_decision: str) -> str:
    """Normalizes decision strings to ACCEPTED or REJECTED."""
    dec = raw_decision.strip().lower()
    if dec in ["accepted", "selected"]:
        return "ACCEPTED"
    elif dec == "rejected":
        return "REJECTED"
    elif dec in ["on_hold", "hold"]:
        return "ON_HOLD"
    return raw_decision.strip().upper()

def recover_historical_decisions(db: Session) -> int:
    """
    Idempotent recovery migration.
    Scans existing HiringDecision records and final-status Application records
    to populate hr_decision_history without duplicate entries or fabricated data.
    """
    recovered_count = 0

    # 1. Recover from existing HiringDecision records
    existing_decisions = db.query(HiringDecision).all()
    for dec in existing_decisions:
        app = db.query(Application).filter(Application.id == dec.application_id).first()
        if not app or not app.job:
            continue
        
        norm_dec = normalize_decision_type(dec.decision)
        if norm_dec not in ["ACCEPTED", "REJECTED"]:
            continue

        # Check if already present in hr_decision_history
        exists = (
            db.query(HrDecisionHistory)
            .filter(
                HrDecisionHistory.application_id == app.id,
                HrDecisionHistory.decision == norm_dec
            )
            .first()
        )
        if exists:
            continue

        # Find status history transition if available
        hist = (
            db.query(ApplicationStatusHistory)
            .filter(ApplicationStatusHistory.application_id == app.id)
            .order_by(ApplicationStatusHistory.created_at.desc())
            .first()
        )
        prev_status = hist.previous_status if hist else "interview_completed"

        history_record = HrDecisionHistory(
            organization_id=app.job.organization_id,
            application_id=app.id,
            candidate_id=app.candidate_id,
            job_id=app.job_id,
            reviewer_id=dec.recruiter_id,
            decision=norm_dec,
            decision_notes=dec.rationale or "Historical confirmed HR decision record.",
            previous_status=prev_status,
            new_status=app.status,
            decided_at=dec.decided_at or app.updated_at or datetime.now(timezone.utc),
            created_at=dec.decided_at or datetime.now(timezone.utc)
        )
        db.add(history_record)
        recovered_count += 1

    # 2. Recover from Applications with terminal status (accepted/selected/rejected) missing decision records
    final_apps = (
        db.query(Application)
        .filter(Application.status.in_(["accepted", "selected", "rejected"]))
        .all()
    )
    for app in final_apps:
        if not app.job:
            continue
        norm_dec = normalize_decision_type(app.status)
        exists = (
            db.query(HrDecisionHistory)
            .filter(
                HrDecisionHistory.application_id == app.id,
                HrDecisionHistory.decision == norm_dec
            )
            .first()
        )
        if exists:
            continue

        hist = (
            db.query(ApplicationStatusHistory)
            .filter(ApplicationStatusHistory.application_id == app.id)
            .order_by(ApplicationStatusHistory.created_at.desc())
            .first()
        )
        reviewer_id = hist.changed_by_id if hist else None
        prev_status = hist.previous_status if hist else "interview_completed"
        dec_notes = (hist.note if (hist and hist.note) else "Historical decision recorded prior to audit log migration.")

        history_record = HrDecisionHistory(
            organization_id=app.job.organization_id,
            application_id=app.id,
            candidate_id=app.candidate_id,
            job_id=app.job_id,
            reviewer_id=reviewer_id,
            decision=norm_dec,
            decision_notes=dec_notes,
            previous_status=prev_status,
            new_status=app.status,
            decided_at=hist.created_at if hist else app.updated_at or datetime.now(timezone.utc),
            created_at=hist.created_at if hist else datetime.now(timezone.utc)
        )
        db.add(history_record)
        recovered_count += 1

    if recovered_count > 0:
        db.commit()
    return recovered_count

def record_hr_decision_workflow(
    db: Session,
    hr_user: User,
    membership: OrganizationMembership,
    application_id: str,
    raw_decision: str,
    notes: str
) -> Tuple[HrDecisionHistory, HiringDecision]:
    """
    Transactional core for HR hiring decisions.
    Enforces organizational tenancy, duplicates safeguard, status update,
    immutable history entry, candidate notification, and audit event.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application record not found")

    if app.job.organization_id != membership.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: application belongs to another organization"
        )

    norm_decision = normalize_decision_type(raw_decision)
    if norm_decision not in ["ACCEPTED", "REJECTED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision '{raw_decision}'. Must be ACCEPTED or REJECTED."
        )

    prev_status = app.status
    if norm_decision == "ACCEPTED":
        if app.status in ["accepted", "selected"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Candidate application has already been accepted."
            )
        target_status = "selected" if raw_decision.lower() == "selected" else "accepted"
        legacy_decision_val = "selected" if raw_decision.lower() == "selected" else "accepted"
    else:
        if app.status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Candidate application has already been rejected."
            )
        target_status = "rejected"
        legacy_decision_val = "rejected"

    cleaned_notes = notes.strip()
    if len(cleaned_notes) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision notes must be at least 3 characters explaining the objective rationale."
        )

    now_time = datetime.now(timezone.utc)

    # 1. Update Application Status
    app.status = target_status

    # 2. Upsert HiringDecision (for backwards compatibility)
    existing_dec = db.query(HiringDecision).filter(HiringDecision.application_id == app.id).first()
    if existing_dec:
        existing_dec.decision = legacy_decision_val
        existing_dec.rationale = cleaned_notes
        existing_dec.recruiter_id = hr_user.id
        existing_dec.decided_at = now_time
        legacy_record = existing_dec
    else:
        legacy_record = HiringDecision(
            application_id=app.id,
            job_id=app.job_id,
            recruiter_id=hr_user.id,
            decision=legacy_decision_val,
            rationale=cleaned_notes,
            decided_at=now_time
        )
        db.add(legacy_record)

    # 3. Insert immutable record into hr_decision_history
    history_record = HrDecisionHistory(
        organization_id=membership.organization_id,
        application_id=app.id,
        candidate_id=app.candidate_id,
        job_id=app.job_id,
        reviewer_id=hr_user.id,
        decision=norm_decision,
        decision_notes=cleaned_notes,
        previous_status=prev_status,
        new_status=target_status,
        decided_at=now_time,
        created_at=now_time
    )
    db.add(history_record)

    # 4. Record ApplicationStatusHistory
    status_history = ApplicationStatusHistory(
        application_id=app.id,
        previous_status=prev_status,
        new_status=target_status,
        changed_by_id=hr_user.id,
        note=f"Final human hiring decision: {norm_decision}. Notes: {cleaned_notes}"
    )
    db.add(status_history)

    # 5. Candidate Notification (without exposing private HR notes)
    if norm_decision == "ACCEPTED":
        notif_title = f"Application Accepted: {app.job.title}"
        notif_msg = f"Congratulations! Your application for {app.job.title} has been officially accepted by our hiring team."
    else:
        notif_title = f"Application Update: {app.job.title}"
        notif_msg = f"Thank you for interviewing for {app.job.title}. Our team has decided to proceed with other candidates at this time."

    create_notification(
        db=db,
        user_id=app.candidate_id,
        title=notif_title,
        message=notif_msg,
        notification_type="decision",
        link=f"/candidate/applications/{app.id}"
    )

    # 6. Audit Log
    record_audit_log(
        db=db,
        actor_id=hr_user.id,
        actor_role="hr",
        action=f"candidate_{norm_decision.lower()}",
        organization_id=membership.organization_id,
        resource_type="application",
        resource_id=app.id,
        details_json={
            "candidate_id": app.candidate_id,
            "job_id": app.job_id,
            "decision": norm_decision,
            "notes": cleaned_notes,
            "previous_status": prev_status,
            "new_status": target_status
        }
    )

    # Commit atomic transaction
    db.commit()
    db.refresh(history_record)
    db.refresh(legacy_record)

    return history_record, legacy_record

def get_hr_decision_history_paginated(
    db: Session,
    organization_id: str,
    decision_type: Optional[str] = None,
    candidate_search: Optional[str] = None,
    job_title_search: Optional[str] = None,
    reviewer_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    """
    Retrieves filtered and paginated HR hiring decision history for an organization.
    """
    query = (
        db.query(HrDecisionHistory)
        .join(Application, HrDecisionHistory.application_id == Application.id)
        .join(Job, HrDecisionHistory.job_id == Job.id)
        .join(User, HrDecisionHistory.candidate_id == User.id)
        .filter(HrDecisionHistory.organization_id == organization_id)
    )

    # Filter: Decision Type
    if decision_type and decision_type.strip().lower() not in ["all", ""]:
        norm_type = normalize_decision_type(decision_type)
        query = query.filter(HrDecisionHistory.decision == norm_type)

    # Filter: Candidate Search (name or email)
    if candidate_search and candidate_search.strip():
        term = f"%{candidate_search.strip()}%"
        query = query.filter(or_(User.full_name.ilike(term), User.email.ilike(term)))

    # Filter: Job Title Search (title or department)
    if job_title_search and job_title_search.strip():
        term = f"%{job_title_search.strip()}%"
        query = query.filter(or_(Job.title.ilike(term), Job.department.ilike(term)))

    # Filter: Reviewer ID
    if reviewer_id and reviewer_id.strip() not in ["all", ""]:
        query = query.filter(HrDecisionHistory.reviewer_id == reviewer_id.strip())

    # Filter: Date range
    if start_date:
        query = query.filter(HrDecisionHistory.decided_at >= start_date)
    if end_date:
        query = query.filter(HrDecisionHistory.decided_at <= end_date)

    total_count = query.count()

    # Sort
    if sort_order.lower() == "asc":
        query = query.order_by(HrDecisionHistory.decided_at.asc())
    else:
        query = query.order_by(HrDecisionHistory.decided_at.desc())

    # Pagination
    offset = (page - 1) * page_size
    records: List[HrDecisionHistory] = query.offset(offset).limit(page_size).all()

    items = []
    for r in records:
        app = r.application
        job = r.job
        cand = r.candidate
        rev = r.reviewer

        # Calculate scores
        resume_match = app.resume_match_score if app else 0.0
        session = db.query(InterviewSession).filter(InterviewSession.application_id == r.application_id).first()
        report = session.report if session else None
        int_score = report.overall_score if report else None

        overall_fit = calculate_composite_rank_score(
            resume_match=resume_match,
            interview_score=int_score or 0.0,
            required_skills=app.skills_match_score if app else 0.0
        ) if app else 0.0

        items.append({
            "id": r.id,
            "organization_id": r.organization_id,
            "application_id": r.application_id,
            "candidate_id": r.candidate_id,
            "job_id": r.job_id,
            "reviewer_id": r.reviewer_id,
            "decision": r.decision,
            "decision_notes": r.decision_notes,
            "previous_status": r.previous_status,
            "new_status": r.new_status,
            "decided_at": r.decided_at,
            "created_at": r.created_at,
            "candidate_name": cand.full_name if cand else "Unknown Candidate",
            "candidate_email": cand.email if cand else "",
            "candidate_alias": f"Candidate-{r.candidate_id[:6].upper()}",
            "job_title": job.title if job else "Unknown Position",
            "job_department": job.department if job else "General",
            "reviewer_name": rev.full_name if rev else "Historical / System Record",
            "reviewer_email": rev.email if rev else "",
            "resume_match_score": round(resume_match, 1),
            "interview_score": round(int_score, 1) if int_score is not None else None,
            "overall_fit_score": round(overall_fit, 1)
        })

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

def get_hr_decision_summary_counts(db: Session, organization_id: str) -> Dict[str, int]:
    """
    Computes statistical counts for the HR Confirmed Decisions dashboard.
    """
    base_query = db.query(HrDecisionHistory).filter(HrDecisionHistory.organization_id == organization_id)
    total_decisions = base_query.count()

    total_accepted = (
        base_query.filter(HrDecisionHistory.decision == "ACCEPTED")
        .count()
    )

    total_rejected = (
        base_query.filter(HrDecisionHistory.decision == "REJECTED")
        .count()
    )

    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    decisions_this_month = (
        base_query.filter(HrDecisionHistory.decided_at >= start_of_month)
        .count()
    )

    return {
        "total_decisions": total_decisions,
        "total_accepted": total_accepted,
        "total_rejected": total_rejected,
        "decisions_this_month": decisions_this_month
    }

def export_hr_decisions_csv(db: Session, organization_id: str) -> str:
    """
    Generates CSV string containing complete HR decision audit trail.
    """
    res = get_hr_decision_history_paginated(
        db=db,
        organization_id=organization_id,
        decision_type="all",
        page=1,
        page_size=1000
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Decision ID", "Candidate Name", "Candidate Email", "Job Title",
        "Department", "Decision", "HR Reviewer", "Decision Date (UTC)",
        "Previous Status", "New Status", "Resume Match %", "Interview Score %",
        "Overall Fit %", "Decision Notes"
    ])

    for row in res["items"]:
        writer.writerow([
            row["id"],
            row["candidate_name"],
            row["candidate_email"],
            row["job_title"],
            row["job_department"],
            row["decision"],
            row["reviewer_name"],
            row["decided_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("decided_at") else "",
            row["previous_status"] or "N/A",
            row["new_status"],
            row["resume_match_score"] or "N/A",
            row["interview_score"] if row.get("interview_score") is not None else "N/A",
            row["overall_fit_score"] or "N/A",
            row["decision_notes"]
        ])

    return output.getvalue()
