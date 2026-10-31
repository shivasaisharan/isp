import os
import uuid
import io
import pytest
from app.core.database import SessionLocal
from app.models.models import User, Job, Application, ResumeFile, Organization, OrganizationMembership
from app.core.security import create_access_token

def test_candidate_application_auth_and_resume_suite(client):
    """
    Comprehensive test suite verifying:
    1. Unauthenticated requests are rejected with 401
    2. Candidate login and token authorization
    3. Resume upload and metadata retrieval
    4. Resume validation on application submission
    5. Tenant isolation (cannot attach another candidate's resume)
    6. Duplicate application prevention
    7. Application tracking in candidate dashboard & HR applicant pool
    """
    db = SessionLocal()

    # 1. Setup HR Recruiter and Job Opening
    hr_email = f"hr.lead.{uuid.uuid4().hex[:6]}@smartrecruit.io"
    hr_reg = client.post("/api/v1/auth/hr/register", json={
        "email": hr_email,
        "password": "Password123!",
        "full_name": "Eleanor Vance",
        "organization_name": "Vertex Systems Inc"
    })
    assert hr_reg.status_code == 201, hr_reg.text
    hr_token = hr_reg.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    job_res = client.post("/api/v1/jobs", json={
        "title": f"Senior Full Stack Engineer {uuid.uuid4().hex[:4]}",
        "department": "Engineering",
        "experience_level": "Senior",
        "location": "San Francisco, CA (Hybrid)",
        "employment_type": "Full-Time",
        "required_skills": ["React", "FastAPI", "PostgreSQL", "Docker"],
        "description": "Architect modern distributed web applications with real-time analytics.",
        "status": "published"
    }, headers=hr_headers)
    assert job_res.status_code == 201
    job_id = job_res.json()["id"]

    # 2. Setup Two Distinct Candidates (Candidate A and Candidate B)
    cand_a_email = f"cand.alice.{uuid.uuid4().hex[:6]}@example.com"
    cand_a_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_a_email,
        "password": "Password123!",
        "full_name": "Alice Cooper"
    })
    assert cand_a_reg.status_code == 201
    cand_a_token = cand_a_reg.json()["access_token"]
    cand_a_headers = {"Authorization": f"Bearer {cand_a_token}"}

    cand_b_email = f"cand.bob.{uuid.uuid4().hex[:6]}@example.com"
    cand_b_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_b_email,
        "password": "Password123!",
        "full_name": "Bob Dylan"
    })
    assert cand_b_reg.status_code == 201
    cand_b_token = cand_b_reg.json()["access_token"]
    cand_b_headers = {"Authorization": f"Bearer {cand_b_token}"}

    # -------------------------------------------------------------------------
    # SCENARIO 1: Unauthenticated request to apply fails with 401
    # -------------------------------------------------------------------------
    no_auth_res = client.post("/api/v1/applications", json={"job_id": job_id})
    assert no_auth_res.status_code == 401
    assert "Authentication credentials were not provided" in no_auth_res.json()["detail"]

    # -------------------------------------------------------------------------
    # SCENARIO 2: Candidate A has no resumes initially
    # -------------------------------------------------------------------------
    resumes_res = client.get("/api/v1/candidate/resumes", headers=cand_a_headers)
    assert resumes_res.status_code == 200
    assert resumes_res.json() == []

    # -------------------------------------------------------------------------
    # SCENARIO 3: Candidate A uploads a PDF resume
    # -------------------------------------------------------------------------
    pdf_content = b"%PDF-1.4 sample content with React, FastAPI, Python and SQL skills"
    upload_res = client.post(
        "/api/v1/candidate/resumes/upload",
        files={"file": ("Alice_Cooper_Resume.pdf", io.BytesIO(pdf_content), "application/pdf")},
        headers=cand_a_headers
    )
    assert upload_res.status_code == 201
    cand_a_resume_id = upload_res.json()["id"]
    assert cand_a_resume_id is not None

    # Verify resume listing returns rich metadata
    list_res = client.get("/api/v1/candidate/resumes", headers=cand_a_headers)
    assert list_res.status_code == 200
    resumes_list = list_res.json()
    assert len(resumes_list) == 1
    assert resumes_list[0]["id"] == cand_a_resume_id
    assert resumes_list[0]["file_name"] == "Alice_Cooper_Resume.pdf"
    assert resumes_list[0]["file_type"] == "PDF"
    assert resumes_list[0]["status"] == "Active"

    # Candidate B also uploads their own resume
    b_pdf_content = b"%PDF-1.4 Bob Dylan CV machine learning and python"
    b_upload = client.post(
        "/api/v1/candidate/resumes/upload",
        files={"file": ("Bob_Dylan_Resume.pdf", io.BytesIO(b_pdf_content), "application/pdf")},
        headers=cand_b_headers
    )
    assert b_upload.status_code == 201
    cand_b_resume_id = b_upload.json()["id"]

    # -------------------------------------------------------------------------
    # SCENARIO 4: Security Isolation - Candidate A cannot use Candidate B's resume
    # -------------------------------------------------------------------------
    hacked_apply = client.post("/api/v1/applications", json={
        "job_id": job_id,
        "resume_file_id": cand_b_resume_id
    }, headers=cand_a_headers)
    assert hacked_apply.status_code == 400
    assert "Selected resume does not belong to your account" in hacked_apply.json()["detail"]

    # -------------------------------------------------------------------------
    # SCENARIO 5: Candidate A applies with valid owned resume
    # -------------------------------------------------------------------------
    apply_res = client.post("/api/v1/applications", json={
        "job_id": job_id,
        "resume_file_id": cand_a_resume_id
    }, headers=cand_a_headers)
    assert apply_res.status_code == 201
    app_data = apply_res.json()
    assert app_data["job_id"] == job_id
    assert app_data["status"] == "submitted"
    assert app_data["has_resume"] is True
    assert app_data["resume_file_name"] == "Alice_Cooper_Resume.pdf"
    app_id = app_data["id"]

    # -------------------------------------------------------------------------
    # SCENARIO 6: Duplicate application prevention
    # -------------------------------------------------------------------------
    dup_apply = client.post("/api/v1/applications", json={
        "job_id": job_id,
        "resume_file_id": cand_a_resume_id
    }, headers=cand_a_headers)
    assert dup_apply.status_code == 400
    assert "already submitted" in dup_apply.json()["detail"]

    # -------------------------------------------------------------------------
    # SCENARIO 7: Candidate views applied jobs in /candidate/all
    # -------------------------------------------------------------------------
    all_apps = client.get("/api/v1/applications/candidate/all", headers=cand_a_headers)
    assert all_apps.status_code == 200
    all_apps_list = all_apps.json()
    assert any(a["job_id"] == job_id for a in all_apps_list)

    # -------------------------------------------------------------------------
    # SCENARIO 8: HR Applicant Pool reflects submitted application & resume
    # -------------------------------------------------------------------------
    hr_apps = client.get(f"/api/v1/applications/job/{job_id}/applicants", headers=hr_headers)
    assert hr_apps.status_code == 200
    pool = hr_apps.json()
    assert len(pool) >= 1
    cand_entry = next((c for c in pool if c["candidate_name"] == "Alice Cooper"), None)
    assert cand_entry is not None
    assert cand_entry["has_resume"] is True
    assert cand_entry["resume_file_name"] == "Alice_Cooper_Resume.pdf"

    db.close()
