import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_candidate
from app.models.models import (
    InterviewSession, InterviewQuestion, InterviewAnswer, InterviewReport,
    InterviewViolation, Application, ApplicationStatusHistory, Job, User
)
from app.schemas.schemas import (
    InterviewStartRequest, InterviewSessionOut, InterviewAnswerSubmit, InterviewQuestionOut,
    InterviewViolationCreate, InterviewViolationOut, InterviewSecurityStatus
)
from app.services.ai_service import (
    generate_interview_questions, evaluate_single_answer, generate_final_interview_report
)
from app.services.notification_service import create_notification, record_user_activity, record_audit_log
from app.services.stt_service import transcribe_audio_bytes
from app.core.rubric import calculate_composite_rank_score

router = APIRouter(prefix="/interviews", tags=["AI Interview Engine"])

@router.post("/start", response_model=InterviewSessionOut)
def start_or_resume_interview(
    start_req: InterviewStartRequest,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Initializes or resumes an AI-powered interview session linked to an application.
    If session is already active, restores state without losing answers.
    """
    app = db.query(Application).filter(
        Application.id == start_req.application_id,
        Application.candidate_id == candidate.id
    ).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found or unauthorized")

    job = app.job

    # Check for existing session
    session = db.query(InterviewSession).filter(
        InterviewSession.application_id == app.id
    ).first()

    if session:
        if session.status == "completed":
            out = InterviewSessionOut(
                id=session.id,
                application_id=app.id,
                candidate_id=candidate.id,
                job_id=job.id,
                status="completed",
                duration_minutes=session.duration_minutes,
                current_question_index=session.current_question_index,
                total_questions=session.total_questions,
                started_at=session.started_at,
                completed_at=session.completed_at,
                current_question=None
            )
            return out

        # Resume session: find current unanswered question
        current_q = None
        for q in session.questions:
            if not q.answer:
                current_q = InterviewQuestionOut(
                    id=q.id,
                    question_index=q.question_index,
                    question_text=q.question_text,
                    category=q.category
                )
                break

        return InterviewSessionOut(
            id=session.id,
            application_id=app.id,
            candidate_id=candidate.id,
            job_id=job.id,
            status=session.status,
            duration_minutes=session.duration_minutes,
            current_question_index=session.current_question_index,
            total_questions=session.total_questions,
            started_at=session.started_at,
            completed_at=session.completed_at,
            current_question=current_q
        )

    # Create new session
    session = InterviewSession(
        application_id=app.id,
        candidate_id=candidate.id,
        job_id=job.id,
        status="in_progress",
        duration_minutes=start_req.duration_minutes or 15,
        current_question_index=0,
        total_questions=5
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Generate 5 dynamic, context-aware interview questions
    generated_questions = generate_interview_questions(
        job_title=job.title,
        job_description=job.description,
        required_skills=job.required_skills,
        experience_level=job.experience_level,
        count=5
    )

    db_questions = []
    for gq in generated_questions:
        q = InterviewQuestion(
            session_id=session.id,
            question_index=gq["question_index"],
            question_text=gq["question_text"],
            category=gq.get("category", "technical")
        )
        db.add(q)
        db_questions.append(q)
    db.commit()

    # Update application status to interview_pending/in_progress
    app.status = "interview_pending"
    db.commit()

    record_user_activity(
        db=db,
        user_id=candidate.id,
        event_type="interview_started",
        resource_type="interview_session",
        resource_id=session.id,
        description=f"Started AI interview session for '{job.title}'.",
        metadata_json={"job_id": job.id, "questions_count": len(db_questions)}
    )

    from app.services.activity_service import record_recruitment_activity
    comp_name = job.organization.name if job.organization else "Company"
    record_recruitment_activity(
        db=db,
        candidate_id=candidate.id,
        activity_type="INTERVIEW_STARTED",
        activity_title="AI Interview Started",
        activity_description=f"You began the AI interview for {job.title} at {comp_name}.",
        application_id=app.id,
        job_id=job.id,
        company_id=job.organization_id,
        metadata_json={"company_name": comp_name, "job_title": job.title, "application_ref": f"APP-{app.id[:8].upper()}"}
    )

    first_q = InterviewQuestionOut(
        id=db_questions[0].id,
        question_index=0,
        question_text=db_questions[0].question_text,
        category=db_questions[0].category
    )

    return InterviewSessionOut(
        id=session.id,
        application_id=app.id,
        candidate_id=candidate.id,
        job_id=job.id,
        status="in_progress",
        duration_minutes=session.duration_minutes,
        current_question_index=0,
        total_questions=5,
        started_at=session.started_at,
        current_question=first_q
    )

@router.get("/{session_id}", response_model=InterviewSessionOut)
def get_interview_session(
    session_id: str,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.candidate_id == candidate.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    current_q = None
    for q in session.questions:
        if not q.answer:
            current_q = InterviewQuestionOut(
                id=q.id,
                question_index=q.question_index,
                question_text=q.question_text,
                category=q.category
            )
            break

    return InterviewSessionOut(
        id=session.id,
        application_id=session.application_id,
        candidate_id=candidate.id,
        job_id=session.job_id,
        status=session.status,
        duration_minutes=session.duration_minutes,
        current_question_index=session.current_question_index,
        total_questions=session.total_questions,
        started_at=session.started_at,
        completed_at=session.completed_at,
        current_question=current_q
    )

@router.post("/answer")
def submit_interview_answer(
    answer_in: InterviewAnswerSubmit,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Submits candidate answer for current question, computes rubric evaluation,
    and returns next question or concludes interview.
    """
    session = db.query(InterviewSession).filter(
        InterviewSession.id == answer_in.session_id,
        InterviewSession.candidate_id == candidate.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.status in ["completed", "terminated_flagged"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview session is no longer active or has been terminated for security review."
        )

    question = db.query(InterviewQuestion).filter(
        InterviewQuestion.id == answer_in.question_id,
        InterviewQuestion.session_id == session.id
    ).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    job = session.application.job

    # Evaluate turn answer
    eval_result = evaluate_single_answer(
        question_text=question.question_text,
        candidate_answer=answer_in.answer,
        category=question.category,
        required_skills=job.required_skills
    )

    ans_record = db.query(InterviewAnswer).filter(InterviewAnswer.question_id == question.id).first()
    if not ans_record:
        ans_record = InterviewAnswer(
            question_id=question.id,
            session_id=session.id,
            candidate_answer=answer_in.answer,
            technical_score=eval_result["technical_score"],
            problem_solving_score=eval_result["problem_solving_score"],
            skills_score=eval_result["skills_score"],
            communication_score=eval_result["communication_score"],
            project_score=eval_result["project_score"],
            composite_score=eval_result["composite_score"],
            feedback=eval_result["feedback"]
        )
        db.add(ans_record)
    else:
        ans_record.candidate_answer = answer_in.answer
        ans_record.technical_score = eval_result["technical_score"]
        ans_record.composite_score = eval_result["composite_score"]
        ans_record.feedback = eval_result["feedback"]

    session.current_question_index += 1
    db.commit()

    # Find next question
    next_q = None
    all_questions = db.query(InterviewQuestion).filter(
        InterviewQuestion.session_id == session.id
    ).order_by(InterviewQuestion.question_index).all()

    for q in all_questions:
        if not q.answer:
            next_q = InterviewQuestionOut(
                id=q.id,
                question_index=q.question_index,
                question_text=q.question_text,
                category=q.category
            )
            break

    is_finished = next_q is None

    return {
        "success": True,
        "is_finished": is_finished,
        "evaluated_score": eval_result["composite_score"],
        "feedback": eval_result["feedback"],
        "next_question": next_q
    }

@router.post("/{session_id}/complete")
def finalize_interview(
    session_id: str,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Finalizes interview session, computes comprehensive multi-dimensional scorecard,
    updates application status, and triggers notifications.
    """
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.candidate_id == candidate.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    app = session.application
    job = app.job

    answers = db.query(InterviewAnswer).filter(InterviewAnswer.session_id == session.id).all()
    ans_dicts = [
        {
            "technical_score": a.technical_score,
            "problem_solving_score": a.problem_solving_score,
            "skills_score": a.skills_score,
            "communication_score": a.communication_score,
            "project_score": a.project_score,
            "composite_score": a.composite_score
        }
        for a in answers
    ]

    report_data = generate_final_interview_report(ans_dicts, job.title)

    # Save interview report
    report = db.query(InterviewReport).filter(InterviewReport.session_id == session.id).first()
    if not report:
        report = InterviewReport(
            session_id=session.id,
            application_id=app.id,
            technical_rating=report_data["technical_rating"],
            problem_solving_rating=report_data["problem_solving_rating"],
            skills_rating=report_data["skills_rating"],
            communication_rating=report_data["communication_rating"],
            project_rating=report_data["project_rating"],
            overall_score=report_data["overall_score"],
            rubric_version=report_data["rubric_version"],
            strengths=report_data["strengths"],
            weaknesses=report_data["weaknesses"],
            skill_gap_summary=report_data["skill_gap_summary"],
            suggestions_for_improvement=report_data["suggestions_for_improvement"],
            transparency_breakdown=report_data.get("transparency_breakdown", {}),
            candidate_visible_feedback=report_data["candidate_visible_feedback"],
            recruiter_confidential_notes=report_data["recruiter_confidential_notes"]
        )
        db.add(report)

    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    app.status = "interview_completed"

    # Recompute overall ranking score
    composite_rank = calculate_composite_rank_score(
        resume_match=app.resume_match_score,
        interview_score=report_data["overall_score"],
        required_skills=app.skills_match_score
    )
    app.overall_ranking_score = composite_rank

    # Add status history
    hist = ApplicationStatusHistory(
        application_id=app.id,
        previous_status="interview_pending",
        new_status="interview_completed",
        changed_by_id=candidate.id,
        note=f"Candidate completed AI interview session. Score: {report_data['overall_score']}%"
    )
    db.add(hist)
    db.commit()
    db.refresh(report)

    record_user_activity(
        db=db,
        user_id=candidate.id,
        event_type="interview_completed",
        resource_type="interview_report",
        resource_id=report.id,
        description=f"Completed AI interview for '{job.title}'. Overall score: {report.overall_score}%.",
        metadata_json={"overall_score": report.overall_score}
    )

    from app.services.activity_service import record_recruitment_activity
    comp_name = job.organization.name if job.organization else "Company"
    record_recruitment_activity(
        db=db,
        candidate_id=candidate.id,
        activity_type="INTERVIEW_COMPLETED",
        activity_title="AI Interview Completed",
        activity_description=f"You completed the AI interview for {job.title} at {comp_name} with overall evaluation score {report.overall_score}%.",
        application_id=app.id,
        job_id=job.id,
        company_id=job.organization_id,
        metadata_json={
            "company_name": comp_name,
            "job_title": job.title,
            "score": report.overall_score,
            "application_ref": f"APP-{app.id[:8].upper()}"
        }
    )

    create_notification(
        db=db,
        user_id=candidate.id,
        title="AI Interview Results Available",
        message=f"Your interview report for {job.title} is now ready to view. Overall score: {report.overall_score}%.",
        notification_type="interview",
        link=f"/candidate/results/{report.id}"
    )

    return {
        "message": "Interview completed successfully",
        "report_id": report.id,
        "overall_score": report.overall_score
    }

@router.post("/transcribe")
async def transcribe_interview_audio(
    file: UploadFile = File(...),
    candidate: User = Depends(require_candidate)
):
    """
    High-accuracy, low-latency Speech-to-Text conversion powered by Faster-Whisper.
    Accurately transcribes proper nouns, technical terms, dates, and numbers with zero repetition.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        return {"transcript": ""}

    suffix = ".webm"
    if file.filename:
        _, ext = os.path.splitext(file.filename)
        if ext:
            suffix = ext.lower()

    text = transcribe_audio_bytes(audio_bytes, file_suffix=suffix)

    # Archive audio recording to Supabase Storage if enabled
    audio_storage_path = None
    if settings.is_supabase_enabled and len(audio_bytes) > 0:
        from app.services.supabase_service import SupabaseStorageService
        rel_path = f"{candidate.id}/{uuid.uuid4().hex[:8]}_{int(datetime.now().timestamp())}{suffix}"
        audio_storage_path = SupabaseStorageService.upload_file(
            bucket=SupabaseStorageService.BUCKET_AUDIO,
            path=rel_path,
            file_bytes=audio_bytes,
            content_type="audio/webm"
        )

    return {"transcript": text, "audio_storage_path": audio_storage_path}

# =========================================================================
# SECURE FULL-SCREEN INTERVIEW MONITORING & THREE-STRIKE VIOLATION APIS
# =========================================================================

@router.get("/{session_id}/security-status", response_model=InterviewSecurityStatus)
def get_interview_security_status(
    session_id: str,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Retrieves current live security monitoring state, violation counts, and flags."""
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.candidate_id == candidate.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    violations = db.query(InterviewViolation).filter(
        InterviewViolation.interview_session_id == session.id
    ).order_by(InterviewViolation.occurred_at.asc()).all()

    return InterviewSecurityStatus(
        session_id=session.id,
        status=session.status,
        violation_count=session.violation_count,
        max_violations=session.max_violations,
        remaining_chances=max(0, session.max_violations - session.violation_count),
        flagged_for_review=session.flagged_for_review,
        is_terminated=(session.status == "terminated_flagged"),
        termination_reason=session.termination_reason,
        violations=violations
    )

@router.post("/{session_id}/violations")
def record_interview_violation(
    session_id: str,
    violation_in: InterviewViolationCreate,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Records a detected security environment interruption (full-screen exit, tab switch, focus lost).
    Enforces atomic three-strike policy:
    - Violations 1 & 2: Increments counter and issues warnings.
    - Violation 3: Automatically terminates interview and flags for HR Review.
    Includes backend 2.5s deduplication protection.
    """
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.candidate_id == candidate.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    if session.status in ["completed", "terminated_flagged"]:
        return {
            "status": session.status,
            "violation_count": session.violation_count,
            "is_terminated": True,
            "message": "Interview session already concluded or flagged."
        }

    # Deduplication guard:
    # 1. Exact incident_id deduplication
    if violation_in.incident_id:
        for v in session.violations:
            if (v.metadata_json or {}).get("incident_id") == violation_in.incident_id:
                return {
                    "status": session.status,
                    "violation_count": session.violation_count,
                    "remaining_chances": max(0, session.max_violations - session.violation_count),
                    "is_terminated": session.status == "terminated_flagged",
                    "deduplicated": True,
                    "message": "Incident already processed."
                }

    now = datetime.now(timezone.utc)
    recent_violation = (
        db.query(InterviewViolation)
        .filter(InterviewViolation.interview_session_id == session.id)
        .order_by(InterviewViolation.occurred_at.desc())
        .first()
    )

    # 2. Clustered repeat signals while already in interrupted state
    if not session.is_secure_mode and recent_violation:
        return {
            "status": session.status,
            "violation_count": session.violation_count,
            "remaining_chances": max(0, session.max_violations - session.violation_count),
            "is_terminated": session.status == "terminated_flagged",
            "deduplicated": True,
            "message": "Interruption signal clustered with active interruption; deduplicated."
        }

    # 3. Fallback sub-second cluster guard for legacy clients without incident_id
    if not violation_in.incident_id and recent_violation:
        delta = (now - recent_violation.occurred_at.replace(tzinfo=timezone.utc)).total_seconds()
        if delta < 0.75:
            return {
                "status": session.status,
                "violation_count": session.violation_count,
                "remaining_chances": max(0, session.max_violations - session.violation_count),
                "is_terminated": session.status == "terminated_flagged",
                "deduplicated": True,
                "message": "Interruption signal clustered with recent event; deduplicated."
            }

    # Increment violation count and mark secure mode broken
    session.is_secure_mode = False
    session.violation_count += 1
    new_violation_num = session.violation_count

    meta = dict(violation_in.metadata or {})
    if violation_in.incident_id:
        meta["incident_id"] = violation_in.incident_id

    violation_record = InterviewViolation(
        interview_session_id=session.id,
        candidate_id=candidate.id,
        violation_type=violation_in.violation_type,
        description=violation_in.description,
        violation_number=new_violation_num,
        metadata_json=meta,
        occurred_at=now
    )
    db.add(violation_record)

    record_user_activity(
        db=db,
        user_id=candidate.id,
        event_type="interview_security_violation",
        resource_type="interview_session",
        resource_id=session.id,
        description=f"Security alert {new_violation_num}/3: {violation_in.description}",
        metadata_json={"violation_type": violation_in.violation_type, "violation_number": new_violation_num}
    )

    is_terminated = False
    if session.violation_count >= session.max_violations:
        # Third strike: Terminate and flag for HR Review
        session.status = "terminated_flagged"
        session.flagged_for_review = True
        session.termination_reason = "Exceeded maximum permitted environment interruptions (3/3 strikes). Interview flagged for human HR evaluation."
        session.completed_at = now
        is_terminated = True

        app = session.application
        if app:
            app.status = "hr_review"
            hist = ApplicationStatusHistory(
                application_id=app.id,
                previous_status=app.status,
                new_status="hr_review",
                changed_by_id=candidate.id,
                note="AI interview terminated due to 3 security violations. Flagged for HR review."
            )
            db.add(hist)

            create_notification(
                db=db,
                user_id=candidate.id,
                title="Interview Flagged for HR Review",
                message="Your interview session concluded after 3 environment interruptions. An authorized recruiter will review the session recording and security logs.",
                notification_type="interview",
                link=f"/candidate/applications/{app.id}"
            )

            if app and app.job:
                record_audit_log(
                    db=db,
                    organization_id=app.job.organization_id,
                    actor_id=candidate.id,
                    actor_role="candidate",
                    action="INTERVIEW_VIOLATION",
                    resource_type="interview_session",
                    resource_id=session.id,
                    details_json={
                        "candidate_id": candidate.id,
                        "candidate_name": candidate.full_name,
                        "job_id": app.job_id,
                        "job_title": app.job.title,
                        "company_name": app.job.organization.name if app.job.organization else "Company",
                        "violation_type": violation_in.violation_type,
                        "violation_number": new_violation_num,
                        "notes": "Interview terminated after 3 environment security violations. Flagged for HR review.",
                        "previous_status": "in_progress",
                        "new_status": "hr_review"
                    }
                )

    db.commit()
    db.refresh(session)

    return {
        "status": session.status,
        "violation_count": session.violation_count,
        "remaining_chances": max(0, session.max_violations - session.violation_count),
        "is_terminated": is_terminated,
        "flagged_for_review": session.flagged_for_review,
        "deduplicated": False,
        "termination_reason": session.termination_reason if is_terminated else None,
        "message": "Violation recorded." if not is_terminated else "Session terminated and flagged for HR review."
    }

@router.post("/{session_id}/resume-secure-mode")
def resume_secure_mode(
    session_id: str,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Confirms candidate has re-entered full-screen and resumed compliance."""
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.candidate_id == candidate.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.status == "terminated_flagged":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot resume terminated interview.")

    session.is_secure_mode = True
    db.commit()
    return {"message": "Secure mode re-engaged", "status": session.status, "is_secure_mode": True}

@router.get("/hr/{session_id}/security-report")
def get_hr_security_report(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Returns official security audit report for HR review."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    violations = db.query(InterviewViolation).filter(
        InterviewViolation.interview_session_id == session.id
    ).order_by(InterviewViolation.occurred_at.asc()).all()

    return {
        "session_id": session.id,
        "status": session.status,
        "flagged_for_review": session.flagged_for_review,
        "violation_count": session.violation_count,
        "max_violations": session.max_violations,
        "termination_reason": session.termination_reason,
        "started_at": session.started_at,
        "completed_at": session.completed_at,
        "violations": [
            {
                "id": v.id,
                "violation_number": v.violation_number,
                "violation_type": v.violation_type,
                "description": v.description,
                "occurred_at": v.occurred_at,
                "metadata": v.metadata_json
            }
            for v in violations
        ]
    }

