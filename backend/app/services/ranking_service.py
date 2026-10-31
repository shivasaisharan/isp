from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.models import Application, Job, User, ResumeFile, InterviewSession, InterviewReport
from app.core.rubric import calculate_composite_rank_score, RANKING_WEIGHTS

def get_job_top_five_recommendations(db: Session, job_id: str) -> List[Dict[str, Any]]:
    """
    Computes top-five ranked eligible candidates for an HR job opening.
    Job-specific, explainable, and based strictly on database records.
    Never fabricates records if fewer than 5 candidates exist.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return []

    applications = (
        db.query(Application)
        .filter(Application.job_id == job_id)
        .all()
    )

    ranked_candidates = []

    for app in applications:
        candidate: User = app.candidate
        if not candidate:
            continue
        
        profile = candidate.candidate_profile
        anonymized_alias = profile.anonymized_alias if profile and profile.anonymized_alias else f"Candidate #{candidate.id[:4].upper()}"

        # Get interview session and report if completed
        interview_session = (
            db.query(InterviewSession)
            .filter(InterviewSession.application_id == app.id)
            .first()
        )
        report: Optional[InterviewReport] = interview_session.report if interview_session else None
        
        has_report = report is not None
        interview_score = report.overall_score if has_report else None

        # Composite ranking score: 40% resume, 40% interview, 20% required skills
        # If interview is pending, calculate composite based on available signals (interview=0.0)
        overall_score = calculate_composite_rank_score(
            resume_match=app.resume_match_score,
            interview_score=report.overall_score if has_report else 0.0,
            required_skills=app.skills_match_score
        )

        # Update application ranking score in database for persistence
        app.overall_ranking_score = overall_score

        # Determine exact assessment status
        if has_report:
            assessment_status = "Completed"
        elif interview_session and interview_session.flagged_for_review:
            assessment_status = "Terminated (Flagged)"
        elif interview_session and interview_session.status == "in_progress":
            assessment_status = "Interview In Progress"
        elif app.status == "interview_pending":
            assessment_status = "Assessment Pending"
        else:
            assessment_status = "Interview Not Started"

        # Extract strengths & gaps
        strengths = []
        areas_for_review = []
        if app.skills_match_score >= 80.0:
            strengths.append(f"High required-skill alignment ({app.skills_match_score}%)")
        elif app.skills_match_score < 60.0:
            areas_for_review.append(f"Notable prerequisite skill gaps ({app.skills_match_score}%)")

        if has_report:
            if report.technical_rating >= 80.0:
                strengths.append(f"Demonstrated technical rigor in AI interview ({report.technical_rating}%)")
            if report.communication_rating >= 80.0:
                strengths.append(f"Strong structured articulation ({report.communication_rating}%)")
            if report.problem_solving_rating < 70.0:
                areas_for_review.append(f"Review problem-solving edge cases ({report.problem_solving_rating}%)")
        else:
            areas_for_review.append("Interview assessment pending or incomplete")

        # Assessment limitations disclosure
        limitations = (
            "Scores represent AI screening evidence based on submitted resume and turn-by-turn interview answers. "
            "Final hiring decision rests exclusively with human recruiters."
        )

        has_resume = False
        resume_name = None
        if app.resume_file:
            has_resume = True
            resume_name = app.resume_file.file_name
        elif candidate:
            from app.models.models import ResumeFile
            latest_res = db.query(ResumeFile).filter(ResumeFile.candidate_id == candidate.id).order_by(ResumeFile.uploaded_at.desc()).first()
            if latest_res:
                has_resume = True
                resume_name = latest_res.file_name
                if not app.resume_file_id:
                    app.resume_file_id = latest_res.id

        ranked_candidates.append({
            "application_id": app.id,
            "candidate_id": candidate.id,
            "candidate_name": candidate.full_name,
            "anonymized_alias": anonymized_alias,
            "resume_match_score": app.resume_match_score,
            "interview_score": interview_score,
            "required_skills_score": app.skills_match_score,
            "overall_score": overall_score,
            "status": app.status,
            "matched_skills": profile.skills if profile else [],
            "missing_skills": [sk for sk in job.required_skills if profile and sk not in profile.skills],
            "strengths": strengths or ["Foundational profile submitted"],
            "areas_for_review": areas_for_review or ["Conduct final HR round to confirm cultural alignment"],
            "assessment_limitations": limitations,
            "has_interview_report": has_report,
            "report_id": report.id if report else None,
            "assessment_status": assessment_status,
            "has_resume": has_resume,
            "resume_file_id": app.resume_file_id,
            "resume_file_name": resume_name
        })

    db.commit()

    # Sort descending by overall_score
    ranked_candidates.sort(key=lambda x: x["overall_score"], reverse=True)

    # Assign ranks and return top 5
    top_candidates = []
    for idx, cand in enumerate(ranked_candidates[:5]):
        cand["rank"] = idx + 1
        top_candidates.append(cand)

    return top_candidates
