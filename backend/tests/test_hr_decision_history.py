import uuid
import pytest
from app.core.database import SessionLocal
from app.services.decision_service import recover_historical_decisions

def get_hr_auth_headers(client, email="hr@smartrecruit.io", password="recruiter123"):
    login_res = client.post("/api/v1/auth/hr/login", json={
        "email": email,
        "password": password
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def create_candidate_application(client, hr_headers, job_id, name="Test Candidate"):
    cand_email = f"cand.{uuid.uuid4().hex[:8]}@example.com"
    cand_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_email,
        "password": "Password123!",
        "full_name": name
    })
    assert cand_reg.status_code == 201
    cand_token = cand_reg.json()["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}

    apply_res = client.post("/api/v1/applications", json={"job_id": job_id}, headers=cand_headers)
    assert apply_res.status_code == 201
    return apply_res.json()["id"], cand_headers

def test_hr_decision_history_full_suite(client):
    hr_headers = get_hr_auth_headers(client)

    # Create test job opening
    job_res = client.post("/api/v1/jobs", json={
        "title": f"Senior AI Systems Engineer {uuid.uuid4().hex[:4]}",
        "department": "Machine Learning",
        "experience_level": "Senior",
        "location": "Remote",
        "employment_type": "Full-Time",
        "required_skills": ["Python", "PyTorch", "FastAPI"],
        "description": "Building high-performance inference services.",
        "status": "published"
    }, headers=hr_headers)
    assert job_res.status_code == 201
    job_id = job_res.json()["id"]

    # --- TEST 1: HR accepts a candidate ---
    app1_id, _ = create_candidate_application(client, hr_headers, job_id, "Candidate One")
    acc_res = client.post(f"/api/v1/decisions/applications/{app1_id}/accept", json={
        "notes": "Exceptional PyTorch and distributed inference background."
    }, headers=hr_headers)
    assert acc_res.status_code == 200

    # Verify ACCEPTED appears in /api/v1/hr/decisions
    list_res = client.get(f"/api/v1/hr/decisions?candidate_search=Candidate One", headers=hr_headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) >= 1
    assert items[0]["decision"] == "ACCEPTED"
    assert items[0]["application_id"] == app1_id
    assert "PyTorch" in items[0]["decision_notes"]

    # --- TEST 2: HR rejects a candidate ---
    app2_id, _ = create_candidate_application(client, hr_headers, job_id, "Candidate Two")
    rej_res = client.post(f"/api/v1/decisions/applications/{app2_id}/reject", json={
        "notes": "Does not meet required senior experience threshold."
    }, headers=hr_headers)
    assert rej_res.status_code == 200

    # Verify REJECTED appears in /api/v1/hr/decisions
    rej_list = client.get(f"/api/v1/hr/decisions?candidate_search=Candidate Two", headers=hr_headers)
    assert rej_list.status_code == 200
    rej_items = rej_list.json()["items"]
    assert len(rej_items) >= 1
    assert rej_items[0]["decision"] == "REJECTED"
    assert rej_items[0]["application_id"] == app2_id

    # --- TEST 3: HR accepts three candidates and rejects two candidates ---
    batch_job_res = client.post("/api/v1/jobs", json={
        "title": f"Batch Role {uuid.uuid4().hex[:4]}",
        "department": "Platform",
        "experience_level": "Mid",
        "location": "Hybrid",
        "employment_type": "Full-Time",
        "required_skills": ["Go", "Docker"],
        "description": "Batch testing position.",
        "status": "published"
    }, headers=hr_headers)
    batch_job_id = batch_job_res.json()["id"]

    batch_acc_apps = []
    for i in range(3):
        app_id, _ = create_candidate_application(client, hr_headers, batch_job_id, f"Batch Accept {i}")
        res = client.post(f"/api/v1/decisions/applications/{app_id}/accept", json={
            "notes": f"Verified competency for candidate {i}."
        }, headers=hr_headers)
        assert res.status_code == 200
        batch_acc_apps.append(app_id)

    batch_rej_apps = []
    for j in range(2):
        app_id, _ = create_candidate_application(client, hr_headers, batch_job_id, f"Batch Reject {j}")
        res = client.post(f"/api/v1/decisions/applications/{app_id}/reject", json={
            "notes": f"Missing prerequisites for candidate {j}."
        }, headers=hr_headers)
        assert res.status_code == 200
        batch_rej_apps.append(app_id)

    # Check that at least 5 batch records exist for this job
    batch_check = client.get(f"/api/v1/hr/decisions?job_title_search=Batch Role", headers=hr_headers)
    assert batch_check.status_code == 200
    assert len(batch_check.json()["items"]) >= 5

    # --- TEST 4: Select All Decisions ---
    all_decisions = client.get("/api/v1/hr/decisions?decision_type=all", headers=hr_headers)
    assert all_decisions.status_code == 200
    all_types = {d["decision"] for d in all_decisions.json()["items"]}
    assert "ACCEPTED" in all_types
    assert "REJECTED" in all_types

    # --- TEST 5: Select Accepted only ---
    only_accepted = client.get("/api/v1/hr/decisions?decision_type=ACCEPTED", headers=hr_headers)
    assert only_accepted.status_code == 200
    for d in only_accepted.json()["items"]:
        assert d["decision"] == "ACCEPTED"

    # --- TEST 6: Select Rejected only ---
    only_rejected = client.get("/api/v1/hr/decisions?decision_type=REJECTED", headers=hr_headers)
    assert only_rejected.status_code == 200
    assert len(only_rejected.json()["items"]) >= 3  # app2 + 2 batch rejected
    for d in only_rejected.json()["items"]:
        assert d["decision"] == "REJECTED"

    # --- TEST 7: Summary counts reflect actual database numbers ---
    summary_res = client.get("/api/v1/hr/decisions/summary", headers=hr_headers)
    assert summary_res.status_code == 200
    sum_data = summary_res.json()
    assert sum_data["total_decisions"] >= 7
    assert sum_data["total_accepted"] >= 4
    assert sum_data["total_rejected"] >= 3

    # --- TEST 8: Log out and log back in: retrieve decisions ---
    new_login_headers = get_hr_auth_headers(client)
    refreshed_list = client.get("/api/v1/hr/decisions", headers=new_login_headers)
    assert refreshed_list.status_code == 200
    assert len(refreshed_list.json()["items"]) >= 7

    # --- TEST 9: Tenant isolation: Attempt to access another organization's records ---
    # Register a new HR user for a separate organization
    other_org_reg = client.post("/api/v1/auth/hr/register", json={
        "email": f"hr.other.{uuid.uuid4().hex[:6]}@competitor.com",
        "password": "Password123!",
        "full_name": "External Recruiter",
        "organization_name": f"Other Enterprise {uuid.uuid4().hex[:4]}"
    })
    assert other_org_reg.status_code == 201
    other_token = other_org_reg.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # Other organization should see 0 records from the first org
    other_list = client.get("/api/v1/hr/decisions", headers=other_headers)
    assert other_list.status_code == 200
    assert other_list.json()["total"] == 0

    # --- TEST 10: Duplicate decision safeguard ---
    # Attempt to accept already accepted application app1_id
    dup_acc = client.post(f"/api/v1/decisions/applications/{app1_id}/accept", json={
        "notes": "Attempting second duplicate accept"
    }, headers=hr_headers)
    assert dup_acc.status_code == 400
    assert "already been accepted" in dup_acc.json()["detail"].lower()

    # Attempt to reject already rejected application app2_id
    dup_rej = client.post(f"/api/v1/decisions/applications/{app2_id}/reject", json={
        "notes": "Attempting second duplicate reject"
    }, headers=hr_headers)
    assert dup_rej.status_code == 400
    assert "already been rejected" in dup_rej.json()["detail"].lower()

    # --- TEST 11: Inspect a decision (View Details) ---
    first_dec_id = all_decisions.json()["items"][0]["id"]
    detail_res = client.get(f"/api/v1/hr/decisions/{first_dec_id}", headers=hr_headers)
    assert detail_res.status_code == 200
    dec_detail = detail_res.json()
    assert dec_detail["id"] == first_dec_id
    assert dec_detail["candidate_name"] is not None
    assert dec_detail["job_title"] is not None
    assert dec_detail["reviewer_name"] is not None
    assert dec_detail["decision_notes"] is not None
    assert dec_detail["decided_at"] is not None

    # --- TEST 12: Idempotent historical data recovery migration ---
    db = SessionLocal()
    try:
        run1 = recover_historical_decisions(db)
        run2 = recover_historical_decisions(db)
        assert run2 == 0  # Second run must recover 0 new duplicates
    finally:
        db.close()
