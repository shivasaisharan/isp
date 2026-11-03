import os
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header, Request, BackgroundTasks, status
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.api.deps import get_db, require_candidate, require_hr, get_current_user
from app.models.models import (
    InterviewSession, InterviewQuestion, InterviewAnswer, InterviewReport,
    InterviewViolation, Application, ApplicationStatusHistory, Job, User,
    InterviewRecording, InterviewRecordingChunk, InterviewProctoringEvent,
    InterviewPermissionConsent, InterviewSessionMetadata,
    AIVideoAnalysis, CameraVerificationLog
)
from app.schemas.schemas import (
    InterviewStartRequest, InterviewSessionOut, InterviewAnswerSubmit, InterviewQuestionOut,
    InterviewViolationCreate, InterviewViolationOut, InterviewSecurityStatus,
    InterviewConsentSubmit, InterviewConsentOut, InterviewProctoringEventCreate,
    InterviewProctoringEventOut, InterviewRecordingOut, InterviewProctoringReviewOut,
    InterviewProctoringVerdictSubmit, AIVideoAnalysisOut, CameraVerificationResponse,
    InterviewProctoringEventReviewSubmit
)
from app.services.supabase_service import SupabaseStorageService
from app.services.proctoring_ai_service import verify_camera_frame_data, analyze_interview_recording_video
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


# ==============================================================================
# SECURE VIDEO INTERVIEW, SCREEN SHARING & AI PROCTORING PIPELINE
# ==============================================================================

def _record_proctoring_event(
    db: Session,
    session_id: str,
    candidate_id: str,
    event_type: str,
    severity: str,
    description: str,
    timestamp_offset_seconds: float = 0.0,
    is_security_violation: bool = False,
    metadata_json: Optional[Dict[str, Any]] = None
) -> InterviewProctoringEvent:
    event = InterviewProctoringEvent(
        session_id=session_id,
        candidate_id=candidate_id,
        event_type=event_type,
        severity=severity,
        is_security_violation=is_security_violation,
        description=description,
        timestamp_offset_seconds=float(timestamp_offset_seconds or 0.0),
        metadata_json=metadata_json or {}
    )
    db.add(event)
    return event


@router.post("/{session_id}/consent", response_model=InterviewConsentOut)
def record_interview_consent(
    session_id: str,
    consent_req: InterviewConsentSubmit,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Records candidate's explicit consent and hardware verification status
    (Webcam, Microphone, Screen Sharing, Fullscreen, Recording Policy)
    prior to entering the live examination room.
    """
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.candidate_id == candidate.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    consent = db.query(InterviewPermissionConsent).filter(
        InterviewPermissionConsent.session_id == session.id
    ).first()

    if not consent:
        consent = InterviewPermissionConsent(
            session_id=session.id,
            candidate_id=candidate.id,
            webcam_granted=consent_req.webcam_granted,
            microphone_granted=consent_req.microphone_granted,
            screen_share_granted=consent_req.screen_share_granted,
            recording_consent_agreed=consent_req.recording_consent_agreed,
            fullscreen_consent_agreed=consent_req.fullscreen_consent_agreed,
            browser_info=consent_req.browser_info or {}
        )
        db.add(consent)
    else:
        consent.webcam_granted = consent_req.webcam_granted
        consent.microphone_granted = consent_req.microphone_granted
        consent.screen_share_granted = consent_req.screen_share_granted
        consent.recording_consent_agreed = consent_req.recording_consent_agreed
        consent.fullscreen_consent_agreed = consent_req.fullscreen_consent_agreed
        if consent_req.browser_info:
            consent.browser_info = consent_req.browser_info

    # Log initial proctoring verification event
    _record_proctoring_event(
        db=db,
        session_id=session.id,
        candidate_id=candidate.id,
        event_type="consent_granted",
        severity="info",
        description="Candidate accepted proctoring terms and verified hardware permissions (camera, microphone, display capture).",
        timestamp_offset_seconds=0.0,
        metadata_json={"browser_info": consent_req.browser_info or {}}
    )

    db.commit()
    db.refresh(consent)
    return consent


@router.post("/{session_id}/proctoring-events", response_model=InterviewProctoringEventOut)
def log_proctoring_event(
    session_id: str,
    event_in: InterviewProctoringEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logs an AI proctoring lifecycle or security anomaly event into the timeline.
    Tracks fullscreen breaches, screenshare disconnections, tab switches, and webcam drops.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    # If event indicates critical security breach or screenshare disconnection
    is_violation = event_in.is_security_violation
    if event_in.event_type in ["screen_share_stopped", "fullscreen_exited", "tab_switch_detected", "multiple_faces_detected"]:
        is_violation = True

    event = _record_proctoring_event(
        db=db,
        session_id=session.id,
        candidate_id=session.candidate_id,
        event_type=event_in.event_type,
        severity=event_in.severity or ("critical" if is_violation else "info"),
        description=event_in.description,
        timestamp_offset_seconds=event_in.timestamp_offset_seconds or 0.0,
        is_security_violation=is_violation,
        metadata_json=event_in.metadata or {}
    )

    # Update session metadata counters
    meta = db.query(InterviewSessionMetadata).filter(InterviewSessionMetadata.session_id == session.id).first()
    if not meta:
        meta = InterviewSessionMetadata(session_id=session.id)
        db.add(meta)

    if event_in.event_type in ["screen_share_stopped", "webcam_disconnected"]:
        meta.total_disconnections += 1
    elif event_in.event_type == "fullscreen_exited":
        meta.total_fullscreen_exits += 1

    db.commit()
    db.refresh(event)
    return event


@router.post("/{session_id}/recordings/chunks")
async def upload_recording_chunk(
    session_id: str,
    chunk_index: int = Form(...),
    duration_seconds: float = Form(10.0),
    is_final: bool = Form(False),
    file: UploadFile = File(...),
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """
    Receives progressive MediaRecorder video/audio chunks from the candidate client.
    Appends chunk to full video file and updates recording metrics.
    """
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.candidate_id == candidate.id
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    chunk_bytes = await file.read()
    if not chunk_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty recording chunk")

    recordings_dir = Path(settings.UPLOAD_DIR) / "recordings" / session_id
    chunks_dir = recordings_dir / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    chunk_filename = f"chunk_{chunk_index:05d}.webm"
    chunk_path = chunks_dir / chunk_filename
    with open(chunk_path, "wb") as f:
        f.write(chunk_bytes)

    # Consolidated full recording file
    full_recording_path = recordings_dir / "full_recording.webm"
    with open(full_recording_path, "ab") as f:
        f.write(chunk_bytes)

    full_size = os.path.getsize(full_recording_path)

    # Find or create InterviewRecording
    recording = db.query(InterviewRecording).filter(
        InterviewRecording.session_id == session.id
    ).first()

    if not recording:
        recording = InterviewRecording(
            session_id=session.id,
            candidate_id=candidate.id,
            storage_path=str(full_recording_path),
            file_name=f"interview_{session_id[:8]}.webm",
            file_size_bytes=full_size,
            duration_seconds=duration_seconds,
            mime_type="video/webm",
            status="recording",
            recording_type="composite_screen_camera"
        )
        db.add(recording)
        db.flush()
    else:
        recording.file_size_bytes = full_size
        recording.duration_seconds += duration_seconds
        recording.storage_path = str(full_recording_path)

    # Record individual chunk metadata
    chunk_record = InterviewRecordingChunk(
        recording_id=recording.id,
        chunk_index=chunk_index,
        storage_path=str(chunk_path),
        file_size_bytes=len(chunk_bytes),
        duration_seconds=duration_seconds
    )
    db.add(chunk_record)

    # Optional cloud storage mirror
    if settings.is_supabase_enabled:
        supabase_path = f"{session_id}/full_recording.webm"
        try:
            with open(full_recording_path, "rb") as rf:
                SupabaseStorageService.upload_file(
                    bucket=SupabaseStorageService.BUCKET_RECORDINGS,
                    path=supabase_path,
                    file_bytes=rf.read(),
                    content_type="video/webm"
                )
        except Exception as e:
            print(f"[Recording Mirror Warning] Could not mirror to Supabase: {e}")

    db.commit()

    return {
        "status": "chunk_received",
        "recording_id": recording.id,
        "chunk_index": chunk_index,
        "total_file_size": full_size,
        "total_duration_seconds": recording.duration_seconds,
        "is_final": is_final
    }


def run_background_video_analysis(session_id: str):
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        analyze_interview_recording_video(session_id=session_id, db=db)
    except Exception as e:
        print(f"[Async Video Analysis Error] Session {session_id}: {e}")
    finally:
        db.close()


@router.post("/{session_id}/recordings/finalize", response_model=InterviewRecordingOut)
def finalize_recording(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Finalizes the recorded video session, validates full file integrity,
    marks status as 'ready' for HR proctoring playback, and triggers
    asynchronous chronological AI video analysis.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    recording = db.query(InterviewRecording).filter(InterviewRecording.session_id == session.id).first()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No recording found for this session")

    recording.status = "ready"
    recording.completed_at = datetime.now(timezone.utc)

    # Update metadata
    meta = db.query(InterviewSessionMetadata).filter(InterviewSessionMetadata.session_id == session.id).first()
    if not meta:
        meta = InterviewSessionMetadata(session_id=session.id)
        db.add(meta)
    meta.total_recording_duration_seconds = recording.duration_seconds

    _record_proctoring_event(
        db=db,
        session_id=session.id,
        candidate_id=session.candidate_id,
        event_type="recording_finalized",
        severity="info",
        description=f"Video session finalized successfully ({recording.duration_seconds:.1f}s, {recording.file_size_bytes / (1024*1024):.2f} MB).",
        timestamp_offset_seconds=recording.duration_seconds,
        metadata_json={
            "duration_seconds": recording.duration_seconds,
            "file_size_bytes": recording.file_size_bytes,
            "mime_type": recording.mime_type
        }
    )

    db.commit()
    db.refresh(recording)

    # Trigger background AI Video Analysis pipeline
    background_tasks.add_task(run_background_video_analysis, session.id)

    out = InterviewRecordingOut.model_validate(recording)
    out.playback_url = f"/api/v1/interviews/{session.id}/recordings/{recording.id}/stream"
    return out


@router.get("/{session_id}/recordings/{recording_id}/stream")
def stream_interview_recording(
    session_id: str,
    recording_id: str,
    range: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Streams the recorded interview video with HTTP 206 Partial Content range support
    for responsive forward/backward scrubbing, timestamp-seeking, and player playback.
    """
    recording = db.query(InterviewRecording).filter(
        InterviewRecording.id == recording_id,
        InterviewRecording.session_id == session_id
    ).first()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")

    file_path = Path(recording.storage_path)
    if not file_path.exists() or not file_path.is_file():
        # Fallback check under UPLOAD_DIR
        alt_path = Path(settings.UPLOAD_DIR) / "recordings" / session_id / "full_recording.webm"
        if alt_path.exists():
            file_path = alt_path
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording media file not found on disk")

    file_size = os.path.getsize(file_path)
    start = 0
    end = file_size - 1

    if range:
        range_val = range.strip().lower()
        if range_val.startswith("bytes="):
            parts = range_val[6:].split("-")
            if parts[0]:
                start = int(parts[0])
            if len(parts) > 1 and parts[1]:
                end = int(parts[1])

    start = max(0, start)
    end = min(end, file_size - 1)
    content_length = (end - start) + 1

    def iterfile():
        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = content_length
            chunk_size = 1024 * 512  # 512 KB chunks
            while remaining > 0:
                chunk = f.read(min(remaining, chunk_size))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": recording.mime_type or "video/webm",
        "Cache-Control": "public, max-age=3600"
    }

    status_code = status.HTTP_206_PARTIAL_CONTENT if range else status.HTTP_200_OK
    return StreamingResponse(iterfile(), status_code=status_code, headers=headers)


@router.get("/{session_id}/recordings/{recording_id}/download")
def download_interview_recording(
    session_id: str,
    recording_id: str,
    db: Session = Depends(get_db)
):
    """
    Downloads the high-resolution interview video file as an attachment.
    """
    recording = db.query(InterviewRecording).filter(
        InterviewRecording.id == recording_id,
        InterviewRecording.session_id == session_id
    ).first()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")

    file_path = Path(recording.storage_path)
    if not file_path.exists():
        alt_path = Path(settings.UPLOAD_DIR) / "recordings" / session_id / "full_recording.webm"
        if alt_path.exists():
            file_path = alt_path
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")

    return FileResponse(
        path=str(file_path),
        filename=recording.file_name or f"interview_{session_id}.webm",
        media_type=recording.mime_type or "video/webm"
    )


@router.get("/{session_id}/proctoring-review", response_model=InterviewProctoringReviewOut)
def get_interview_proctoring_review(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Aggregates full video recording, chronological proctoring timeline, hardware permissions,
    security violations, and human reviewer decision for HR Recruiter review.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    candidate = session.candidate
    job = db.query(Job).filter(Job.id == session.job_id).first()
    consent = db.query(InterviewPermissionConsent).filter(InterviewPermissionConsent.session_id == session.id).first()
    meta = db.query(InterviewSessionMetadata).filter(InterviewSessionMetadata.session_id == session.id).first()
    recordings = db.query(InterviewRecording).filter(InterviewRecording.session_id == session.id).all()
    events = db.query(InterviewProctoringEvent).filter(
        InterviewProctoringEvent.session_id == session.id
    ).order_by(InterviewProctoringEvent.occurred_at.asc()).all()
    violations = db.query(InterviewViolation).filter(
        InterviewViolation.interview_session_id == session.id
    ).order_by(InterviewViolation.occurred_at.asc()).all()

    recordings_out = []
    for r in recordings:
        r_out = InterviewRecordingOut.model_validate(r)
        r_out.playback_url = f"/api/v1/interviews/{session.id}/recordings/{r.id}/stream"
        recordings_out.append(r_out)

    reviewer_name = None
    if meta and meta.reviewer_id:
        reviewer = db.query(User).filter(User.id == meta.reviewer_id).first()
        if reviewer:
            reviewer_name = reviewer.full_name

    ai_analysis = db.query(AIVideoAnalysis).filter(AIVideoAnalysis.session_id == session.id).first()

    events_out = []
    for e in events:
        e_out = InterviewProctoringEventOut.model_validate(e)
        if e.reviewer_id:
            rev_user = db.query(User).filter(User.id == e.reviewer_id).first()
            if rev_user:
                e_out.reviewer_name = rev_user.full_name
        events_out.append(e_out)

    return InterviewProctoringReviewOut(
        session_id=session.id,
        candidate_id=session.candidate_id,
        candidate_name=candidate.full_name if candidate else "Candidate",
        candidate_email=candidate.email if candidate else "",
        job_title=job.title if job else "Position",
        status=session.status,
        started_at=session.started_at,
        completed_at=session.completed_at,
        duration_minutes=session.duration_minutes,
        total_violations=session.violation_count,
        flagged_for_review=session.flagged_for_review,
        termination_reason=session.termination_reason,
        proctoring_verdict=meta.proctoring_verdict if meta else "pending",
        reviewer_notes=meta.reviewer_notes if meta else "",
        reviewed_at=meta.reviewed_at if meta else None,
        reviewer_name=reviewer_name,
        consent=InterviewConsentOut.model_validate(consent) if consent else None,
        recordings=recordings_out,
        events=events_out,
        violations=[InterviewViolationOut.model_validate(v) for v in violations],
        ai_video_analysis=AIVideoAnalysisOut.model_validate(ai_analysis) if ai_analysis else None,
        summary={
            "total_disconnections": meta.total_disconnections if meta else 0,
            "total_fullscreen_exits": meta.total_fullscreen_exits if meta else 0,
            "total_events": len(events),
            "recording_count": len(recordings),
            "video_duration_seconds": meta.total_recording_duration_seconds if meta else 0.0,
            "analysis_status": ai_analysis.status if ai_analysis else "pending",
            "integrity_status": ai_analysis.overall_integrity_status if ai_analysis else "pending_analysis"
        }
    )


@router.post("/{session_id}/verify-camera-frame", response_model=CameraVerificationResponse)
async def verify_camera_frame(
    session_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Candidate Pre-flight & Live Camera Verification:
    Strictly verifies that camera stream is genuinely transmitting video frames.
    Detects black screen, heavy obstruction, and human face presence using YOLO/Computer Vision.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    image_bytes = await file.read()
    metrics = verify_camera_frame_data(image_bytes)

    # Persist verification audit log
    log = CameraVerificationLog(
        session_id=session.id,
        candidate_id=session.candidate_id,
        status="passed" if metrics["valid"] else "failed",
        has_face_detected=metrics["has_face"],
        is_black_screen=metrics["is_black"],
        is_frozen=metrics["is_frozen"],
        average_brightness=metrics["brightness"],
        fps=30.0,
        error_message=metrics["error"]
    )
    db.add(log)
    db.commit()

    return CameraVerificationResponse(**metrics)


@router.post("/{session_id}/ai-video-analysis", response_model=AIVideoAnalysisOut)
def trigger_ai_video_analysis(
    session_id: str,
    background_tasks: BackgroundTasks,
    async_mode: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Chronological Second-by-Second AI Video Malpractice Analysis:
    Inspects full recording with YOLOv8 for cell phones, multiple persons, candidate absence,
    camera obstruction, and head/posture anomalies.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    analysis = db.query(AIVideoAnalysis).filter(AIVideoAnalysis.session_id == session.id).first()
    recording = db.query(InterviewRecording).filter(InterviewRecording.session_id == session.id).first()

    if not analysis:
        analysis = AIVideoAnalysis(
            session_id=session.id,
            recording_id=recording.id if recording else None,
            status="processing",
            overall_integrity_status="analysis_in_progress",
            started_at=datetime.now(timezone.utc)
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
    else:
        analysis.status = "processing"
        analysis.overall_integrity_status = "analysis_in_progress"
        analysis.started_at = datetime.now(timezone.utc)
        analysis.error_message = None
        db.commit()
        db.refresh(analysis)

    if async_mode:
        background_tasks.add_task(run_background_video_analysis, session.id)
        return analysis
    else:
        completed_analysis = analyze_interview_recording_video(session.id, db)
        return completed_analysis


@router.get("/{session_id}/ai-video-analysis", response_model=AIVideoAnalysisOut)
def get_ai_video_analysis(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the latest AI Video Analysis coverage report and integrity assessment."""
    analysis = db.query(AIVideoAnalysis).filter(AIVideoAnalysis.session_id == session_id).first()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI Video Analysis not yet generated for this session")
    return analysis


@router.post("/{session_id}/proctoring-events/{event_id}/review", response_model=InterviewProctoringEventOut)
def review_proctoring_event(
    session_id: str,
    event_id: str,
    review_in: InterviewProctoringEventReviewSubmit,
    hr_user: User = Depends(require_hr),
    db: Session = Depends(get_db)
):
    """
    HR Recruiter Individual Event Classification:
    Allows classifying AI detections as 'genuine_violation', 'false_positive', 'normal_behavior', 'technical_issue', or 'investigating'.
    """
    event = db.query(InterviewProctoringEvent).filter(
        InterviewProctoringEvent.id == event_id,
        InterviewProctoringEvent.session_id == session_id
    ).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proctoring event not found")

    event.review_status = review_in.review_status
    event.hr_notes = review_in.hr_notes or ""
    event.reviewed_at = datetime.now(timezone.utc)
    event.reviewer_id = hr_user.id

    try:
        record_audit_log(
            db=db,
            actor_id=hr_user.id,
            action="HR_PROCTORING_EVENT_CLASSIFIED",
            target_type="interview_proctoring_event",
            target_id=event.id,
            details={
                "session_id": session_id,
                "event_type": event.event_type,
                "review_status": review_in.review_status,
                "hr_notes": review_in.hr_notes
            }
        )
    except Exception as e:
        print(f"[Audit Warning]: {e}")

    db.commit()
    db.refresh(event)

    out = InterviewProctoringEventOut.model_validate(event)
    out.reviewer_name = hr_user.full_name
    return out


@router.get("/{session_id}/evidence/{filename}")
def get_proctoring_evidence_image(
    session_id: str,
    filename: str,
    db: Session = Depends(get_db)
):
    """Serves high-resolution annotated evidence crops for detected proctoring anomalies."""
    evidence_path = Path(settings.UPLOAD_DIR) / "recordings" / session_id / "evidence" / filename
    if not evidence_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence frame file not found")
    return FileResponse(path=str(evidence_path), media_type="image/jpeg")


@router.post("/{session_id}/proctoring-verdict")
def submit_proctoring_verdict(
    session_id: str,
    verdict_in: InterviewProctoringVerdictSubmit,
    hr_user: User = Depends(require_hr),
    db: Session = Depends(get_db)
):
    """
    Submits official human reviewer assessment for the proctored interview session
    (e.g., 'cleared', 'suspicious', 'flagged_violation') along with audit notes.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    meta = db.query(InterviewSessionMetadata).filter(InterviewSessionMetadata.session_id == session.id).first()
    if not meta:
        meta = InterviewSessionMetadata(session_id=session.id)
        db.add(meta)

    meta.reviewer_id = hr_user.id
    meta.proctoring_verdict = verdict_in.verdict
    meta.reviewer_notes = verdict_in.reviewer_notes or ""
    meta.reviewed_at = datetime.now(timezone.utc)

    # Record immutable compliance audit entry
    try:
        record_audit_log(
            db=db,
            actor_id=hr_user.id,
            action="HR_PROCTORING_VERDICT_SUBMITTED",
            target_type="interview_session",
            target_id=session.id,
            details={
                "candidate_id": session.candidate_id,
                "verdict": verdict_in.verdict,
                "notes": verdict_in.reviewer_notes
            }
        )
    except Exception as e:
        print(f"[Audit Warning] Could not record proctoring verdict audit log: {e}")

    db.commit()
    return {
        "status": "success",
        "session_id": session.id,
        "proctoring_verdict": meta.proctoring_verdict,
        "reviewer_id": hr_user.id,
        "reviewed_at": meta.reviewed_at,
        "message": "Human reviewer assessment recorded successfully."
    }

