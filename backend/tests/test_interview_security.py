import uuid
import pytest

def test_interview_security_incident_deduplication_and_three_strikes(client):
    # 1. HR logs in and gets an existing published job
    hr_login = client.post("/api/v1/auth/hr/login", json={
        "email": "hr@smartrecruit.io",
        "password": "recruiter123"
    })
    assert hr_login.status_code == 200
    hr_token = hr_login.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    jobs_res = client.get("/api/v1/jobs/organization/all", headers=hr_headers)
    assert jobs_res.status_code == 200
    jobs = jobs_res.json()
    assert len(jobs) > 0
    job_id = jobs[0]["id"]

    # 2. Candidate registers and applies
    cand_email = f"security.cand.{uuid.uuid4().hex[:6]}@example.com"
    cand_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_email,
        "password": "Password123!",
        "full_name": "Taylor Swift"
    })
    assert cand_reg.status_code == 201
    cand_token = cand_reg.json()["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}

    apply_res = client.post("/api/v1/applications", json={
        "job_id": job_id
    }, headers=cand_headers)
    assert apply_res.status_code == 201
    app_id = apply_res.json()["id"]

    # 3. Start AI interview
    interview_start = client.post("/api/v1/interviews/start", json={
        "application_id": app_id,
        "duration_minutes": 15
    }, headers=cand_headers)
    assert interview_start.status_code == 200
    session_id = interview_start.json()["id"]

    # 4. Resume to secure full-screen mode initially
    resume_res = client.post(f"/api/v1/interviews/{session_id}/resume-secure-mode", headers=cand_headers)
    assert resume_res.status_code == 200
    assert resume_res.json()["is_secure_mode"] is True

    sec_status = client.get(f"/api/v1/interviews/{session_id}/security-status", headers=cand_headers)
    assert sec_status.status_code == 200
    assert sec_status.json()["violation_count"] == 0

    # 5. STRIKE 1: Full-screen exit incident
    strike1_res = client.post(f"/api/v1/interviews/{session_id}/violations", json={
        "incident_id": "test-incident-uuid-1",
        "violation_type": "fullscreen_exit",
        "description": "Candidate pressed Escape to exit full-screen mode.",
        "metadata": {"client_timestamp": "2026-10-31T20:00:00Z"}
    }, headers=cand_headers)
    assert strike1_res.status_code == 200
    s1_data = strike1_res.json()
    assert s1_data["deduplicated"] is False
    assert s1_data["violation_count"] == 1
    assert s1_data["is_terminated"] is False

    # Tandem event for same incident (e.g. window blur immediately following full-screen exit)
    tandem_res = client.post(f"/api/v1/interviews/{session_id}/violations", json={
        "incident_id": "test-incident-uuid-1",
        "violation_type": "focus_lost",
        "description": "Interview window lost focus.",
        "metadata": {"client_timestamp": "2026-10-31T20:00:00.050Z"}
    }, headers=cand_headers)
    assert tandem_res.status_code == 200
    assert tandem_res.json()["deduplicated"] is True
    assert tandem_res.json()["violation_count"] == 1

    # 6. CANDIDATE RESUMES FULL-SCREEN
    resume_res = client.post(f"/api/v1/interviews/{session_id}/resume-secure-mode", headers=cand_headers)
    assert resume_res.status_code == 200
    assert resume_res.json()["is_secure_mode"] is True

    # 7. STRIKE 2: Second full-screen exit incident (immediate - NO 10-second delay!)
    strike2_res = client.post(f"/api/v1/interviews/{session_id}/violations", json={
        "incident_id": "test-incident-uuid-2",
        "violation_type": "fullscreen_exit",
        "description": "Candidate pressed Escape again.",
        "metadata": {"client_timestamp": "2026-10-31T20:00:02Z"}
    }, headers=cand_headers)
    assert strike2_res.status_code == 200
    s2_data = strike2_res.json()
    # Must NOT be deduplicated or delayed!
    assert s2_data["deduplicated"] is False
    assert s2_data["violation_count"] == 2
    assert s2_data["is_terminated"] is False

    # 8. CANDIDATE RESUMES FULL-SCREEN AGAIN
    resume_res2 = client.post(f"/api/v1/interviews/{session_id}/resume-secure-mode", headers=cand_headers)
    assert resume_res2.status_code == 200

    # 9. STRIKE 3: Third full-screen exit -> AUTOMATIC TERMINATION & FLAGGING FOR HR REVIEW
    strike3_res = client.post(f"/api/v1/interviews/{session_id}/violations", json={
        "incident_id": "test-incident-uuid-3",
        "violation_type": "fullscreen_exit",
        "description": "Candidate exited full-screen 3rd time.",
        "metadata": {"client_timestamp": "2026-10-31T20:00:04Z"}
    }, headers=cand_headers)
    assert strike3_res.status_code == 200
    s3_data = strike3_res.json()
    assert s3_data["deduplicated"] is False
    assert s3_data["violation_count"] == 3
    assert s3_data["is_terminated"] is True
    assert "flagged for human HR evaluation" in s3_data["termination_reason"]

    # 10. VERIFY SESSION STATUS IN DATABASE
    status_res = client.get(f"/api/v1/interviews/{session_id}/security-status", headers=cand_headers)
    assert status_res.status_code == 200
    final_status = status_res.json()
    assert final_status["is_terminated"] is True
    assert final_status["flagged_for_review"] is True
    assert final_status["violation_count"] == 3
