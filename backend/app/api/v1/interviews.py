import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_candidate
from app.models.models import (
    InterviewSession, InterviewQuestion, InterviewAnswer, InterviewReport,
    Application, ApplicationStatusHistory, Job, User
)
from app.schemas.schemas import (
    InterviewStartRequest, InterviewSessionOut, InterviewAnswerSubmit, InterviewQuestionOut
)
from app.services.ai_service import (
    generate_interview_questions, evaluate_single_answer, generate_final_interview_report
)
from app.services.notification_service import create_notification, record_user_activity
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
    if session.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interview session already completed")

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
            transparency_breakdown=report_data["transparency_breakdown"],
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
    return {"transcript": text}

