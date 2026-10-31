import io
import csv
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

from app.models.models import (
    AuditEvent, User, Job, Application, Organization, OrganizationMembership, HiringDecision
)
from app.schemas.schemas import (
    ResolvedAuditEventOut, AuditTrailSummaryOut, AuditTrailPageOut
)

EVENT_TYPE_MAPPINGS: Dict[str, Dict[str, Any]] = {
    "candidate_accepted": {
        "title": "Candidate Accepted",
        "category": "hiring",
        "category_display": "Hiring Decisions",
        "is_hiring_decision": True
    },
    "candidate_rejected": {
        "title": "Candidate Rejected",
        "category": "hiring",
        "category_display": "Hiring Decisions",
        "is_hiring_decision": True
    },
    "FINAL_HIRING_DECISION": {
        "title": "Final Hiring Decision Recorded",
        "category": "hiring",
        "category_display": "Hiring Decisions",
        "is_hiring_decision": True
    },
    "APPLICATION_STATUS_UPDATED": {
        "title": "Application Status Updated",
        "category": "application",
        "category_display": "Candidate Applications",
        "is_hiring_decision": False
    },
    "APPLICATION_SUBMITTED": {
        "title": "Candidate Applied for Job",
        "category": "application",
        "category_display": "Candidate Applications",
        "is_hiring_decision": False
    },
    "APPLICATION_CREATED": {
        "title": "Candidate Applied for Job",
        "category": "application",
        "category_display": "Candidate Applications",
        "is_hiring_decision": False
    },
    "INTERVIEW_STARTED": {
        "title": "AI Interview Started",
        "category": "interview",
        "category_display": "Interview Events",
        "is_hiring_decision": False
    },
    "INTERVIEW_COMPLETED": {
        "title": "AI Interview Completed",
        "category": "interview",
        "category_display": "Interview Events",
        "is_hiring_decision": False
    },
    "ASSESSMENT_GENERATED": {
        "title": "AI Assessment Generated",
        "category": "interview",
        "category_display": "Interview Events",
        "is_hiring_decision": False
    },
    "RESUME_UPLOADED": {
        "title": "Candidate Resume Uploaded",
        "category": "resume",
        "category_display": "Resume Events",
        "is_hiring_decision": False
    },
    "RESUME_UPDATED": {
        "title": "Candidate Resume Updated",
        "category": "resume",
        "category_display": "Resume Events",
        "is_hiring_decision": False
    },
    "RESUME_ANALYZED": {
        "title": "Resume Analyzed & Scored",
        "category": "resume",
        "category_display": "Resume Events",
        "is_hiring_decision": False
    },
    "INTERVIEW_VIOLATION": {
        "title": "Interview Security Event Recorded",
        "category": "security",
        "category_display": "Security Events",
        "is_hiring_decision": False
    },
    "interview_security_violation": {
        "title": "Interview Security Event Recorded",
        "category": "security",
        "category_display": "Security Events",
        "is_hiring_decision": False
    },
    "SECURITY_ALERT": {
        "title": "Security Environment Alert",
        "category": "security",
        "category_display": "Security Events",
        "is_hiring_decision": False
    },
    "JOB_CREATED": {
        "title": "New Job Opening Created",
        "category": "job",
        "category_display": "Job Management",
        "is_hiring_decision": False
    },
    "JOB_PUBLISHED": {
        "title": "Job Opening Published",
        "category": "job",
        "category_display": "Job Management",
        "is_hiring_decision": False
    },
    "JOB_UPDATED": {
        "title": "Job Opening Updated",
        "category": "job",
        "category_display": "Job Management",
        "is_hiring_decision": False
    },
    "JOB_DELETED": {
        "title": "Job Opening Deleted",
        "category": "job",
        "category_display": "Job Management",
        "is_hiring_decision": False
    },
    "HR_REGISTERED": {
        "title": "HR Recruiter Account Registered",
        "category": "system",
        "category_display": "System & Compliance",
        "is_hiring_decision": False
    }
}

ROLE_DESIGNATION_MAP = {
    "admin": "Recruiter Admin",
    "owner": "Recruiter Owner",
    "lead": "Senior Recruiter",
    "recruiter": "HR Recruiter",
    "member": "HR Member",
    "compliance": "Compliance Officer"
}

def resolve_action_meta(action: str) -> Dict[str, Any]:
    """Returns human-readable title, category and categorization flags for an action."""
    if action in EVENT_TYPE_MAPPINGS:
        return EVENT_TYPE_MAPPINGS[action]
    
    # Clean fallback for unknown actions
    title = action.replace("_", " ").title()
    category = "system"
    category_display = "System Audit"
    is_hiring = False
    
    act_lower = action.lower()
    if "decision" in act_lower or "accept" in act_lower or "reject" in act_lower or "offer" in act_lower:
        category = "hiring"
        category_display = "Hiring Decisions"
        is_hiring = True
    elif "interview" in act_lower:
        category = "interview"
        category_display = "Interview Events"
    elif "resume" in act_lower:
        category = "resume"
        category_display = "Resume Events"
    elif "violation" in act_lower or "security" in act_lower or "alert" in act_lower:
        category = "security"
        category_display = "Security Events"
    elif "job" in act_lower:
        category = "job"
        category_display = "Job Management"
    elif "app" in act_lower:
        category = "application"
        category_display = "Candidate Applications"

    return {
        "title": title,
        "category": category,
        "category_display": category_display,
        "is_hiring_decision": is_hiring
    }

def get_organization_audit_summary(db: Session, organization_id: str) -> AuditTrailSummaryOut:
    """Computes real-time audit metric counts across categories for the HR organization."""
    events = db.query(AuditEvent).filter(AuditEvent.organization_id == organization_id).all()
    
    total = len(events)
    hiring_count = 0
    app_count = 0
    interview_count = 0
    resume_count = 0
    security_count = 0
    job_count = 0

    for ev in events:
        meta = resolve_action_meta(ev.action)
        cat = meta["category"]
        if cat == "hiring":
            hiring_count += 1
        elif cat == "application":
            app_count += 1
        elif cat == "interview":
            interview_count += 1
        elif cat == "resume":
            resume_count += 1
        elif cat == "security":
            security_count += 1
        elif cat == "job":
            job_count += 1

    return AuditTrailSummaryOut(
        total_audit_events=total,
        hiring_decisions=hiring_count,
        candidate_applications=app_count,
        interview_events=interview_count,
        resume_events=resume_count,
        security_events=security_count,
        job_management_events=job_count
    )

def get_organization_audit_trail_paginated(
    db: Session,
    organization_id: str,
    category: Optional[str] = None,
    event_type: Optional[str] = None,
    search: Optional[str] = None,
    reviewer_id: Optional[str] = None,
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 15
) -> AuditTrailPageOut:
    """
    Retrieves, resolves, and paginates enterprise audit trail records for an organization.
    Resolves raw UUIDs into Candidate Names, Job Titles, Companies, and Reviewer Designations.
    """
    query = db.query(AuditEvent).filter(AuditEvent.organization_id == organization_id)

    # 1. Category Filter
    if category and category.lower() != "all":
        cat_lower = category.lower()
        if cat_lower == "hiring":
            query = query.filter(AuditEvent.action.in_(["candidate_accepted", "candidate_rejected", "FINAL_HIRING_DECISION"]))
        elif cat_lower == "application":
            query = query.filter(AuditEvent.action.in_(["APPLICATION_STATUS_UPDATED", "APPLICATION_SUBMITTED", "APPLICATION_CREATED"]))
        elif cat_lower == "interview":
            query = query.filter(AuditEvent.action.in_(["INTERVIEW_STARTED", "INTERVIEW_COMPLETED", "ASSESSMENT_GENERATED"]))
        elif cat_lower == "resume":
            query = query.filter(AuditEvent.action.in_(["RESUME_UPLOADED", "RESUME_UPDATED", "RESUME_ANALYZED"]))
        elif cat_lower == "security":
            query = query.filter(AuditEvent.action.in_(["INTERVIEW_VIOLATION", "interview_security_violation", "SECURITY_ALERT"]))
        elif cat_lower == "job":
            query = query.filter(AuditEvent.action.in_(["JOB_CREATED", "JOB_PUBLISHED", "JOB_UPDATED", "JOB_DELETED"]))
        elif cat_lower == "system":
            query = query.filter(AuditEvent.action.in_(["HR_REGISTERED"]))

    # 2. Specific Event Type Filter
    if event_type and event_type.strip():
        query = query.filter(AuditEvent.action == event_type.strip())

    # 3. Reviewer Filter
    if reviewer_id and reviewer_id.strip():
        query = query.filter(AuditEvent.actor_id == reviewer_id.strip())

    # 4. Date Range Filters
    if start_date:
        query = query.filter(AuditEvent.created_at >= start_date)
    if end_date:
        query = query.filter(AuditEvent.created_at <= end_date)

    # 5. Sorting
    if sort_order == "asc":
        query = query.order_by(asc(AuditEvent.created_at))
    else:
        query = query.order_by(desc(AuditEvent.created_at))

    # Fetch candidate events for resolution
    all_events = query.all()
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    default_company_name = org.name if org else "Smart Recruit Enterprise"

    # Pre-collect IDs for batched lookups
    user_ids = set()
    job_ids = set()
    app_ids = set()

    for ev in all_events:
        det = ev.details_json or {}
        if ev.actor_id:
            user_ids.add(ev.actor_id)
        if det.get("candidate_id"):
            user_ids.add(det.get("candidate_id"))
        if det.get("reviewer_id"):
            user_ids.add(det.get("reviewer_id"))
        if det.get("job_id"):
            job_ids.add(det.get("job_id"))
        if ev.resource_type == "job" and ev.resource_id:
            job_ids.add(ev.resource_id)
        if ev.resource_type == "application" and ev.resource_id:
            app_ids.add(ev.resource_id)
        if det.get("application_id"):
            app_ids.add(det.get("application_id"))

    # Batched DB lookups
    users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    jobs_by_id = {j.id: j for j in db.query(Job).filter(Job.id.in_(job_ids)).all()} if job_ids else {}
    apps_by_id = {a.id: a for a in db.query(Application).filter(Application.id.in_(app_ids)).all()} if app_ids else {}

    # Also resolve jobs/candidates from applications where missing
    for app in apps_by_id.values():
        if app.candidate_id and app.candidate_id not in users_by_id:
            user_ids.add(app.candidate_id)
        if app.job_id and app.job_id not in jobs_by_id:
            job_ids.add(app.job_id)

    if len(user_ids) > len(users_by_id):
        missing_users = user_ids - set(users_by_id.keys())
        for u in db.query(User).filter(User.id.in_(missing_users)).all():
            users_by_id[u.id] = u

    if len(job_ids) > len(jobs_by_id):
        missing_jobs = job_ids - set(jobs_by_id.keys())
        for j in db.query(Job).filter(Job.id.in_(missing_jobs)).all():
            jobs_by_id[j.id] = j

    # Look up memberships for HR actor roles
    memberships = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.user_id.in_(user_ids)
    ).all() if user_ids else []
    membership_roles_by_user = {m.user_id: m.role for m in memberships}

    # Resolve all items into rich models
    resolved_items: List[ResolvedAuditEventOut] = []

    for ev in all_events:
        det = ev.details_json or {}
        meta = resolve_action_meta(ev.action)

        # 1. Resolve Candidate
        c_id = det.get("candidate_id")
        app_obj = None
        if not c_id:
            if ev.resource_type == "application" and ev.resource_id in apps_by_id:
                app_obj = apps_by_id[ev.resource_id]
                c_id = app_obj.candidate_id
            elif det.get("application_id") and det["application_id"] in apps_by_id:
                app_obj = apps_by_id[det["application_id"]]
                c_id = app_obj.candidate_id
            elif ev.actor_role == "candidate" and ev.actor_id:
                c_id = ev.actor_id

        cand_user = users_by_id.get(c_id) if c_id else None
        candidate_name = None
        candidate_ref = None
        candidate_email = None

        if cand_user:
            candidate_name = cand_user.full_name
            candidate_ref = f"CAND-{cand_user.id[:6].upper()}"
            candidate_email = cand_user.email
        elif c_id:
            candidate_name = det.get("candidate_name") or "Candidate Record Available"
            candidate_ref = f"CAND-{c_id[:6].upper()}"

        # 2. Resolve Job & Company
        j_id = det.get("job_id")
        if not j_id:
            if ev.resource_type == "job":
                j_id = ev.resource_id
            elif app_obj:
                j_id = app_obj.job_id
            elif ev.resource_type == "application" and ev.resource_id in apps_by_id:
                j_id = apps_by_id[ev.resource_id].job_id

        job_obj = jobs_by_id.get(j_id) if j_id else None
        job_title = None
        job_ref = None
        comp_name = default_company_name
        dept = None

        if job_obj:
            job_title = job_obj.title
            job_ref = f"JOB-{job_obj.id[:6].upper()}"
            dept = job_obj.department
            if job_obj.organization:
                comp_name = job_obj.organization.name
        elif j_id:
            job_title = det.get("title") or det.get("job_title") or "Engineering Position"
            job_ref = f"JOB-{j_id[:6].upper()}"
        elif det.get("title"):
            job_title = det.get("title")

        # 3. Resolve Actor / Reviewer
        actor_user = users_by_id.get(ev.actor_id) if ev.actor_id else None
        actor_name = "System Automation"
        actor_ref = None
        actor_role_slug = ev.actor_role or "system"
        actor_designation = "System Automation & AI"

        if actor_user:
            actor_name = actor_user.full_name
            actor_ref = f"HR-{actor_user.id[:6].upper()}" if actor_role_slug == "hr" else f"USER-{actor_user.id[:6].upper()}"
            if actor_role_slug == "hr":
                raw_m_role = membership_roles_by_user.get(actor_user.id, "recruiter")
                actor_designation = ROLE_DESIGNATION_MAP.get(raw_m_role, "HR Recruiter")
            elif actor_role_slug == "candidate":
                actor_designation = "Candidate Applicant"
            else:
                actor_designation = actor_role_slug.title()
        elif actor_role_slug == "candidate" and cand_user:
            actor_name = cand_user.full_name
            actor_designation = "Candidate Applicant"
        elif det.get("organization"):
            comp_name = det.get("organization")

        # 4. Status Transition
        prev_status = det.get("previous_status") or det.get("prev_status")
        new_status = det.get("new_status") or (det.get("decision").title() if det.get("decision") else None)
        if not new_status and ev.action == "candidate_accepted":
            new_status = "Accepted"
        elif not new_status and ev.action == "candidate_rejected":
            new_status = "Rejected"

        # 5. Decision Notes / Rationale
        notes = det.get("notes") or det.get("rationale") or det.get("description") or det.get("note")

        # 6. References
        app_id = det.get("application_id") or (ev.resource_id if ev.resource_type == "application" else None)
        app_ref = f"APP-{app_id[:8].upper()}" if app_id else None
        assessment_ref = det.get("assessment_reference") or (f"Score: {det['resume_match']}%" if "resume_match" in det else None)

        item = ResolvedAuditEventOut(
            id=ev.id,
            event_reference=f"AUD-{ev.id[:8].upper()}",
            action=ev.action,
            action_display=meta["title"],
            category=meta["category"],
            category_display=meta["category_display"],
            actor_id=ev.actor_id,
            actor_role=actor_role_slug,
            actor_name=actor_name,
            actor_designation=actor_designation,
            actor_reference=actor_ref,
            candidate_id=c_id,
            candidate_name=candidate_name,
            candidate_reference=candidate_ref,
            candidate_email=candidate_email,
            job_id=j_id,
            job_title=job_title,
            job_reference=job_ref,
            company_name=comp_name,
            department=dept,
            previous_status=prev_status.replace("_", " ").title() if prev_status else None,
            new_status=new_status.replace("_", " ").title() if new_status else None,
            decision_notes=notes,
            application_id=app_id,
            application_reference=app_ref,
            assessment_reference=assessment_ref,
            resource_type=ev.resource_type,
            resource_id=ev.resource_id,
            details_json=det,
            created_at=ev.created_at,
            is_hiring_decision=meta["is_hiring_decision"]
        )

        # Candidate ID or Job ID explicit filter (if passed in request)
        if candidate_id and item.candidate_id != candidate_id:
            continue
        if job_id and item.job_id != job_id:
            continue

        # Search filter across resolved fields
        if search and search.strip():
            q = search.strip().lower()
            matches = (
                (item.candidate_name and q in item.candidate_name.lower()) or
                (item.candidate_reference and q in item.candidate_reference.lower()) or
                (item.job_title and q in item.job_title.lower()) or
                (item.company_name and q in item.company_name.lower()) or
                (item.actor_name and q in item.actor_name.lower()) or
                (item.event_reference and q in item.event_reference.lower()) or
                (item.decision_notes and q in item.decision_notes.lower()) or
                (item.action_display and q in item.action_display.lower())
            )
            if not matches:
                continue

        resolved_items.append(item)

    # 6. Pagination
    total_count = len(resolved_items)
    total_pages = max(1, (total_count + page_size - 1) // page_size) if page_size > 0 else 1
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = resolved_items[start_idx:end_idx]

    return AuditTrailPageOut(
        items=page_items,
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

def export_audit_trail_csv(db: Session, organization_id: str) -> str:
    """Generates an official Compliance Audit CSV formatted for enterprise and HR oversight."""
    page_result = get_organization_audit_trail_paginated(
        db=db,
        organization_id=organization_id,
        page=1,
        page_size=1000,
        sort_order="desc"
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header Row
    writer.writerow([
        "Event Reference",
        "Action Display",
        "Action Category",
        "Candidate Name",
        "Candidate Reference",
        "Job Position",
        "Company Name",
        "Department",
        "Performed By",
        "Reviewer Role",
        "Previous Status",
        "New Status",
        "Decision Rationale / Notes",
        "Timestamp (UTC)",
        "Raw Action Code"
    ])

    for item in page_result.items:
        writer.writerow([
            item.event_reference,
            item.action_display,
            item.category_display,
            item.candidate_name or "N/A",
            item.candidate_reference or "N/A",
            item.job_title or "N/A",
            item.company_name or "N/A",
            item.department or "N/A",
            item.actor_name,
            item.actor_designation,
            item.previous_status or "N/A",
            item.new_status or "N/A",
            item.decision_notes or "",
            item.created_at.strftime("%Y-%m-%d %H:%M:%S") if item.created_at else "",
            item.action
        ])

    return output.getvalue()
