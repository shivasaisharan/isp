from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_candidate, require_hr, get_current_hr_membership
from app.models.models import InterviewReport, User, Application, OrganizationMembership
from app.schemas.schemas import InterviewReportOut

router = APIRouter(prefix="/reports", tags=["Interview Reports"])

@router.get("/{report_id}")
def get_report_by_id(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches detailed interview scorecard.
    Strictly protects confidentiality: candidates never see confidential recruiter notes.
    """
    report = db.query(InterviewReport).filter(InterviewReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    app = report.session.application

    if current_user.role == "candidate":
        if app.candidate_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this candidate report")
        
        # Return candidate-safe scorecard
        return {
            "id": report.id,
            "session_id": report.session_id,
            "application_id": report.application_id,
            "job_title": app.job.title,
            "organization_name": app.job.organization.name if app.job.organization else "Company",
            "technical_rating": report.technical_rating,
            "problem_solving_rating": report.problem_solving_rating,
            "skills_rating": report.skills_rating,
            "communication_rating": report.communication_rating,
            "project_rating": report.project_rating,
            "overall_score": report.overall_score,
            "rubric_version": report.rubric_version,
            "strengths": report.strengths,
            "weaknesses": report.weaknesses,
            "skill_gap_summary": report.skill_gap_summary,
            "suggestions_for_improvement": report.suggestions_for_improvement,
            "transparency_breakdown": report.transparency_breakdown,
            "candidate_visible_feedback": report.candidate_visible_feedback,
            "created_at": report.created_at
        }

    elif current_user.role == "hr":
        membership = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == current_user.id).first()
        if not membership or app.job.organization_id != membership.organization_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: report belongs to another organization")
        
        # Return complete HR scorecard including confidential notes
        cand = app.candidate
        return {
            "id": report.id,
            "session_id": report.session_id,
            "application_id": report.application_id,
            "job_title": app.job.title,
            "candidate_name": cand.full_name if cand else "Candidate",
            "candidate_email": cand.email if cand else "",
            "anonymized_alias": cand.candidate_profile.anonymized_alias if cand and cand.candidate_profile else f"Candidate #{cand.id[:4]}",
            "technical_rating": report.technical_rating,
            "problem_solving_rating": report.problem_solving_rating,
            "skills_rating": report.skills_rating,
            "communication_rating": report.communication_rating,
            "project_rating": report.project_rating,
            "overall_score": report.overall_score,
            "rubric_version": report.rubric_version,
            "strengths": report.strengths,
            "weaknesses": report.weaknesses,
            "skill_gap_summary": report.skill_gap_summary,
            "suggestions_for_improvement": report.suggestions_for_improvement,
            "transparency_breakdown": report.transparency_breakdown,
            "candidate_visible_feedback": report.candidate_visible_feedback,
            "recruiter_confidential_notes": report.recruiter_confidential_notes,
            "created_at": report.created_at
        }

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized role")

@router.get("/candidate/all", response_model=List[dict])
def list_candidate_reports(
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Candidate views list of all completed interview reports."""
    sessions = (
        db.query(InterviewReport)
        .join(Application, InterviewReport.application_id == Application.id)
        .filter(Application.candidate_id == candidate.id)
        .order_by(InterviewReport.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "session_id": r.session_id,
            "job_title": r.session.application.job.title,
            "overall_score": r.overall_score,
            "created_at": r.created_at
        }
        for r in sessions
    ]
