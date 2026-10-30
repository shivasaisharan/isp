import os
from sqlalchemy.orm import Session
from app.models.models import (
    User, Organization, OrganizationMembership, CandidateProfile, Job,
    ResumeFile, Application, ApplicationStatusHistory, InterviewSession,
    InterviewQuestion, InterviewAnswer, InterviewReport, HiringDecision,
    UserActivityEvent, Notification, AuditEvent
)
from app.core.security import hash_password
from app.core.rubric import calculate_composite_rank_score

def seed_database(db: Session):
    """Seeds standard demo organization, HR recruiters, candidates, jobs, and applications."""
    if db.query(User).first() is not None:
        return  # Already seeded

    # 1. Organization
    org = Organization(
        name="Global Tech Solutions",
        slug="global-tech",
        logo_url="https://images.unsplash.com/photo-1549923746-c502d488b3ea?auto=format&fit=crop&w=120&h=120&q=80",
        website="https://globaltech.io",
        plan="enterprise",
        active_jobs_limit=50,
        monthly_interview_allowance=500
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    # 2. HR Recruiter User
    hr_password = hash_password("recruiter123")
    hr_user = User(
        email="hr@smartrecruit.io",
        hashed_password=hr_password,
        full_name="Sarah Jenkins",
        phone="+1 (555) 234-5678",
        role="hr",
        is_active=True,
        avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80"
    )
    db.add(hr_user)
    db.commit()
    db.refresh(hr_user)

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=hr_user.id,
        role="admin"
    )
    db.add(membership)

    # 3. Candidate 1: Alex Chen
    cand_password = hash_password("candidate123")
    cand1 = User(
        email="alex.chen@example.com",
        hashed_password=cand_password,
        full_name="Alex Chen",
        phone="+1 (555) 345-6789",
        role="candidate",
        is_active=True,
        avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"
    )
    db.add(cand1)
    db.commit()
    db.refresh(cand1)

    profile1 = CandidateProfile(
        user_id=cand1.id,
        headline="Senior AI & Machine Learning Engineer",
        summary="Specialized in PyTorch, Transformer models, LLM fine-tuning, and scalable microservices.",
        education="M.S. in Computer Science, Stanford University",
        experience_years=5.5,
        skills=["Python", "PyTorch", "FastAPI", "Docker", "Machine Learning", "Transformers", "SQL", "Kubernetes"],
        location="San Francisco, CA (Remote)",
        linkedin_url="https://linkedin.com/in/alexchen-ai",
        github_url="https://github.com/alexchen-ai",
        anonymized_alias="Candidate #401"
    )
    db.add(profile1)

    # 4. Candidate 2: Elena Rostova
    cand2 = User(
        email="elena.rostova@example.com",
        hashed_password=cand_password,
        full_name="Elena Rostova",
        phone="+1 (555) 456-7890",
        role="candidate",
        is_active=True,
        avatar_url="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80"
    )
    db.add(cand2)
    db.commit()
    db.refresh(cand2)

    profile2 = CandidateProfile(
        user_id=cand2.id,
        headline="Full Stack Cloud Architect",
        summary="Expert in React, TypeScript, FastAPI, PostgreSQL, and AWS Cloud Native infrastructure.",
        education="B.S. in Software Engineering, University of Washington",
        experience_years=4.0,
        skills=["React", "TypeScript", "Python", "FastAPI", "PostgreSQL", "AWS", "Docker", "REST API"],
        location="Seattle, WA (Hybrid)",
        linkedin_url="https://linkedin.com/in/elenarostova",
        github_url="https://github.com/elenarostova",
        anonymized_alias="Candidate #402"
    )
    db.add(profile2)

    # Candidate 3: Marcus Vance
    cand3 = User(
        email="marcus.vance@example.com",
        hashed_password=cand_password,
        full_name="Marcus Vance",
        phone="+1 (555) 567-8901",
        role="candidate",
        is_active=True,
        avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80"
    )
    db.add(cand3)
    db.commit()
    db.refresh(cand3)

    profile3 = CandidateProfile(
        user_id=cand3.id,
        headline="Backend Systems & Distributed Database Engineer",
        summary="Focused on high-throughput distributed systems, caching, Redis, Go, and PostgreSQL.",
        education="B.S. in Computer Engineering, Georgia Tech",
        experience_years=3.5,
        skills=["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "System Design", "SQL"],
        location="Austin, TX (Remote)",
        anonymized_alias="Candidate #403"
    )
    db.add(profile3)

    # 5. Create Jobs
    job1 = Job(
        organization_id=org.id,
        created_by_id=hr_user.id,
        title="Senior AI / Machine Learning Engineer",
        department="Engineering - AI & Data",
        experience_level="Senior",
        location="Remote / Hybrid (US/Canada)",
        employment_type="Full-Time",
        salary_range="$140,000 - $185,000",
        required_skills=["Python", "PyTorch", "FastAPI", "Machine Learning", "Transformers", "Docker"],
        preferred_skills=["Kubernetes", "Vector Databases", "MLOps", "AWS"],
        description="""We are seeking a Senior AI/ML Engineer to architect and scale our next-generation NLP intelligence platform.
You will design scalable model serving pipelines, implement Transformer-based fine-tuning, and integrate low-latency inference services.
Key responsibilities:
- Design and deploy machine learning models in production with high reliability.
- Optimize inference latency, caching, and model quantization.
- Collaborate with full-stack engineers to integrate AI endpoints into client-facing applications.
- Uphold responsible AI, data privacy, and ethical evaluation standards.""",
        status="published"
    )
    db.add(job1)

    job2 = Job(
        organization_id=org.id,
        created_by_id=hr_user.id,
        title="Full Stack Cloud Software Engineer",
        department="Product Engineering",
        experience_level="Mid-Level",
        location="Remote (Global)",
        employment_type="Full-Time",
        salary_range="$115,000 - $145,000",
        required_skills=["React", "TypeScript", "Python", "FastAPI", "PostgreSQL", "Docker"],
        preferred_skills=["Tailwind CSS", "AWS", "Redis", "CI/CD"],
        description="""Join our core SaaS product engineering team building high-performance web applications and responsive APIs.
You will deliver end-to-end features spanning modern React frontends, robust FastAPI microservices, and PostgreSQL schemas.""",
        status="published"
    )
    db.add(job2)
    db.commit()
    db.refresh(job1)
    db.refresh(job2)

    # 6. Seed Resumes
    dummy_resume1 = ResumeFile(
        candidate_id=cand1.id,
        file_name="Alex_Chen_Senior_AI_Resume.pdf",
        file_path="uploads/demo_alex_chen.pdf",
        file_size=142000,
        mime_type="application/pdf",
        parsed_text="Alex Chen. Senior AI Engineer with 5+ years of experience in Python, PyTorch, Transformers, FastAPI, Docker, and ML deployment.",
        extracted_skills=["Python", "PyTorch", "FastAPI", "Docker", "Machine Learning", "Transformers", "Kubernetes"],
        extracted_experience={"years": 5.5, "title": "Senior AI Engineer"},
        anonymized_alias="Candidate #401"
    )
    db.add(dummy_resume1)

    dummy_resume2 = ResumeFile(
        candidate_id=cand2.id,
        file_name="Elena_Rostova_FullStack_Resume.pdf",
        file_path="uploads/demo_elena_rostova.pdf",
        file_size=128000,
        mime_type="application/pdf",
        parsed_text="Elena Rostova. Full Stack Cloud Engineer with 4 years building React, TypeScript, FastAPI, PostgreSQL, and AWS applications.",
        extracted_skills=["React", "TypeScript", "Python", "FastAPI", "PostgreSQL", "AWS", "Docker"],
        extracted_experience={"years": 4.0, "title": "Full Stack Engineer"},
        anonymized_alias="Candidate #402"
    )
    db.add(dummy_resume2)

    dummy_resume3 = ResumeFile(
        candidate_id=cand3.id,
        file_name="Marcus_Vance_Backend_Resume.pdf",
        file_path="uploads/demo_marcus_vance.pdf",
        file_size=119000,
        mime_type="application/pdf",
        parsed_text="Marcus Vance. Backend Engineer with 3.5 years experience in Python, FastAPI, PostgreSQL, Redis, and Distributed Systems.",
        extracted_skills=["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "System Design"],
        extracted_experience={"years": 3.5, "title": "Backend Systems Engineer"},
        anonymized_alias="Candidate #403"
    )
    db.add(dummy_resume3)
    db.commit()
    db.refresh(dummy_resume1)
    db.refresh(dummy_resume2)
    db.refresh(dummy_resume3)

    # 7. Seed Applications
    # Candidate 1 applied to Job 1
    app1 = Application(
        job_id=job1.id,
        candidate_id=cand1.id,
        resume_file_id=dummy_resume1.id,
        status="interview_completed",
        resume_match_score=92.5,
        sbert_similarity=0.91,
        skills_match_score=95.0,
        overall_ranking_score=91.8
    )
    db.add(app1)

    # Candidate 2 applied to Job 1
    app2 = Application(
        job_id=job1.id,
        candidate_id=cand2.id,
        resume_file_id=dummy_resume2.id,
        status="interview_completed",
        resume_match_score=81.0,
        sbert_similarity=0.78,
        skills_match_score=75.0,
        overall_ranking_score=83.5
    )
    db.add(app2)

    # Candidate 3 applied to Job 1
    app3 = Application(
        job_id=job1.id,
        candidate_id=cand3.id,
        resume_file_id=dummy_resume3.id,
        status="hr_review",
        resume_match_score=78.0,
        sbert_similarity=0.75,
        skills_match_score=70.0,
        overall_ranking_score=79.2
    )
    db.add(app3)

    # Candidate 2 also applied to Job 2
    app4 = Application(
        job_id=job2.id,
        candidate_id=cand2.id,
        resume_file_id=dummy_resume2.id,
        status="interview_completed",
        resume_match_score=96.0,
        sbert_similarity=0.94,
        skills_match_score=98.0,
        overall_ranking_score=94.5
    )
    db.add(app4)
    db.commit()
    db.refresh(app1)
    db.refresh(app2)
    db.refresh(app3)
    db.refresh(app4)

    # 8. Status Histories
    hist1 = ApplicationStatusHistory(
        application_id=app1.id,
        previous_status="submitted",
        new_status="interview_completed",
        changed_by_id=cand1.id,
        note="Candidate completed turn-by-turn AI interview session."
    )
    db.add(hist1)

    # 9. Interview Session & Report for App 1 (Alex Chen)
    sess1 = InterviewSession(
        application_id=app1.id,
        candidate_id=cand1.id,
        job_id=job1.id,
        status="completed",
        duration_minutes=15,
        current_question_index=5,
        total_questions=5
    )
    db.add(sess1)
    db.commit()
    db.refresh(sess1)

    q1 = InterviewQuestion(
        session_id=sess1.id,
        question_index=0,
        question_text="How do you handle model latency and memory optimization when deploying Transformer architectures in high-throughput production?",
        category="technical"
    )
    db.add(q1)
    db.commit()
    db.refresh(q1)

    ans1 = InterviewAnswer(
        question_id=q1.id,
        session_id=sess1.id,
        candidate_answer="I implement FP16 / INT8 quantization using ONNX Runtime and TensorRT. In our previous microservice, this reduced GPU memory by 60% and P99 inference latency from 180ms to 42ms. We also added an asynchronous Redis cache for frequent semantic embedding lookups.",
        technical_score=94.0,
        problem_solving_score=92.0,
        skills_score=95.0,
        communication_score=90.0,
        project_score=93.0,
        composite_score=93.2,
        feedback="Exceptional response with quantitative production metrics and architectural depth."
    )
    db.add(ans1)

    report1 = InterviewReport(
        session_id=sess1.id,
        application_id=app1.id,
        technical_rating=92.5,
        problem_solving_rating=89.0,
        skills_rating=94.0,
        communication_rating=88.5,
        project_rating=91.0,
        overall_score=91.4,
        rubric_version="2026.1",
        strengths=[
            "Demonstrated deep production familiarity with Transformer quantization and latency profiling",
            "Quantified business results (P99 latency drop from 180ms to 42ms)",
            "Strong communication structure using STAR method"
        ],
        weaknesses=[
            "Could expand slightly on distributed multi-GPU training orchestration"
        ],
        skill_gap_summary="Alex Chen is a top-tier candidate for the Senior AI/ML role with negligible skill gaps. Core strengths lie in Transformer optimization and asynchronous API serving.",
        suggestions_for_improvement="Explore newer distributed serving engines such as vLLM and TensorRT-LLM for continuous batching.",
        transparency_breakdown={
            "technical_weight": "35%",
            "problem_solving_weight": "25%",
            "skills_weight": "20%",
            "communication_weight": "10%",
            "project_weight": "10%"
        },
        candidate_visible_feedback="Outstanding performance across technical depth and system optimization. Strong problem-solving methodology demonstrated.",
        recruiter_confidential_notes="Recommendation: Highly qualified for Senior role. Strong candidate for prompt on-site final interview."
    )
    db.add(report1)

    # Interview for App 2 (Elena Rostova for Job 1)
    sess2 = InterviewSession(
        application_id=app2.id,
        candidate_id=cand2.id,
        job_id=job1.id,
        status="completed",
        duration_minutes=15,
        current_question_index=5,
        total_questions=5
    )
    db.add(sess2)
    db.commit()
    db.refresh(sess2)

    report2 = InterviewReport(
        session_id=sess2.id,
        application_id=app2.id,
        technical_rating=83.0,
        problem_solving_rating=86.0,
        skills_rating=80.0,
        communication_rating=90.0,
        project_rating=84.0,
        overall_score=84.5,
        rubric_version="2026.1",
        strengths=[
            "High communication clarity and architectural reasoning",
            "Strong grasp of containerization and API design"
        ],
        weaknesses=[
            "Deeper specialized Transformer hyperparameter tuning could be strengthened"
        ],
        skill_gap_summary="Strong software engineering fundamentals with good ML awareness.",
        suggestions_for_improvement="Deepen familiarity with deep learning model quantization frameworks.",
        transparency_breakdown={
            "technical_weight": "35%",
            "problem_solving_weight": "25%",
            "skills_weight": "20%",
            "communication_weight": "10%",
            "project_weight": "10%"
        },
        candidate_visible_feedback="Very solid interview performance with excellent articulation.",
        recruiter_confidential_notes="Great engineering pedigree, strong candidate."
    )
    db.add(report2)

    # 10. Activity Events for Candidates
    db.add(UserActivityEvent(
        user_id=cand1.id,
        event_type="account_created",
        description="Candidate account created and verified.",
        metadata_json={"role": "candidate"}
    ))
    db.add(UserActivityEvent(
        user_id=cand1.id,
        event_type="resume_uploaded",
        resource_type="resume_file",
        resource_id=dummy_resume1.id,
        description="Uploaded resume Alex_Chen_Senior_AI_Resume.pdf",
        metadata_json={"skills_extracted": len(dummy_resume1.extracted_skills)}
    ))
    db.add(UserActivityEvent(
        user_id=cand1.id,
        event_type="application_submitted",
        resource_type="application",
        resource_id=app1.id,
        description=f"Submitted application for {job1.title}",
        metadata_json={"match_score": app1.resume_match_score}
    ))
    db.add(UserActivityEvent(
        user_id=cand1.id,
        event_type="interview_completed",
        resource_type="interview_session",
        resource_id=sess1.id,
        description=f"Completed AI technical interview with overall score {report1.overall_score}%",
        metadata_json={"overall_score": report1.overall_score}
    ))

    # 11. Notifications for Candidates
    db.add(Notification(
        user_id=cand1.id,
        title="Application Received",
        message=f"Your application for {job1.title} at Global Tech Solutions has been received.",
        notification_type="status_change",
        link=f"/candidate/applications/{app1.id}"
    ))
    db.add(Notification(
        user_id=cand1.id,
        title="AI Interview Assessment Ready",
        message=f"Your interview report for {job1.title} is now available. Overall score: {report1.overall_score}%.",
        notification_type="interview",
        link=f"/candidate/results/{report1.id}"
    ))

    # 12. Audit Events
    db.add(AuditEvent(
        organization_id=org.id,
        actor_id=hr_user.id,
        actor_role="hr",
        action="JOB_PUBLISHED",
        resource_type="job",
        resource_id=job1.id,
        details_json={"title": job1.title, "department": job1.department}
    ))
    db.add(AuditEvent(
        organization_id=org.id,
        actor_id=cand1.id,
        actor_role="candidate",
        action="APPLICATION_CREATED",
        resource_type="application",
        resource_id=app1.id,
        details_json={"job_id": job1.id, "resume_match": app1.resume_match_score}
    ))

    db.commit()
    print("Database successfully seeded with realistic Smart Recruit demo data!")
