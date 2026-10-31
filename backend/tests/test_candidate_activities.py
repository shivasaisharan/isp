import uuid
import pytest
from app.core.database import SessionLocal
from app.services.activity_service import backfill_historical_recruitment_activities
from app.models.models import UserActivityEvent, CandidateRecruitmentActivity

def get_hr_auth_headers(client, email="hr@smartrecruit.io", password="recruiter123"):
    login_res = client.post("/api/v1/auth/hr/login", json={
        "email": email,
        "password": password
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def create_candidate(client, name="Activity Candidate"):
    cand_email = f"act.cand.{uuid.uuid4().hex[:8]}@example.com"
    cand_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_email,
        "password": "Password123!",
        "full_name": name
    })
    assert cand_reg.status_code == 201
    cand_token = cand_reg.json()["access_token"]
    return cand_reg.json()["user"], {"Authorization": f"Bearer {cand_token}"}, cand_email

def test_auth_noise_excluded_from_candidate_activity(client):
    """
    Ensure login, logout, and token session events are NOT returned in candidate activity feeds.
    """
    user, headers, email = create_candidate(client)

    # Perform repeated logins
    for _ in range(3):
        res = client.post("/api/v1/auth/candidate/login", json={
            "email": email,
            "password": "Password123!"
        })
        assert res.status_code == 200

    # Query /api/v1/candidate/activities
    cand_act_res = client.get("/api/v1/candidate/activities", headers=headers)
    assert cand_act_res.status_code == 200
    items = cand_act_res.json()["items"]
    for item in items:
        assert item["activity_type"] not in ["login", "logout", "session_created", "token_refreshed"]

    # Query legacy /api/v1/activity
    legacy_res = client.get("/api/v1/activity", headers=headers)
    assert legacy_res.status_code == 200
    legacy_items = legacy_res.json()
    for item in legacy_items:
        assert item["event_type"] not in ["login", "logout", "session_created", "token_refreshed"]

def test_candidate_recruitment_lifecycle_events(client):
    """
    Test job application, interview, and hiring decision events generation & filtering.
    """
    hr_headers = get_hr_auth_headers(client)

    # 1. Post a job
    job_res = client.post("/api/v1/jobs", json={
        "title": f"Staff ML Platform Engineer {uuid.uuid4().hex[:4]}",
        "department": "Platform AI",
        "experience_level": "Senior",
        "location": "Remote",
        "employment_type": "Full-Time",
        "required_skills": ["Python", "Kubernetes", "Ray"],
        "description": "Orchestrating large distributed models.",
        "status": "published"
    }, headers=hr_headers)
    assert job_res.status_code == 201
    job_id = job_res.json()["id"]

    # 2. Candidate registers and applies
    user, cand_headers, _ = create_candidate(client, "Sophia Martinez")
    apply_res = client.post("/api/v1/applications", json={"job_id": job_id}, headers=cand_headers)
    assert apply_res.status_code == 201
    app_id = apply_res.json()["id"]

    # Verify APPLICATION_SUBMITTED in activity
    activities_res = client.get("/api/v1/candidate/activities", headers=cand_headers)
    assert activities_res.status_code == 200
    items = activities_res.json()["items"]
    app_act = next((a for a in items if a["activity_type"] == "APPLICATION_SUBMITTED"), None)
    assert app_act is not None
    assert app_act["application_id"] == app_id
    assert "Staff ML Platform Engineer" in (app_act["job_title"] or "")

    # 3. Start interview
    interview_start_res = client.post("/api/v1/interviews/start", json={"application_id": app_id}, headers=cand_headers)
    assert interview_start_res.status_code == 200
    session_id = interview_start_res.json()["id"]

    # Verify INTERVIEW_STARTED
    activities_res = client.get("/api/v1/candidate/activities?category=interview", headers=cand_headers)
    assert activities_res.status_code == 200
    items = activities_res.json()["items"]
    assert any(a["activity_type"] == "INTERVIEW_STARTED" for a in items)

    # 4. Complete interview
    complete_res = client.post(f"/api/v1/interviews/{session_id}/complete", headers=cand_headers)
    assert complete_res.status_code == 200

    # Verify INTERVIEW_COMPLETED
    activities_res = client.get("/api/v1/candidate/activities?category=interview", headers=cand_headers)
    assert activities_res.status_code == 200
    items = activities_res.json()["items"]
    assert any(a["activity_type"] == "INTERVIEW_COMPLETED" for a in items)

    # 5. HR records decision (Accept)
    decision_res = client.post(f"/api/v1/decisions/applications/{app_id}/accept", json={
        "notes": "Excellent performance during interview and distributed systems assessment."
    }, headers=hr_headers)
    assert decision_res.status_code == 200

    # Verify APPLICATION_ACCEPTED
    decision_act_res = client.get("/api/v1/candidate/activities?category=decision", headers=cand_headers)
    assert decision_act_res.status_code == 200
    dec_items = decision_act_res.json()["items"]
    assert len(dec_items) >= 1
    assert dec_items[0]["activity_type"] == "APPLICATION_ACCEPTED"
    assert dec_items[0]["status_badge"] == "Accepted"

    # 6. Verify Summary metrics
    summary_res = client.get("/api/v1/candidate/activities/summary", headers=cand_headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_jobs_applied"] >= 1
    assert summary["interviews_completed"] >= 1
    assert summary["applications_accepted"] >= 1

def test_candidate_activity_privacy_and_isolation(client):
    """
    Ensure one candidate cannot read another candidate's recruitment activities.
    """
    _, cand_a_headers, _ = create_candidate(client, "Candidate Alpha")
    _, cand_b_headers, _ = create_candidate(client, "Candidate Beta")

    # Alpha's view
    res_a = client.get("/api/v1/candidate/activities", headers=cand_a_headers)
    assert res_a.status_code == 200

    # Beta's view
    res_b = client.get("/api/v1/candidate/activities", headers=cand_b_headers)
    assert res_b.status_code == 200

    alpha_ids = {item["id"] for item in res_a.json()["items"]}
    beta_ids = {item["id"] for item in res_b.json()["items"]}
    # No crossover
    assert len(alpha_ids.intersection(beta_ids)) == 0

def test_idempotent_activity_backfill():
    """
    Running backfill migration repeatedly should not duplicate recruitment activity records.
    """
    db = SessionLocal()
    try:
        count_1 = backfill_historical_recruitment_activities(db)
        count_2 = backfill_historical_recruitment_activities(db)
        # Second run should backfill 0 additional duplicate records
        assert count_2 == 0
    finally:
        db.close()
