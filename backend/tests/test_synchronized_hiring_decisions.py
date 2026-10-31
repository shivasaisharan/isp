import uuid
import pytest

def get_hr_auth(client):
    login = client.post("/api/v1/auth/hr/login", json={
        "email": "hr@smartrecruit.io",
        "password": "recruiter123"
    })
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def create_candidate_and_apply(client, job_id, full_name):
    email = f"cand.{uuid.uuid4().hex[:6]}@example.com"
    reg = client.post("/api/v1/auth/candidate/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": full_name
    })
    assert reg.status_code == 201
    cand_token = reg.json()["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}
    cand_id = reg.json()["user"]["id"]

    apply_res = client.post("/api/v1/applications", json={"job_id": job_id}, headers=cand_headers)
    assert apply_res.status_code == 201
    app_id = apply_res.json()["id"]

    # Start interview session to make candidate evaluated
    client.post("/api/v1/interviews/start", json={"application_id": app_id, "duration_minutes": 15}, headers=cand_headers)

    return {
        "candidate_id": cand_id,
        "application_id": app_id,
        "headers": cand_headers,
        "name": full_name
    }

def test_synchronized_hiring_decisions_full_suite(client):
    hr_headers = get_hr_auth(client)

    # 1. Create a fresh test job opening so Candidate A, B, C, D are guaranteed in Top-5
    new_job = client.post("/api/v1/jobs", json={
        "title": f"Principal Platform Architect {uuid.uuid4().hex[:6]}",
        "department": "Cloud Architecture",
        "experience_level": "Staff",
        "location": "Remote",
        "employment_type": "Full-Time",
        "required_skills": ["Kubernetes", "Go", "Distributed Systems", "AWS"],
        "description": "Architect next-generation global multi-tenant microservices.",
        "status": "published"
    }, headers=hr_headers)
    assert new_job.status_code == 201
    job_id = new_job.json()["id"]

    # Setup candidates
    cand_a = create_candidate_and_apply(client, job_id, "Candidate Alpha")
    cand_b = create_candidate_and_apply(client, job_id, "Candidate Beta")
    cand_c = create_candidate_and_apply(client, job_id, "Candidate Gamma")
    cand_d = create_candidate_and_apply(client, job_id, "Candidate Delta")

    # -------------------------------------------------------------------------
    # TEST 1: Accept Candidate A via Unified Decision Endpoint
    # -------------------------------------------------------------------------
    dec_a = client.post(f"/api/v1/hr/applications/{cand_a['application_id']}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Candidate Alpha demonstrated exceptional leadership and cloud systems mastery."
    }, headers=hr_headers)
    assert dec_a.status_code == 200
    assert dec_a.json()["decision"] == "ACCEPTED"
    assert dec_a.json()["status"] == "accepted"

    # Verify Top-5 shows status as accepted
    top5_res = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=hr_headers)
    assert top5_res.status_code == 200
    top5 = top5_res.json()
    match_a = next((c for c in top5 if c["application_id"] == cand_a["application_id"]), None)
    assert match_a is not None
    assert match_a["status"] == "accepted"

    # Verify Applicant Pool shows status as accepted
    applicants_res = client.get(f"/api/v1/applications/job/{job_id}/applicants", headers=hr_headers)
    assert applicants_res.status_code == 200
    apps = applicants_res.json()
    app_match_a = next((a for a in apps if a["id"] == cand_a["application_id"]), None)
    assert app_match_a is not None
    assert app_match_a["status"] == "accepted"

    # -------------------------------------------------------------------------
    # TEST 2: Reject Candidate B via Unified Decision Endpoint
    # -------------------------------------------------------------------------
    dec_b = client.post(f"/api/v1/hr/applications/{cand_b['application_id']}/decision", json={
        "decision": "REJECTED",
        "decision_notes": "Candidate Beta lacked required hands-on distributed database architecture skills."
    }, headers=hr_headers)
    assert dec_b.status_code == 200
    assert dec_b.json()["decision"] == "REJECTED"
    assert dec_b.json()["status"] == "rejected"

    # Verify Top-5 shows status as rejected
    top5_res = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=hr_headers)
    match_b = next((c for c in top5_res.json() if c["application_id"] == cand_b["application_id"]), None)
    assert match_b is not None
    assert match_b["status"] == "rejected"

    # -------------------------------------------------------------------------
    # TEST 3: Accept Candidate C from Top-5 via applications decision route
    # -------------------------------------------------------------------------
    dec_c = client.post(f"/api/v1/applications/{cand_c['application_id']}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Candidate Gamma demonstrated strong competencies and overall fit."
    }, headers=hr_headers)
    assert dec_c.status_code == 200
    assert dec_c.json()["status"] == "accepted"

    # Verify Applicant Pool immediately shows accepted
    apps_after_c = client.get(f"/api/v1/applications/job/{job_id}/applicants", headers=hr_headers).json()
    match_c_app = next((a for a in apps_after_c if a["id"] == cand_c["application_id"]), None)
    assert match_c_app is not None
    assert match_c_app["status"] == "accepted"

    # -------------------------------------------------------------------------
    # TEST 4: Reject Candidate D from Top-5
    # -------------------------------------------------------------------------
    dec_d = client.post(f"/api/v1/applications/{cand_d['application_id']}/decision", json={
        "decision": "REJECTED",
        "decision_notes": "Candidate Delta did not meet requisite experience criteria."
    }, headers=hr_headers)
    assert dec_d.status_code == 200
    assert dec_d.json()["status"] == "rejected"

    # Verify Top-5 and Applicant Pool both show rejected
    top5_after_d = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=hr_headers).json()
    match_d_top = next((c for c in top5_after_d if c["application_id"] == cand_d["application_id"]), None)
    assert match_d_top is not None
    assert match_d_top["status"] == "rejected"

    apps_after_d = client.get(f"/api/v1/applications/job/{job_id}/applicants", headers=hr_headers).json()
    match_d_app = next((a for a in apps_after_d if a["id"] == cand_d["application_id"]), None)
    assert match_d_app is not None
    assert match_d_app["status"] == "rejected"

    # -------------------------------------------------------------------------
    # TEST 5: Refresh both pages - check database persistence
    # -------------------------------------------------------------------------
    # Simulate fresh fetch of rankings and applicants
    top5_fresh = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=hr_headers).json()
    apps_fresh = client.get(f"/api/v1/applications/job/{job_id}/applicants", headers=hr_headers).json()

    for app_id, expected_status in [
        (cand_a["application_id"], "accepted"),
        (cand_b["application_id"], "rejected"),
        (cand_c["application_id"], "accepted"),
        (cand_d["application_id"], "rejected")
    ]:
        top_cand = next((c for c in top5_fresh if c["application_id"] == app_id), None)
        assert top_cand is not None
        assert top_cand["status"] == expected_status

        pool_cand = next((a for a in apps_fresh if a["id"] == app_id), None)
        assert pool_cand is not None
        assert pool_cand["status"] == expected_status

    # -------------------------------------------------------------------------
    # TEST 8: Double-click Accept (Prevent Duplicate Submissions)
    # -------------------------------------------------------------------------
    dup_res = client.post(f"/api/v1/hr/applications/{cand_a['application_id']}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Duplicate acceptance attempt."
    }, headers=hr_headers)
    assert dup_res.status_code == 400
    assert "already been accepted" in dup_res.json()["detail"]

    # -------------------------------------------------------------------------
    # TEST 9: Attempt to accept an already rejected application (Block Conflicting Decision)
    # -------------------------------------------------------------------------
    conflict_res = client.post(f"/api/v1/hr/applications/{cand_b['application_id']}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Attempting to reverse rejected status illegally."
    }, headers=hr_headers)
    assert conflict_res.status_code == 400
    assert "Cannot accept an already rejected candidate" in conflict_res.json()["detail"]

    # -------------------------------------------------------------------------
    # TEST 9B: Reverse Accepted Candidate A to Rejected with Verification Findings
    # -------------------------------------------------------------------------
    reversal_res = client.post(f"/api/v1/hr/applications/{cand_a['application_id']}/decision", json={
        "decision": "REJECTED",
        "decision_notes": "Further verification findings: background credentials check revealed discrepancies."
    }, headers=hr_headers)
    assert reversal_res.status_code == 200
    assert reversal_res.json()["status"] == "rejected"
    assert reversal_res.json()["is_revision"] is True
    assert reversal_res.json()["previous_decision"] == "ACCEPTED"

    # Verify Cand A is now rejected across Top-5 and Applicant Pool
    top5_after_rev = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=hr_headers).json()
    match_a_top_rev = next((c for c in top5_after_rev if c["application_id"] == cand_a["application_id"]), None)
    assert match_a_top_rev is not None
    assert match_a_top_rev["status"] == "rejected"

    apps_after_rev = client.get(f"/api/v1/applications/job/{job_id}/applicants", headers=hr_headers).json()
    match_a_app_rev = next((a for a in apps_after_rev if a["id"] == cand_a["application_id"]), None)
    assert match_a_app_rev is not None
    assert match_a_app_rev["status"] == "rejected"

    # Now duplicate rejection of Candidate A must be blocked
    dup_reject_res = client.post(f"/api/v1/hr/applications/{cand_a['application_id']}/decision", json={
        "decision": "REJECTED",
        "decision_notes": "Attempting duplicate rejection."
    }, headers=hr_headers)
    assert dup_reject_res.status_code == 400
    assert "already been rejected" in dup_reject_res.json()["detail"]

    # Now accepting Candidate A (who is now rejected) must also be blocked
    accept_blocked_res = client.post(f"/api/v1/hr/applications/{cand_a['application_id']}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Attempting to accept after rejection."
    }, headers=hr_headers)
    assert accept_blocked_res.status_code == 400
    assert "Cannot accept an already rejected candidate" in accept_blocked_res.json()["detail"]

    # -------------------------------------------------------------------------
    # TEST 10: Check Confirmed Hiring Decisions History (Preserves Both Decisions for Reversal)
    # -------------------------------------------------------------------------
    history_res = client.get("/api/v1/hr/decisions", headers=hr_headers)
    assert history_res.status_code == 200
    history_items = history_res.json()["items"]
    
    # Verify candidate A retains BOTH the initial ACCEPTED and revised REJECTED records
    items_a = [h for h in history_items if h["application_id"] == cand_a["application_id"]]
    assert len(items_a) == 2
    decisions_a = {h["decision"] for h in items_a}
    assert "ACCEPTED" in decisions_a
    assert "REJECTED" in decisions_a

    # Verify candidate B exists once in history
    items_b = [h for h in history_items if h["application_id"] == cand_b["application_id"]]
    assert len(items_b) == 1
    assert items_b[0]["decision"] == "REJECTED"

    # Verify candidate C exists once in history
    items_c = [h for h in history_items if h["application_id"] == cand_c["application_id"]]
    assert len(items_c) == 1
    assert items_c[0]["decision"] == "ACCEPTED"

    # -------------------------------------------------------------------------
    # TEST 11: Check Candidate Portal (Status and Recruitment Activity with Revision)
    # -------------------------------------------------------------------------
    cand_a_apps = client.get("/api/v1/applications/candidate/all", headers=cand_a["headers"])
    assert cand_a_apps.status_code == 200
    my_app_a = next((a for a in cand_a_apps.json() if a["id"] == cand_a["application_id"]), None)
    assert my_app_a is not None
    assert my_app_a["status"] == "rejected"

    cand_c_apps = client.get("/api/v1/applications/candidate/all", headers=cand_c["headers"])
    assert cand_c_apps.status_code == 200
    my_app_c = next((a for a in cand_c_apps.json() if a["id"] == cand_c["application_id"]), None)
    assert my_app_c is not None
    assert my_app_c["status"] == "accepted"

    activities_res = client.get("/api/v1/candidate/activities", headers=cand_a["headers"])
    assert activities_res.status_code == 200
    acts = activities_res.json()["items"]
    accept_act = next((act for act in acts if act["activity_type"] == "APPLICATION_ACCEPTED"), None)
    assert accept_act is not None
    assert "Application Accepted" in accept_act["activity_title"]

    reject_act = next((act for act in acts if act["activity_type"] == "APPLICATION_REJECTED"), None)
    assert reject_act is not None
    assert "updated following an additional HR review" in reject_act["activity_description"]
    assert reject_act["metadata_json"]["is_revision"] is True

    # -------------------------------------------------------------------------
    # TEST 12: Independent Decisions per Application
    # -------------------------------------------------------------------------
    # Candidate C (who is currently ACCEPTED on Job 1) applies for a second job opening
    new_job_2 = client.post("/api/v1/jobs", json={
        "title": f"Secondary Role {uuid.uuid4().hex[:6]}",
        "department": "Infrastructure",
        "experience_level": "Senior",
        "location": "Remote",
        "employment_type": "Full-Time",
        "required_skills": ["Python", "FastAPI"],
        "description": "Secondary application testing.",
        "status": "published"
    }, headers=hr_headers)
    assert new_job_2.status_code == 201
    job_2_id = new_job_2.json()["id"]

    app_2_res = client.post("/api/v1/applications", json={"job_id": job_2_id}, headers=cand_c["headers"])
    assert app_2_res.status_code == 201
    app_2_id = app_2_res.json()["id"]

    # Reject Candidate C on second job
    dec_job2 = client.post(f"/api/v1/hr/applications/{app_2_id}/decision", json={
        "decision": "REJECTED",
        "decision_notes": "Not a fit for this secondary position."
    }, headers=hr_headers)
    assert dec_job2.status_code == 200

    # Primary application for job 1 remains ACCEPTED!
    app_1_check = client.get(f"/api/v1/applications/{cand_c['application_id']}", headers=cand_c["headers"]).json()
    assert app_1_check["status"] == "accepted"

    # Secondary application for job 2 is REJECTED
    app_2_check = client.get(f"/api/v1/applications/{app_2_id}", headers=cand_c["headers"]).json()
    assert app_2_check["status"] == "rejected"
