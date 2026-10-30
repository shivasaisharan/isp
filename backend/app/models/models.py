import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey, Enum, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=True)
    role = Column(String(20), nullable=False)  # 'candidate' or 'hr'
    is_active = Column(Boolean, default=True, nullable=False)
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    candidate_profile = relationship("CandidateProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    organization_memberships = relationship("OrganizationMembership", back_populates="user", cascade="all, delete-orphan")
    resumes = relationship("ResumeFile", back_populates="candidate", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="candidate", cascade="all, delete-orphan")
    interview_sessions = relationship("InterviewSession", back_populates="candidate", cascade="all, delete-orphan")
    activity_events = relationship("UserActivityEvent", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    logo_url = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    plan = Column(String(50), default="professional", nullable=False)  # starter, professional, enterprise
    active_jobs_limit = Column(Integer, default=20, nullable=False)
    monthly_interview_allowance = Column(Integer, default=200, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    members = relationship("OrganizationMembership", back_populates="organization", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="organization", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="organization", cascade="all, delete-orphan")


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="recruiter", nullable=False)  # owner, admin, recruiter
    created_at = Column(DateTime, default=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="organization_memberships")


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    headline = Column(String(200), nullable=True)
    summary = Column(Text, nullable=True)
    education = Column(String(255), nullable=True)
    experience_years = Column(Float, default=0.0, nullable=False)
    skills = Column(JSON, default=list, nullable=False)  # ["Python", "FastAPI", "React"]
    location = Column(String(100), nullable=True)
    linkedin_url = Column(String(255), nullable=True)
    github_url = Column(String(255), nullable=True)
    anonymized_alias = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="candidate_profile")


class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(150), nullable=False, index=True)
    department = Column(String(100), nullable=False)
    experience_level = Column(String(50), default="Mid-Level", nullable=False)  # Entry, Mid-Level, Senior, Lead
    location = Column(String(100), default="Remote / Hybrid", nullable=False)
    employment_type = Column(String(50), default="Full-Time", nullable=False)  # Full-Time, Part-Time, Contract
    salary_range = Column(String(100), default="$90,000 - $130,000", nullable=True)
    required_skills = Column(JSON, default=list, nullable=False)
    preferred_skills = Column(JSON, default=list, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), default="published", nullable=False)  # draft, published, paused, closed, archived
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="jobs")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")


class ResumeFile(Base):
    __tablename__ = "resume_files"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    candidate_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), default="application/pdf", nullable=False)
    parsed_text = Column(Text, nullable=True)
    extracted_skills = Column(JSON, default=list, nullable=False)
    extracted_experience = Column(JSON, default=dict, nullable=False)
    anonymized_alias = Column(String(50), nullable=False)
    uploaded_at = Column(DateTime, default=utc_now, nullable=False)

    candidate = relationship("User", back_populates="resumes")
    analysis_reports = relationship("ResumeAnalysisReport", back_populates="resume_file", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="resume_file")


class Application(Base):
    __tablename__ = "applications"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    resume_file_id = Column(String(36), ForeignKey("resume_files.id", ondelete="RESTRICT"), nullable=True)
    
    # Validated State Machine:
    # submitted -> under_review -> interview_pending -> interview_completed -> hr_review -> selected / rejected / withdrawn
    status = Column(String(50), default="submitted", nullable=False, index=True)
    
    # Pre-computed scores
    resume_match_score = Column(Float, default=0.0, nullable=False)
    sbert_similarity = Column(Float, default=0.0, nullable=False)
    skills_match_score = Column(Float, default=0.0, nullable=False)
    overall_ranking_score = Column(Float, default=0.0, nullable=False)
    
    applied_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    job = relationship("Job", back_populates="applications")
    candidate = relationship("User", back_populates="applications")
    resume_file = relationship("ResumeFile", back_populates="applications")
    status_history = relationship("ApplicationStatusHistory", back_populates="application", cascade="all, delete-orphan")
    interview_session = relationship("InterviewSession", back_populates="application", uselist=False, cascade="all, delete-orphan")
    hiring_decision = relationship("HiringDecision", back_populates="application", uselist=False, cascade="all, delete-orphan")


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    application = relationship("Application", back_populates="status_history")


class ResumeAnalysisReport(Base):
    __tablename__ = "resume_analysis_reports"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    resume_file_id = Column(String(36), ForeignKey("resume_files.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    match_score = Column(Float, nullable=False)
    sbert_similarity = Column(Float, nullable=False)
    matched_skills = Column(JSON, default=list, nullable=False)
    missing_skills = Column(JSON, default=list, nullable=False)
    experience_fit_status = Column(String(50), default="Qualified", nullable=False)
    strengths = Column(JSON, default=list, nullable=False)
    recommendations = Column(JSON, default=list, nullable=False)
    analyzed_at = Column(DateTime, default=utc_now, nullable=False)

    resume_file = relationship("ResumeFile", back_populates="analysis_reports")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    
    status = Column(String(30), default="in_progress", nullable=False)  # pending, in_progress, completed, expired, terminated_flagged
    duration_minutes = Column(Integer, default=15, nullable=False)
    current_question_index = Column(Integer, default=0, nullable=False)
    total_questions = Column(Integer, default=5, nullable=False)
    
    # Secure Full-Screen Monitoring Fields
    violation_count = Column(Integer, default=0, nullable=False)
    max_violations = Column(Integer, default=3, nullable=False)
    flagged_for_review = Column(Boolean, default=False, nullable=False)
    termination_reason = Column(Text, nullable=True)
    is_secure_mode = Column(Boolean, default=True, nullable=False)

    started_at = Column(DateTime, default=utc_now, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    application = relationship("Application", back_populates="interview_session")
    candidate = relationship("User", back_populates="interview_sessions")
    questions = relationship("InterviewQuestion", back_populates="session", cascade="all, delete-orphan", order_by="InterviewQuestion.question_index")
    answers = relationship("InterviewAnswer", back_populates="session", cascade="all, delete-orphan")
    report = relationship("InterviewReport", back_populates="session", uselist=False, cascade="all, delete-orphan")
    violations = relationship("InterviewViolation", back_populates="session", cascade="all, delete-orphan", order_by="InterviewViolation.occurred_at")


class InterviewViolation(Base):
    __tablename__ = "interview_violations"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    interview_session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    violation_type = Column(String(50), nullable=False)  # fullscreen_exit, tab_switched, focus_lost, navigation_attempt
    description = Column(Text, nullable=False)
    violation_number = Column(Integer, nullable=False)
    metadata_json = Column(JSON, default=dict, nullable=False)
    occurred_at = Column(DateTime, default=utc_now, nullable=False)

    session = relationship("InterviewSession", back_populates="violations")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_index = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    category = Column(String(50), default="technical", nullable=False)  # technical, problem_solving, behavioral, architecture
    created_at = Column(DateTime, default=utc_now, nullable=False)

    session = relationship("InterviewSession", back_populates="questions")
    answer = relationship("InterviewAnswer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    question_id = Column(String(36), ForeignKey("interview_questions.id", ondelete="CASCADE"), unique=True, nullable=False)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_answer = Column(Text, nullable=False)
    
    # Dimension scores (0.0 to 100.0)
    technical_score = Column(Float, default=0.0, nullable=False)
    problem_solving_score = Column(Float, default=0.0, nullable=False)
    skills_score = Column(Float, default=0.0, nullable=False)
    communication_score = Column(Float, default=0.0, nullable=False)
    project_score = Column(Float, default=0.0, nullable=False)
    composite_score = Column(Float, default=0.0, nullable=False)
    
    feedback = Column(Text, nullable=True)
    answered_at = Column(DateTime, default=utc_now, nullable=False)

    question = relationship("InterviewQuestion", back_populates="answer")
    session = relationship("InterviewSession", back_populates="answers")


class InterviewReport(Base):
    __tablename__ = "interview_reports"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    
    technical_rating = Column(Float, nullable=False)
    problem_solving_rating = Column(Float, nullable=False)
    skills_rating = Column(Float, nullable=False)
    communication_rating = Column(Float, nullable=False)
    project_rating = Column(Float, nullable=False)
    overall_score = Column(Float, nullable=False)
    
    rubric_version = Column(String(20), default="2026.1", nullable=False)
    
    strengths = Column(JSON, default=list, nullable=False)
    weaknesses = Column(JSON, default=list, nullable=False)
    skill_gap_summary = Column(Text, nullable=False)
    suggestions_for_improvement = Column(Text, nullable=False)
    transparency_breakdown = Column(JSON, default=dict, nullable=False)
    
    candidate_visible_feedback = Column(Text, nullable=False)
    recruiter_confidential_notes = Column(Text, default="", nullable=True)
    
    created_at = Column(DateTime, default=utc_now, nullable=False)

    session = relationship("InterviewSession", back_populates="report")


class HiringDecision(Base):
    __tablename__ = "hiring_decisions"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    recruiter_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    decision = Column(String(50), nullable=False)  # 'selected', 'rejected', 'on_hold'
    rationale = Column(Text, nullable=False)
    decided_at = Column(DateTime, default=utc_now, nullable=False)

    application = relationship("Application", back_populates="hiring_decision")


class UserActivityEvent(Base):
    __tablename__ = "user_activity_events"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # profile_updated, resume_uploaded, applied_job, etc.
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(36), nullable=True)
    description = Column(Text, nullable=False)
    metadata_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="activity_events")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="info", nullable=False)  # info, status_change, interview, decision
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="notifications")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id = Column(String(36), primary_key=True, default=gen_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    actor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(36), nullable=True)
    details_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    organization = relationship("Organization", back_populates="audit_events")
