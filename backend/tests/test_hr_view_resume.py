import uuid
import pytest
from app.models.models import Application, ResumeFile, Job, User, Organization, OrganizationMembership
from app.core.config import settings
from app.core.database import SessionLocal

def get_hr_auth(client):
    login = client.post("/api/v1/auth/hr/login", json={
        "email": "hr@smartrecruit.io",
        "password": "recruiter123"
    })
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_hr_view_resume_complete_suite(client):
    db_session = SessionLocal()
    hr_headers = get_hr_auth(client)

    # 1. Look up Alex Chen and Shiva Sai Sharan Reddy
    alex_chen = db_session.query(User).filter(User.full_name == "Alex Chen").first()
    shiva_reddy = db_session.query(User).filter(User.full_name == "Shiva Sai Sharan Reddy").first()
    assert alex_chen is not None, "Alex Chen user must exist in DB"
    assert shiva_reddy is not None, "Shiva Sai Sharan Reddy user must exist in DB"

    # Find jobs and applications for Alex Chen
    alex_app = db_session.query(Application).filter(Application.candidate_id == alex_chen.id).first()
    assert alex_app is not None, "Alex Chen must have an application"

    shiva_app = db_session.query(Application).filter(Application.candidate_id == shiva_reddy.id).first()
    assert shiva_app is not None, "Shiva Sai Sharan Reddy must have an application"

    # -------------------------------------------------------------------------
    # TEST 1 & 3: HR can open Alex Chen's resume & verify application reference
    # -------------------------------------------------------------------------
    res_alex = client.get(f"/api/v1/hr/applications/{alex_app.id}/resume", headers=hr_headers)
    assert res_alex.status_code == 200
    alex_data = res_alex.json()
    assert alex_data["application_id"] == alex_app.id
    assert alex_data["candidate_name"] == "Alex Chen"
    assert alex_data["candidate_id"] == alex_chen.id
    assert "resume" in alex_data
    assert alex_data["resume"]["file_name"] is not None
    assert alex_data["resume"]["file_type"] == "application/pdf"
    assert alex_data["resume"]["stream_url"] is not None

    # Test stream / download for Alex Chen's resume (TEST 4)
    stream_url = alex_data["resume"]["stream_url"]
    file_res = client.get(stream_url)
    assert file_res.status_code == 200
    assert "application/pdf" in file_res.headers.get("content-type", "")
    assert len(file_res.content) > 0
    # First 4 bytes must be standard PDF magic number %PDF
    assert file_res.content[:4] == b"%PDF"

    # -------------------------------------------------------------------------
    # TEST 2 & 3: HR can open Shiva Sai Sharan Reddy's resume
    # -------------------------------------------------------------------------
    res_shiva = client.get(f"/api/v1/hr/applications/{shiva_app.id}/resume", headers=hr_headers)
    assert res_shiva.status_code == 200
    shiva_data = res_shiva.json()
    assert shiva_data["application_id"] == shiva_app.id
    assert shiva_data["candidate_name"] == "Shiva Sai Sharan Reddy"
    assert shiva_data["candidate_id"] == shiva_reddy.id
    assert "resume" in shiva_data
    assert shiva_data["resume"]["file_name"] is not None

    file_shiva = client.get(shiva_data["resume"]["stream_url"])
    assert file_shiva.status_code == 200
    assert "application/pdf" in file_shiva.headers.get("content-type", "")
    assert file_shiva.content[:4] == b"%PDF"

    # -------------------------------------------------------------------------
    # TEST 6: Download functionality works (attachment disposition header)
    # -------------------------------------------------------------------------
    download_url = alex_data["resume"]["download_url"]
    download_res = client.get(download_url)
    assert download_res.status_code == 200
    assert "attachment" in download_res.headers.get("content-disposition", "")
    assert alex_data["resume"]["file_name"] in download_res.headers.get("content-disposition", "")

    # -------------------------------------------------------------------------
    # TEST 7 & 8: Resumes remain accessible for Accepted and Rejected candidates
    # -------------------------------------------------------------------------
    # Create test candidate and test job
    new_job = client.post("/api/v1/jobs", json={
        "title": f"Resume Workflow Test Engineer {uuid.uuid4().hex[:6]}",
        "department": "Engineering",
        "experience_level": "Senior",
        "location": "Remote",
        "employment_type": "Full-Time",
        "required_skills": ["Python", "FastAPI"],
        "description": "Testing resume access across hiring decisions.",
        "status": "published"
    }, headers=hr_headers)
    assert new_job.status_code == 201
    job_id = new_job.json()["id"]

    # Candidate 1: Uploads resume, applies, gets accepted
    cand1_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": f"cand1.{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!",
        "full_name": "Accepted Candidate With Resume"
    })
    cand1_token = cand1_reg.json()["access_token"]
    cand1_headers = {"Authorization": f"Bearer {cand1_token}"}
    cand1_id = cand1_reg.json()["user"]["id"]

    # Candidate 1 uploads a valid PDF resume
    sample_pdf_bytes = b"%PDF-1.4 sample resume content with Python FastAPI Kubernetes experience"
    upload_res = client.post(
        "/api/v1/candidate/resumes/upload",
        files={"file": ("candidate_one_resume.pdf", sample_pdf_bytes, "application/pdf")},
        headers=cand1_headers
    )
    assert upload_res.status_code == 201
    cand1_resume_id = upload_res.json()["id"]

    # Candidate 1 applies for the job
    app1_res = client.post("/api/v1/applications", json={"job_id": job_id, "resume_file_id": cand1_resume_id}, headers=cand1_headers)
    assert app1_res.status_code == 201
    app1_id = app1_res.json()["id"]

    # HR accepts Candidate 1
    dec1 = client.post(f"/api/v1/hr/applications/{app1_id}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Candidate 1 selected after strong evaluation."
    }, headers=hr_headers)
    assert dec1.status_code == 200

    # Verify resume is still accessible after acceptance (TEST 7)
    res_app1_after_accept = client.get(f"/api/v1/hr/applications/{app1_id}/resume", headers=hr_headers)
    assert res_app1_after_accept.status_code == 200
    assert res_app1_after_accept.json()["resume"]["file_name"] == "candidate_one_resume.pdf"

    # Candidate 2: Uploads resume, applies, gets rejected
    cand2_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": f"cand2.{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!",
        "full_name": "Rejected Candidate With Resume"
    })
    cand2_headers = {"Authorization": f"Bearer {cand2_reg.json()['access_token']}"}

    upload2_res = client.post(
        "/api/v1/candidate/resumes/upload",
        files={"file": ("candidate_two_resume.pdf", sample_pdf_bytes, "application/pdf")},
        headers=cand2_headers
    )
    assert upload2_res.status_code == 201
    cand2_resume_id = upload2_res.json()["id"]

    app2_res = client.post("/api/v1/applications", json={"job_id": job_id, "resume_file_id": cand2_resume_id}, headers=cand2_headers)
    assert app2_res.status_code == 201
    app2_id = app2_res.json()["id"]

    # HR rejects Candidate 2
    dec2 = client.post(f"/api/v1/hr/applications/{app2_id}/decision", json={
        "decision": "REJECTED",
        "decision_notes": "Candidate 2 not moving forward."
    }, headers=hr_headers)
    assert dec2.status_code == 200

    # Verify resume is still accessible after rejection (TEST 8)
    res_app2_after_reject = client.get(f"/api/v1/hr/applications/{app2_id}/resume", headers=hr_headers)
    assert res_app2_after_reject.status_code == 200
    assert res_app2_after_reject.json()["resume"]["file_name"] == "candidate_two_resume.pdf"

    # -------------------------------------------------------------------------
    # TEST 9: Candidate without a resume returns 404 Resume Not Available
    # -------------------------------------------------------------------------
    cand3_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": f"cand3.{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!",
        "full_name": "Candidate Without Resume"
    })
    cand3_headers = {"Authorization": f"Bearer {cand3_reg.json()['access_token']}"}
    app3_res = client.post("/api/v1/applications", json={"job_id": job_id}, headers=cand3_headers)
    assert app3_res.status_code == 201
    app3_id = app3_res.json()["id"]

    no_res = client.get(f"/api/v1/hr/applications/{app3_id}/resume", headers=hr_headers)
    assert no_res.status_code == 404
    assert "Resume Not Available" in no_res.json()["detail"]

    # -------------------------------------------------------------------------
    # TEST 10: Unauthorized access blocked (Unauthenticated or non-HR candidate)
    # -------------------------------------------------------------------------
    # Unauthenticated
    unauth_res = client.get(f"/api/v1/hr/applications/{app1_id}/resume")
    assert unauth_res.status_code in [401, 403]

    # Non-HR candidate attempting to access HR resume endpoint
    forbidden_res = client.get(f"/api/v1/hr/applications/{app1_id}/resume", headers=cand1_headers)
    assert forbidden_res.status_code == 403

    # Invalid file stream token
    bad_token_res = client.get(f"/api/v1/hr/applications/{app1_id}/resume/file?token=invalid_forged_token")
    assert bad_token_res.status_code == 401

    # -------------------------------------------------------------------------
    # TEST 11: Multi-tenant isolation: Tenant B cannot access Tenant A's resumes
    # -------------------------------------------------------------------------
    # Register a new HR user and Organization B
    other_hr_email = f"other_hr.{uuid.uuid4().hex[:6]}@externalcorp.com"
    reg_other_hr = client.post("/api/v1/auth/hr/register", json={
        "email": other_hr_email,
        "password": "Password123!",
        "full_name": "External Recruiter",
        "organization_name": f"External Corp Competitor {uuid.uuid4().hex[:4]}"
    })
    assert reg_other_hr.status_code == 201
    other_hr_token = reg_other_hr.json()["access_token"]
    other_hr_headers = {"Authorization": f"Bearer {other_hr_token}"}

    # Tenant B tries to access Tenant A's candidate resume
    cross_tenant_res = client.get(f"/api/v1/hr/applications/{app1_id}/resume", headers=other_hr_headers)
    assert cross_tenant_res.status_code == 403
    assert "belongs to another organization" in cross_tenant_res.json()["detail"]

    # -------------------------------------------------------------------------
    # TEST 12: Top-5 and Applicant Pool both show has_resume=True and same file
    # -------------------------------------------------------------------------
    applicants_list = client.get(f"/api/v1/applications/job/{job_id}/applicants", headers=hr_headers).json()
    cand1_app_in_pool = next((a for a in applicants_list if a["id"] == app1_id), None)
    assert cand1_app_in_pool is not None
    assert cand1_app_in_pool["has_resume"] is True
    assert cand1_app_in_pool["resume_file_name"] == "candidate_one_resume.pdf"

    cand3_app_in_pool = next((a for a in applicants_list if a["id"] == app3_id), None)
    assert cand3_app_in_pool is not None
    assert cand3_app_in_pool["has_resume"] is False

    top_cands = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=hr_headers).json()
    cand1_in_top = next((c for c in top_cands if c["application_id"] == app1_id), None)
    if cand1_in_top:
        assert cand1_in_top["has_resume"] is True
        assert cand1_in_top["resume_file_name"] == "candidate_one_resume.pdf"

    # -------------------------------------------------------------------------
    # TEST 13: Resume viewing does not alter candidate status or ranking
    # -------------------------------------------------------------------------
    app1_record_before = db_session.query(Application).filter(Application.id == app1_id).first()
    status_before = app1_record_before.status
    rank_before = app1_record_before.overall_ranking_score

    # View resume multiple times
    client.get(f"/api/v1/hr/applications/{app1_id}/resume", headers=hr_headers)
    token_val = client.get(f"/api/v1/hr/applications/{app1_id}/resume", headers=hr_headers).json()["resume"]["stream_url"].split("token=")[1]
    client.get(f"/api/v1/hr/applications/{app1_id}/resume/file?token={token_val}")

    db_session.expire_all()
    app1_record_after = db_session.query(Application).filter(Application.id == app1_id).first()
    assert app1_record_after.status == status_before
    assert app1_record_after.overall_ranking_score == rank_before
    db_session.close()
