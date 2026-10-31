from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_candidate, require_hr, get_current_hr_membership, get_current_user
from app.models.models import (
    Application, ApplicationStatusHistory, Job, ResumeFile, User, OrganizationMembership,
    InterviewSession, InterviewReport, InterviewQuestion, InterviewAnswer, HiringDecision
)
from app.schemas.schemas import (
    ApplicationCreate, ApplicationOut, ApplicationStatusUpdate, JobSummary,
    DecisionActionRequest, ApplicationDecisionRequest, ApplicationDecisionResponse
)
from app.services.resume_service import analyze_resume_against_job
from app.services.notification_service import create_notification, record_user_activity, record_audit_log
from app.core.rubric import calculate_composite_rank_score, INTERVIEW_RUBRIC

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
        overall_ranking_score=calculate_composite_rank_score(
            resume_match=resume_match,
            interview_score=0.0,
            required_skills=skills_score
        )
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

    from app.services.activity_service import record_recruitment_activity
    comp_name = job.organization.name if job.organization else "Company"
    record_recruitment_activity(
        db=db,
        candidate_id=candidate.id,
        activity_type="APPLICATION_SUBMITTED",
        activity_title="Job Application Submitted",
        activity_description=f"You successfully applied for {job.title} at {comp_name}.",
        application_id=app.id,
        job_id=job.id,
        company_id=job.organization_id,
        metadata_json={
            "company_name": comp_name,
            "job_title": job.title,
            "application_ref": f"APP-{app.id[:8].upper()}"
        }
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
        session = db.query(InterviewSession).filter(InterviewSession.application_id == a.id).first()
        report = session.report if session else None
        has_report = report is not None
        interview_score = report.overall_score if has_report else None

        # Consistent overall fit calculation
        overall_fit = calculate_composite_rank_score(
            resume_match=a.resume_match_score,
            interview_score=interview_score if interview_score is not None else 0.0,
            required_skills=a.skills_match_score
        )

        out = ApplicationOut.model_validate(a)
        out.job = JobSummary(id=a.job.id, title=a.job.title, department=a.job.department, location=a.job.location)
        out.candidate_name = candidate.full_name
        out.candidate_email = candidate.email
        out.interview_score = interview_score
        out.interview_status = session.status if session else "not_started"
        out.report_id = report.id if report else None
        out.assessment_status = "Completed" if has_report else ("Interview In Progress" if session and session.status == "in_progress" else "Pending")
        out.overall_ranking_score = overall_fit
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

    session = db.query(InterviewSession).filter(InterviewSession.application_id == app.id).first()
    report = session.report if session else None
    has_report = report is not None
    interview_score = report.overall_score if has_report else None

    overall_fit = calculate_composite_rank_score(
        resume_match=app.resume_match_score,
        interview_score=interview_score if interview_score is not None else 0.0,
        required_skills=app.skills_match_score
    )

    out = ApplicationOut.model_validate(app)
    out.job = JobSummary(id=app.job.id, title=app.job.title, department=app.job.department, location=app.job.location)
    out.candidate_name = candidate.full_name
    out.candidate_email = candidate.email
    out.interview_score = interview_score
    out.interview_status = session.status if session else "not_started"
    out.report_id = report.id if report else None
    out.assessment_status = "Completed" if has_report else ("Interview In Progress" if session and session.status == "in_progress" else "Pending")
    out.overall_ranking_score = overall_fit
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

        # Fetch candidate's interview session & report
        session = db.query(InterviewSession).filter(InterviewSession.application_id == a.id).first()
        report = session.report if session else None
        has_report = report is not None
        interview_score = report.overall_score if has_report else None

        # Authoritative composite overall fit calculation:
        # Overall Candidate Fit = (Resume Match * 0.40) + (Interview Assessment * 0.40) + (Verified Skills * 0.20)
        overall_fit = calculate_composite_rank_score(
            resume_match=a.resume_match_score,
            interview_score=interview_score if interview_score is not None else 0.0,
            required_skills=a.skills_match_score
        )
        if a.overall_ranking_score != overall_fit:
            a.overall_ranking_score = overall_fit
            db.commit()

        if has_report:
            assessment_status = "Completed"
        elif session and session.flagged_for_review:
            assessment_status = "Terminated (Flagged)"
        elif session and session.status == "in_progress":
            assessment_status = "Interview In Progress"
        elif a.status == "interview_pending":
            assessment_status = "Assessment Pending"
        else:
            assessment_status = "Interview Not Started"

        out = ApplicationOut.model_validate(a)
        out.candidate_name = cand.full_name if cand else "Candidate"
        out.candidate_email = cand.email if cand else ""
        out.anonymized_alias = alias
        out.interview_score = interview_score
        out.interview_status = session.status if session else "not_started"
        out.report_id = report.id if report else None
        out.assessment_status = assessment_status
        out.overall_ranking_score = overall_fit
        out.job = JobSummary(id=job.id, title=job.title, department=job.department, location=job.location)
        results.append(out)
    return results

@router.get("/{application_id}/scorecard")
def get_application_scorecard(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authoritative Candidate Assessment & Evaluation Scorecard.
    Provides complete 5-dimension breakdown, question-wise evaluations with original transcripts,
    AI warnings, proctoring security audit, and composite fit calculations.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application record not found")

    job = app.job
    cand = app.candidate
    profile = cand.candidate_profile if cand else None

    # Role-based access control
    if current_user.role == "candidate":
        if app.candidate_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif current_user.role == "hr":
        membership = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == current_user.id).first()
        if not membership or job.organization_id != membership.organization_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to candidate from another organization")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized role")

    # Fetch interview session, questions, answers, and report
    session = db.query(InterviewSession).filter(InterviewSession.application_id == app.id).first()
    report = session.report if session else None
    has_report = report is not None

    interview_score = report.overall_score if has_report else (0.0 if session and session.status == "completed" else None)

    # Calculate authoritative composite overall fit
    overall_fit = calculate_composite_rank_score(
        resume_match=app.resume_match_score,
        interview_score=report.overall_score if has_report else 0.0,
        required_skills=app.skills_match_score
    )

    # 5-Dimensional breakdown with raw scores and weighted contributions
    tech_val = report.technical_rating if has_report else 0.0
    ps_val = report.problem_solving_rating if has_report else 0.0
    skills_val = report.skills_rating if has_report else 0.0
    comm_val = report.communication_rating if has_report else 0.0
    proj_val = report.project_rating if has_report else 0.0

    dimensions = [
        {
            "key": "technical_depth",
            "name": "Technical Depth",
            "weight": 0.35,
            "weight_pct": 35,
            "raw_score": tech_val,
            "weighted_score": round(tech_val * 0.35, 2),
            "explanation": "Evaluates architectural correctness, algorithm mastery, and foundational precision.",
            "evidence": f"Demonstrated domain accuracy of {tech_val}% across core role requirements."
        },
        {
            "key": "problem_solving",
            "name": "Problem Solving",
            "weight": 0.25,
            "weight_pct": 25,
            "raw_score": ps_val,
            "weighted_score": round(ps_val * 0.25, 2),
            "explanation": "Approach to resolving production blockers, decomposing complexities, and handling edge cases.",
            "evidence": f"Analytical reasoning scored at {ps_val}% based on trade-off articulations."
        },
        {
            "key": "job_skills",
            "name": "Job Skills Application",
            "weight": 0.20,
            "weight_pct": 20,
            "raw_score": skills_val,
            "weighted_score": round(skills_val * 0.20, 2),
            "explanation": "Practical mastery of specific technologies required for this vacancy.",
            "evidence": f"Alignment with required stack: {skills_val}%."
        },
        {
            "key": "communication",
            "name": "Communication Clarity",
            "weight": 0.10,
            "weight_pct": 10,
            "raw_score": comm_val,
            "weighted_score": round(comm_val * 0.10, 2),
            "explanation": "Conciseness, structured thought progression, and active listening precision.",
            "evidence": f"Articulation clarity scored at {comm_val}%."
        },
        {
            "key": "project_depth",
            "name": "Project Experience Depth",
            "weight": 0.10,
            "weight_pct": 10,
            "raw_score": proj_val,
            "weighted_score": round(proj_val * 0.10, 2),
            "explanation": "Concrete evidence of high-impact engineering ownership and measurable outcomes.",
            "evidence": f"Real-world delivery impact assessed at {proj_val}%."
        }
    ]

    # Question-wise evaluations with original transcripts
    question_evaluations = []
    ai_quality_warnings = []

    if session:
        # Load questions in chronological order
        questions = db.query(InterviewQuestion).filter(
            InterviewQuestion.session_id == session.id
        ).order_by(InterviewQuestion.question_index.asc()).all()

        for q in questions:
            ans = db.query(InterviewAnswer).filter(InterviewAnswer.question_id == q.id).first()
            ans_text = ans.candidate_answer if ans else ""
            words = ans_text.split()
            word_count = len(words)

            # Check for AI evaluation alerts
            if ans and word_count < 6 and ans_text:
                ai_quality_warnings.append(
                    f"Question {q.question_index + 1}: Answer was brief ({word_count} words). Evaluator applied minimum brevity penalty."
                )
            elif ans and len(set(w.lower() for w in words)) / max(word_count, 1) < 0.35 and word_count > 6:
                ai_quality_warnings.append(
                    f"Question {q.question_index + 1}: High lexical repetition or filler phrasing detected. Manual HR review recommended."
                )

            question_evaluations.append({
                "question_id": q.id,
                "question_index": q.question_index + 1,
                "category": q.category.replace('_', ' ').capitalize(),
                "question_text": q.question_text,
                "candidate_answer": ans_text or "No answer submitted.",
                "word_count": word_count,
                "score": ans.composite_score if ans else 0.0,
                "dimension_scores": {
                    "technical": ans.technical_score if ans else 0.0,
                    "problem_solving": ans.problem_solving_score if ans else 0.0,
                    "skills": ans.skills_score if ans else 0.0,
                    "communication": ans.communication_score if ans else 0.0,
                    "project": ans.project_score if ans else 0.0,
                } if ans else {},
                "feedback": ans.feedback if ans else "Question not yet answered.",
                "expected_concepts": job.required_skills[:3]
            })

    if session and session.flagged_for_review:
        ai_quality_warnings.append(
            f"Proctoring Security Alert: Interview session reached {session.violation_count} security interruptions and was flagged for human recruiter inspection."
        )

    # Proctoring security violations
    violations_data = []
    if session and session.violations:
        violations_data = [
            {
                "id": v.id,
                "violation_type": v.violation_type,
                "violation_number": v.violation_number,
                "description": v.description,
                "occurred_at": v.occurred_at
            }
            for v in session.violations
        ]

    # Status label
    if has_report:
        assessment_status = "Completed"
    elif session and session.flagged_for_review:
        assessment_status = "Terminated (Flagged)"
    elif session and session.status == "in_progress":
        assessment_status = "Interview In Progress"
    elif app.status == "interview_pending":
        assessment_status = "Assessment Pending"
    else:
        assessment_status = "Interview Not Started"

    # Current HR hiring decision
    decision_record = app.hiring_decision

    return {
        "candidate": {
            "id": cand.id,
            "name": cand.full_name if (current_user.role == "hr" or current_user.id == cand.id) else "Candidate",
            "email": cand.email if (current_user.role == "hr" or current_user.id == cand.id) else "",
            "anonymized_alias": profile.anonymized_alias if profile else f"Candidate #{cand.id[:4].upper()}",
            "headline": profile.headline if profile else "Professional Candidate",
            "skills": profile.skills if profile else [],
            "education": profile.education if profile else "Not provided",
            "experience_years": profile.experience_years if profile else 0.0
        },
        "application": {
            "id": app.id,
            "job_id": job.id,
            "job_title": job.title,
            "department": job.department,
            "applied_at": app.applied_at,
            "status": app.status,
            "resume_file_id": app.resume_file_id,
            "resume_file_name": app.resume_file.file_name if app.resume_file else None
        },
        "assessment_meta": {
            "has_interview": has_report,
            "session_id": session.id if session else None,
            "assessment_status": assessment_status,
            "interview_date": session.completed_at if session else None,
            "rubric_version": report.rubric_version if report else "2026.1",
            "scoring_formula_version": "2026.2"
        },
        "scores": {
            "interview_score": interview_score,
            "resume_match_score": app.resume_match_score,
            "skills_match_score": app.skills_match_score,
            "overall_candidate_fit": overall_fit,
            "formula_breakdown": {
                "formula": "Overall Candidate Fit = (Resume Match × 0.40) + (Interview Assessment × 0.40) + (Verified Skills × 0.20)",
                "resume_component": round(app.resume_match_score * 0.40, 2),
                "interview_component": round((report.overall_score if has_report else 0.0) * 0.40, 2),
                "skills_component": round(app.skills_match_score * 0.20, 2),
                "total": overall_fit
            }
        },
        "dimensions": dimensions,
        "question_evaluations": question_evaluations,
        "strengths": report.strengths if report else [f"Resume alignment with {len(profile.skills if profile else [])} skills"],
        "weaknesses": report.weaknesses if report else ["Interview assessment not completed yet"],
        "skill_gap_summary": report.skill_gap_summary if report else "Assessment pending interview completion.",
        "suggestions_for_improvement": report.suggestions_for_improvement if report else "Complete the interactive AI voice interview.",
        "ai_quality_warnings": ai_quality_warnings,
        "evaluation_limitations": "Scores represent automated AI screening evidence. Final hiring decisions rest solely with authorized human recruiters.",
        "recruiter_confidential_notes": report.recruiter_confidential_notes if (current_user.role == "hr" and report) else None,
        "security_audit": {
            "violation_count": session.violation_count if session else 0,
            "max_violations": session.max_violations if session else 3,
            "flagged_for_review": session.flagged_for_review if session else False,
            "termination_reason": session.termination_reason if session else None,
            "violations": violations_data
        } if session else None,
        "hiring_decision": {
            "decision": decision_record.decision,
            "rationale": decision_record.rationale,
            "decided_at": decision_record.decided_at
        } if decision_record else None
    }

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
        details_json={
            "candidate_id": app.candidate_id,
            "candidate_name": app.candidate.full_name if (app.candidate and app.candidate.full_name) else "Candidate",
            "job_id": app.job_id,
            "job_title": app.job.title if app.job else "Position",
            "company_name": membership.organization.name if membership.organization else "Company",
            "prev_status": prev_status,
            "new_status": status_update.status,
            "notes": status_update.note or f"Application status changed to {status_update.status.replace('_', ' ').title()}."
        }
    )

    out = ApplicationOut.model_validate(app)
    out.job = JobSummary(id=app.job.id, title=app.job.title, department=app.job.department, location=app.job.location)
    return out

@router.post("/{application_id}/decision", response_model=ApplicationDecisionResponse)
def submit_application_decision(
    application_id: str,
    payload: ApplicationDecisionRequest,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """
    Unified Application Hiring Decision Endpoint:
    POST /api/v1/applications/{application_id}/decision
    Accepts: { "decision": "ACCEPTED"|"REJECTED", "decision_notes": "..." }
    """
    from app.services.decision_service import record_hr_decision_workflow
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

@router.post("/{application_id}/accept")
def accept_application_route(
    application_id: str,
    action_in: DecisionActionRequest,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """Direct HR Accept action endpoint with mandatory decision notes."""
    from app.api.v1.decisions import accept_candidate_application
    return accept_candidate_application(
        application_id=application_id,
        action_in=action_in,
        hr_user=hr_user,
        membership=membership,
        db=db
    )

@router.post("/{application_id}/reject")
def reject_application_route(
    application_id: str,
    action_in: DecisionActionRequest,
    hr_user: User = Depends(require_hr),
    membership: OrganizationMembership = Depends(get_current_hr_membership),
    db: Session = Depends(get_db)
):
    """Direct HR Reject action endpoint with mandatory rejection notes."""
    from app.api.v1.decisions import reject_candidate_application
    return reject_candidate_application(
        application_id=application_id,
        action_in=action_in,
        hr_user=hr_user,
        membership=membership,
        db=db
    )
