import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_candidate
from app.core.config import settings
from app.models.models import User, CandidateProfile, ResumeFile, ResumeAnalysisReport, Job
from app.schemas.schemas import CandidateProfileUpdate, CandidateProfileOut
from app.services.resume_service import (
    extract_text_from_pdf, extract_skills_from_text, analyze_resume_against_job, generate_anonymized_alias
)
from app.services.notification_service import record_user_activity

router = APIRouter(prefix="/candidate", tags=["Candidate Portal"])

@router.get("/profile", response_model=CandidateProfileOut)
def get_candidate_profile(candidate: User = Depends(require_candidate), db: Session = Depends(get_db)):
    profile = candidate.candidate_profile
    if not profile:
        profile = CandidateProfile(
            user_id=candidate.id,
            anonymized_alias=generate_anonymized_alias()
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.put("/profile", response_model=CandidateProfileOut)
def update_candidate_profile(
    profile_in: CandidateProfileUpdate,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    profile = candidate.candidate_profile
    if not profile:
        profile = CandidateProfile(user_id=candidate.id, anonymized_alias=generate_anonymized_alias())
        db.add(profile)

    update_data = profile_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(profile, field, val)
    
    db.commit()
    db.refresh(profile)

    record_user_activity(
        db=db,
        user_id=candidate.id,
        event_type="profile_updated",
        description="Candidate updated personal profile details."
    )
    return profile

@router.get("/resumes")
def list_candidate_resumes(candidate: User = Depends(require_candidate), db: Session = Depends(get_db)):
    resumes = db.query(ResumeFile).filter(ResumeFile.candidate_id == candidate.id).order_by(ResumeFile.uploaded_at.desc()).all()
    return [
        {
            "id": r.id,
            "file_name": r.file_name,
            "file_size": r.file_size,
            "extracted_skills": r.extracted_skills,
            "anonymized_alias": r.anonymized_alias,
            "uploaded_at": r.uploaded_at
        }
        for r in resumes
    ]

@router.post("/resumes/upload", status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Uploads a PDF resume, parses technical skills, and persists extracted metadata."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF format resume files are supported"
        )
    
    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE_MB}MB)"
        )
    
    safe_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = settings.UPLOAD_DIR / safe_filename
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    extracted_text = extract_text_from_pdf(str(file_path))
    extracted_skills = extract_skills_from_text(extracted_text)

    # Cloud upload to Supabase private storage if configured
    supabase_storage_path = None
    if settings.is_supabase_enabled:
        from app.services.supabase_service import SupabaseStorageService
        rel_path = f"{candidate.id}/{safe_filename}"
        supabase_storage_path = SupabaseStorageService.upload_file(
            bucket=SupabaseStorageService.BUCKET_RESUMES,
            path=rel_path,
            file_bytes=file_bytes,
            content_type=file.content_type or "application/pdf"
        )

    # Automatically enrich candidate profile skills if empty
    profile = candidate.candidate_profile
    if profile:
        combined_skills = list(set((profile.skills or []) + extracted_skills))
        profile.skills = combined_skills

    resume_record = ResumeFile(
        candidate_id=candidate.id,
        file_name=file.filename,
        file_path=supabase_storage_path or str(file_path),
        file_size=len(file_bytes),
        mime_type=file.content_type or "application/pdf",
        parsed_text=extracted_text,
        extracted_skills=extracted_skills,
        extracted_experience={"estimated_skills_count": len(extracted_skills)},
        anonymized_alias=profile.anonymized_alias if profile else generate_anonymized_alias()
    )
    db.add(resume_record)
    db.commit()
    db.refresh(resume_record)

    record_user_activity(
        db=db,
        user_id=candidate.id,
        event_type="resume_uploaded",
        resource_type="resume_file",
        resource_id=resume_record.id,
        description=f"Uploaded new resume '{file.filename}' with {len(extracted_skills)} extracted competencies.",
        metadata_json={"skills": extracted_skills[:6]}
    )

    from app.services.activity_service import record_recruitment_activity
    record_recruitment_activity(
        db=db,
        candidate_id=candidate.id,
        activity_type="RESUME_UPLOADED",
        activity_title="Resume Uploaded",
        activity_description=f"You uploaded your resume: {file.filename}.",
        metadata_json={"filename": file.filename, "file_id": resume_record.id, "extracted_skills_count": len(extracted_skills)}
    )

    return {
        "id": resume_record.id,
        "file_name": resume_record.file_name,
        "file_size": resume_record.file_size,
        "extracted_skills": extracted_skills,
        "anonymized_alias": resume_record.anonymized_alias,
        "uploaded_at": resume_record.uploaded_at
    }

@router.post("/resumes/{resume_id}/analyze")
def analyze_resume(
    resume_id: str,
    job_id: Optional[str] = None,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Analyzes a candidate's uploaded resume against an optional target job opening."""
    resume = db.query(ResumeFile).filter(
        ResumeFile.id == resume_id,
        ResumeFile.candidate_id == candidate.id
    ).first()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    job_desc = "Software engineering role requiring modern programming, clean architecture, and technical collaboration."
    required_skills = ["Python", "FastAPI", "React", "Docker", "SQL"]
    job_title = "Target Engineering Role"

    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job_desc = job.description
            required_skills = job.required_skills
            job_title = job.title

    analysis = analyze_resume_against_job(
        resume_text=resume.parsed_text or "",
        job_description=job_desc,
        required_skills=required_skills
    )

    report = ResumeAnalysisReport(
        resume_file_id=resume.id,
        job_id=job_id,
        match_score=analysis["match_score"],
        sbert_similarity=analysis["sbert_similarity"],
        matched_skills=analysis["matched_skills"],
        missing_skills=analysis["missing_skills"],
        experience_fit_status=analysis["fit_status"],
        strengths=analysis["strengths"],
        recommendations=analysis["recommendations"]
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    record_user_activity(
        db=db,
        user_id=candidate.id,
        event_type="resume_analyzed",
        resource_type="resume_analysis_report",
        resource_id=report.id,
        description=f"Generated resume alignment report for '{job_title}': {analysis['match_score']}% fit.",
        metadata_json={"match_score": analysis["match_score"]}
    )

    from app.services.activity_service import record_recruitment_activity
    record_recruitment_activity(
        db=db,
        candidate_id=candidate.id,
        activity_type="RESUME_ANALYZED",
        activity_title="Resume Analysis Completed",
        activity_description=f"Resume analysis completed for {resume.file_name} targeting {job_title} with {analysis['match_score']}% match.",
        job_id=job_id,
        metadata_json={"filename": resume.file_name, "match_score": analysis["match_score"], "target_job": job_title}
    )

    return {
        "report_id": report.id,
        "target_job": job_title,
        "analysis": analysis
    }

@router.delete("/resumes/{resume_id}")
def delete_resume(
    resume_id: str,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Deletes an unwanted or outdated resume file owned by the candidate."""
    resume = db.query(ResumeFile).filter(
        ResumeFile.id == resume_id,
        ResumeFile.candidate_id == candidate.id
    ).first()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found or access denied")

    # If any applications reference this resume, unlink it safely
    from app.models.models import Application
    db.query(Application).filter(Application.resume_file_id == resume.id).update({"resume_file_id": None})

    # Remove physical file if it exists
    try:
        if resume.file_path and os.path.exists(resume.file_path):
            os.remove(resume.file_path)
    except Exception as e:
        print(f"Notice: Could not delete physical resume file: {e}")

    # Remove from Supabase Storage if enabled
    if settings.is_supabase_enabled:
        from app.services.supabase_service import SupabaseStorageService
        SupabaseStorageService.delete_file(
            bucket=SupabaseStorageService.BUCKET_RESUMES,
            path=f"{candidate.id}/{resume.file_name}"
        )

    file_name = resume.file_name
    db.delete(resume)
    db.commit()

    from app.services.activity_service import record_recruitment_activity
    record_recruitment_activity(
        db=db,
        candidate_id=candidate.id,
        activity_type="RESUME_DELETED",
        activity_title="Resume Removed",
        activity_description=f"You removed resume: {file_name}.",
        metadata_json={"filename": file_name}
    )

    record_user_activity(
        db=db,
        user_id=candidate.id,
        event_type="resume_deleted",
        description=f"Removed resume file '{file_name}'."
    )

    return {"message": "Resume successfully deleted"}

@router.get("/resumes/{resume_id}/signed-url")
def get_resume_signed_url(
    resume_id: str,
    candidate: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Generates a secure temporary signed URL for viewing candidate resume."""
    resume = db.query(ResumeFile).filter(
        ResumeFile.id == resume_id,
        ResumeFile.candidate_id == candidate.id
    ).first()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    if settings.is_supabase_enabled:
        from app.services.supabase_service import SupabaseStorageService
        rel_path = f"{candidate.id}/{resume.file_name}"
        signed_url = SupabaseStorageService.get_signed_url(
            bucket=SupabaseStorageService.BUCKET_RESUMES,
            path=rel_path
        )
        if signed_url:
            return {"signed_url": signed_url}

    return {"signed_url": f"/api/v1/candidate/resumes/{resume_id}/download"}

@router.get("/privacy/export")
def export_candidate_data(candidate: User = Depends(require_candidate), db: Session = Depends(get_db)):
    """Exports all personal candidate data in compliant JSON format."""
    profile = candidate.candidate_profile
    resumes = db.query(ResumeFile).filter(ResumeFile.candidate_id == candidate.id).all()
    apps = candidate.applications
    activities = candidate.activity_events
    
    return {
        "user": {
            "id": candidate.id,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "created_at": candidate.created_at
        },
        "profile": {
            "headline": profile.headline if profile else None,
            "summary": profile.summary if profile else None,
            "skills": profile.skills if profile else [],
            "education": profile.education if profile else None,
            "experience_years": profile.experience_years if profile else 0.0
        },
        "resumes_count": len(resumes),
        "applications_count": len(apps),
        "activities_count": len(activities)
    }
