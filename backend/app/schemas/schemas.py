from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# --- Auth & User Schemas ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: str

class UserCreateCandidate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    phone: Optional[str] = None

class UserCreateHR(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    organization_name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserOut(UserBase):
    id: str
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    organization: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)

# --- Profile Schemas ---
class CandidateProfileUpdate(BaseModel):
    headline: Optional[str] = None
    summary: Optional[str] = None
    education: Optional[str] = None
    experience_years: Optional[float] = None
    skills: Optional[List[str]] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None

class CandidateProfileOut(BaseModel):
    id: str
    user_id: str
    headline: Optional[str] = None
    summary: Optional[str] = None
    education: Optional[str] = None
    experience_years: float = 0.0
    skills: List[str] = []
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    anonymized_alias: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Job Schemas ---
class JobBase(BaseModel):
    title: str
    department: str
    experience_level: str = "Mid-Level"
    location: str = "Remote / Hybrid"
    employment_type: str = "Full-Time"
    salary_range: Optional[str] = "$90,000 - $130,000"
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    description: str

class JobCreate(JobBase):
    status: str = "published"

class JobUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    experience_level: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    salary_range: Optional[str] = None
    required_skills: Optional[List[str]] = None
    preferred_skills: Optional[List[str]] = None
    description: Optional[str] = None
    status: Optional[str] = None

class JobOut(JobBase):
    id: str
    organization_id: str
    organization_name: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    applicants_count: Optional[int] = 0
    model_config = ConfigDict(from_attributes=True)

class JobSummary(BaseModel):
    id: str
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Application Schemas ---
class ApplicationCreate(BaseModel):
    job_id: str
    resume_file_id: Optional[str] = None

class ApplicationStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None

class ApplicationOut(BaseModel):
    id: str
    job_id: str
    candidate_id: str
    resume_file_id: Optional[str] = None
    status: str
    resume_match_score: float
    sbert_similarity: float
    skills_match_score: float
    overall_ranking_score: float
    interview_score: Optional[float] = None
    interview_status: Optional[str] = None
    report_id: Optional[str] = None
    assessment_status: Optional[str] = None
    scoring_formula_version: Optional[str] = "2026.2"
    applied_at: datetime
    updated_at: datetime
    job: Optional[JobSummary] = None
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    anonymized_alias: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Interview Schemas ---
class InterviewStartRequest(BaseModel):
    application_id: str
    duration_minutes: Optional[int] = 15

class InterviewAnswerSubmit(BaseModel):
    session_id: str
    question_id: str
    answer: str

class InterviewQuestionOut(BaseModel):
    id: str
    question_index: int
    question_text: str
    category: str
    model_config = ConfigDict(from_attributes=True)

class InterviewSessionOut(BaseModel):
    id: str
    application_id: str
    candidate_id: str
    job_id: str
    status: str
    duration_minutes: int
    current_question_index: int
    total_questions: int
    violation_count: int = 0
    max_violations: int = 3
    flagged_for_review: bool = False
    termination_reason: Optional[str] = None
    is_secure_mode: bool = True
    started_at: datetime
    completed_at: Optional[datetime] = None
    current_question: Optional[InterviewQuestionOut] = None
    model_config = ConfigDict(from_attributes=True)

class InterviewViolationCreate(BaseModel):
    violation_type: str
    description: str
    incident_id: Optional[str] = None
    metadata: Optional[dict] = None

class InterviewViolationOut(BaseModel):
    id: str
    interview_session_id: str
    violation_type: str
    description: str
    violation_number: int
    occurred_at: datetime
    metadata_json: Optional[dict] = None
    model_config = ConfigDict(from_attributes=True)

class InterviewSecurityStatus(BaseModel):
    session_id: str
    status: str
    violation_count: int
    max_violations: int = 3
    remaining_chances: int
    flagged_for_review: bool
    is_terminated: bool
    termination_reason: Optional[str] = None
    violations: List[InterviewViolationOut] = []
    model_config = ConfigDict(from_attributes=True)

# --- Report Schemas ---
class InterviewReportOut(BaseModel):
    id: str
    session_id: str
    application_id: str
    technical_rating: float
    problem_solving_rating: float
    skills_rating: float
    communication_rating: float
    project_rating: float
    overall_score: float
    rubric_version: str
    strengths: List[str] = []
    weaknesses: List[str] = []
    skill_gap_summary: str
    suggestions_for_improvement: str
    transparency_breakdown: Dict[str, Any] = {}
    candidate_visible_feedback: str
    recruiter_confidential_notes: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Ranking & Recommendation Schemas ---
class TopCandidateRecommendation(BaseModel):
    rank: int
    application_id: str
    candidate_id: str
    candidate_name: str
    anonymized_alias: str
    resume_match_score: float
    interview_score: float
    required_skills_score: float
    overall_score: float
    status: str
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    strengths: List[str] = []
    areas_for_review: List[str] = []
    assessment_limitations: str
    has_interview_report: bool
    report_id: Optional[str] = None

# --- Hiring Decision Schemas ---
class DecisionActionRequest(BaseModel):
    notes: str = Field(..., min_length=3, description="Mandatory HR decision rationale/notes")

class HiringDecisionCreate(BaseModel):
    application_id: str
    decision: str = Field(..., pattern="^(selected|accepted|rejected|on_hold)$")
    rationale: str = Field(..., min_length=3)

class HiringDecisionOut(BaseModel):
    id: str
    application_id: str
    job_id: str
    recruiter_id: Optional[str] = None
    decision: str
    rationale: str
    decided_at: datetime
    model_config = ConfigDict(from_attributes=True)

class HrDecisionHistoryOut(BaseModel):
    id: str
    organization_id: str
    application_id: str
    candidate_id: str
    job_id: str
    reviewer_id: Optional[str] = None
    decision: str
    decision_notes: str
    previous_status: Optional[str] = None
    new_status: str
    decided_at: datetime
    created_at: datetime
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_alias: Optional[str] = None
    job_title: Optional[str] = None
    job_department: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewer_email: Optional[str] = None
    resume_match_score: Optional[float] = None
    interview_score: Optional[float] = None
    overall_fit_score: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class HrDecisionSummaryOut(BaseModel):
    total_decisions: int
    total_accepted: int
    total_rejected: int
    decisions_this_month: int

class HrDecisionHistoryPageOut(BaseModel):
    items: List[HrDecisionHistoryOut]
    total: int
    page: int
    page_size: int
    total_pages: int

# --- Activity & Notification Schemas ---
class UserActivityEventOut(BaseModel):
    id: str
    event_type: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: str
    metadata_json: Dict[str, Any] = {}
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CandidateRecruitmentActivityOut(BaseModel):
    id: str
    candidate_id: str
    application_id: Optional[str] = None
    job_id: Optional[str] = None
    company_id: Optional[str] = None
    activity_type: str
    activity_title: str
    activity_description: str
    metadata_json: Dict[str, Any] = {}
    occurred_at: datetime
    created_at: datetime
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    category: Optional[str] = None
    status_badge: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CandidateActivitySummaryOut(BaseModel):
    total_resumes_uploaded: int
    total_jobs_applied: int
    interviews_completed: int
    applications_accepted: int

class CandidateRecruitmentActivityPageOut(BaseModel):
    items: List[CandidateRecruitmentActivityOut]
    total: int
    page: int
    page_size: int
    total_pages: int

class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    notification_type: str
    is_read: bool
    link: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ResolvedAuditEventOut(BaseModel):
    id: str
    event_reference: str
    action: str
    action_display: str
    category: str
    category_display: str
    actor_id: Optional[str] = None
    actor_role: str
    actor_name: str
    actor_designation: str
    actor_reference: Optional[str] = None
    candidate_id: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_reference: Optional[str] = None
    candidate_email: Optional[str] = None
    job_id: Optional[str] = None
    job_title: Optional[str] = None
    job_reference: Optional[str] = None
    company_name: Optional[str] = None
    department: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    decision_notes: Optional[str] = None
    application_id: Optional[str] = None
    application_reference: Optional[str] = None
    assessment_reference: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details_json: Dict[str, Any] = {}
    created_at: datetime
    is_hiring_decision: bool = False
    model_config = ConfigDict(from_attributes=True)

class AuditTrailSummaryOut(BaseModel):
    total_audit_events: int
    hiring_decisions: int
    candidate_applications: int
    interview_events: int
    resume_events: int
    security_events: int
    job_management_events: int

class AuditTrailPageOut(BaseModel):
    items: List[ResolvedAuditEventOut]
    total: int
    page: int
    page_size: int
    total_pages: int
