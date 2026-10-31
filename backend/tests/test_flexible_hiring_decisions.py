import uuid
import pytest
from app.core.database import SessionLocal
from app.models.models import User, Job, Application, HrDecisionHistory, CandidateRecruitmentActivity

def test_flexible_hiring_decision_reversals_and_synchronization(client):
    """
    Complete end-to-end test suite for:
    1. Multiple decision reversals (ACCEPTED -> REJECTED -> ACCEPTED -> REJECTED)
    2. Strict validation & mandatory notes
    3. Tenancy isolation between HR organizations
    4. Synchronization with Top-5 candidate board & Candidate activity history
    5. Full preservation of historical audit records
    """
    db = SessionLocal()

    # 1. Setup HR Recruiter Org A
    hr_a_email = f"lead.hr.a.{uuid.uuid4().hex[:6]}@smartrecruit.io"
    hr_a_res = client.post("/api/v1/auth/hr/register", json={
        "email": hr_a_email,
        "password": "Password123!",
        "full_name": "Samantha Wright",
        "organization_name": f"Nexus Tech {uuid.uuid4().hex[:4]}"
    })
    assert hr_a_res.status_code == 201, hr_a_res.text
    token_a = hr_a_res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Setup HR Recruiter Org B (for cross-org tenancy check)
    hr_b_email = f"lead.hr.b.{uuid.uuid4().hex[:6]}@smartrecruit.io"
    hr_b_res = client.post("/api/v1/auth/hr/register", json={
        "email": hr_b_email,
        "password": "Password123!",
        "full_name": "Marcus Aurelius",
        "organization_name": f"Olympus Capital {uuid.uuid4().hex[:4]}"
    })
    assert hr_b_res.status_code == 201, hr_b_res.text
    token_b = hr_b_res.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Create Job in Org A
    job_res = client.post("/api/v1/jobs", json={
        "title": f"Staff Infrastructure Engineer {uuid.uuid4().hex[:4]}",
        "department": "Platform Reliability",
        "experience_level": "Staff",
        "location": "Remote",
        "employment_type": "Full-Time",
        "required_skills": ["Kubernetes", "Go", "Distributed Systems"],
        "description": "Architecting resilient distributed storage layers.",
        "status": "published"
    }, headers=headers_a)
    assert job_res.status_code == 201
    job_id = job_res.json()["id"]

    # 4. Candidate registers and applies
    cand_email = f"cand.{uuid.uuid4().hex[:6]}@example.com"
    cand_res = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_email,
        "password": "Password123!",
        "full_name": "David Thorne"
    })
    assert cand_res.status_code == 201
    cand_token = cand_res.json()["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}
    cand_id = cand_res.json()["user"]["id"]

    apply_res = client.post("/api/v1/applications", json={"job_id": job_id}, headers=cand_headers)
    assert apply_res.status_code == 201
    app_id = apply_res.json()["id"]

    # -------------------------------------------------------------------------
    # TEST 1: Cross-Organization Security Protection
    # -------------------------------------------------------------------------
    unauthorized_res = client.post(f"/api/v1/hr/applications/{app_id}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Trying to accept another org's candidate"
    }, headers=headers_b)
    assert unauthorized_res.status_code == 403
    assert "Access denied" in unauthorized_res.json()["detail"]

    # -------------------------------------------------------------------------
    # TEST 2: Mandatory Notes Validation
    # -------------------------------------------------------------------------
    no_notes_res = client.post(f"/api/v1/hr/applications/{app_id}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "  "
    }, headers=headers_a)
    assert no_notes_res.status_code == 400
    assert "at least 3 characters" in no_notes_res.json()["detail"]

    # -------------------------------------------------------------------------
    # TEST 3: Sequence 1 - Initial Decision: ACCEPTED
    # -------------------------------------------------------------------------
    dec1_res = client.post(f"/api/v1/hr/applications/{app_id}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "First round review passed with outstanding system architecture skills."
    }, headers=headers_a)
    assert dec1_res.status_code == 200, dec1_res.text
    dec1_data = dec1_res.json()
    assert dec1_data["decision"] == "ACCEPTED"
    assert dec1_data["status"] in ["accepted", "selected"]
    assert dec1_data["is_revision"] is False

    # Check Top-5 Board status matches
    top_res1 = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=headers_a)
    assert top_res1.status_code == 200
    top_cand1 = next((c for c in top_res1.json() if c["application_id"] == app_id), None)
    assert top_cand1 is not None
    assert top_cand1["status"] in ["accepted", "selected"]

    # Attempting to accept again without change should return 400
    dup_accept = client.post(f"/api/v1/hr/applications/{app_id}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Attempting duplicate accept"
    }, headers=headers_a)
    assert dup_accept.status_code == 400
    assert "already been accepted" in dup_accept.json()["detail"]

    # -------------------------------------------------------------------------
    # TEST 4: Sequence 2 - Decision Reversal: REJECTED
    # -------------------------------------------------------------------------
    dec2_res = client.post(f"/api/v1/hr/applications/{app_id}/decision", json={
        "decision": "REJECTED",
        "decision_notes": "Reference check revealed compliance inconsistency. Candidate rejected."
    }, headers=headers_a)
    assert dec2_res.status_code == 200, dec2_res.text
    dec2_data = dec2_res.json()
    assert dec2_data["decision"] == "REJECTED"
    assert dec2_data["status"] == "rejected"
    assert dec2_data["is_revision"] is True
    assert dec2_data["previous_decision"] == "ACCEPTED"

    # Check Top-5 Board reflects REJECTED
    top_res2 = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=headers_a)
    top_cand2 = next((c for c in top_res2.json() if c["application_id"] == app_id), None)
    assert top_cand2 is not None
    assert top_cand2["status"] == "rejected"

    # -------------------------------------------------------------------------
    # TEST 5: Sequence 3 - Decision Reversal: ACCEPTED (Reconsidering candidate)
    # -------------------------------------------------------------------------
    dec3_res = client.post(f"/api/v1/hr/applications/{app_id}/decision", json={
        "decision": "ACCEPTED",
        "decision_notes": "Compliance clarification provided by legal counsel. Candidate cleared and offered role."
    }, headers=headers_a)
    assert dec3_res.status_code == 200, dec3_res.text
    dec3_data = dec3_res.json()
    assert dec3_data["decision"] == "ACCEPTED"
    assert dec3_data["status"] in ["accepted", "selected"]
    assert dec3_data["is_revision"] is True
    assert dec3_data["previous_decision"] == "REJECTED"

    # Check Top-5 Board reflects ACCEPTED
    top_res3 = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=headers_a)
    top_cand3 = next((c for c in top_res3.json() if c["application_id"] == app_id), None)
    assert top_cand3 is not None
    assert top_cand3["status"] in ["accepted", "selected"]

    # -------------------------------------------------------------------------
    # TEST 6: Sequence 4 - Decision Reversal: REJECTED (Final candidate withdrawal)
    # -------------------------------------------------------------------------
    dec4_res = client.post(f"/api/v1/hr/applications/{app_id}/decision", json={
        "decision": "REJECTED",
        "decision_notes": "Candidate declined compensation band; application closed as rejected."
    }, headers=headers_a)
    assert dec4_res.status_code == 200, dec4_res.text
    dec4_data = dec4_res.json()
    assert dec4_data["decision"] == "REJECTED"
    assert dec4_data["status"] == "rejected"
    assert dec4_data["is_revision"] is True

    # -------------------------------------------------------------------------
    # TEST 7: Full Chronological Audit Trail Preservation
    # -------------------------------------------------------------------------
    history_records = (
        db.query(HrDecisionHistory)
        .filter(HrDecisionHistory.application_id == app_id)
        .order_by(HrDecisionHistory.decided_at.asc())
        .all()
    )
    assert len(history_records) == 4, f"Expected 4 history records, found {len(history_records)}"

    assert history_records[0].decision == "ACCEPTED"
    assert history_records[0].new_status in ["accepted", "selected"]

    assert history_records[1].decision == "REJECTED"
    assert history_records[1].previous_status in ["accepted", "selected"]
    assert history_records[1].new_status == "rejected"

    assert history_records[2].decision == "ACCEPTED"
    assert history_records[2].previous_status == "rejected"
    assert history_records[2].new_status in ["accepted", "selected"]

    assert history_records[3].decision == "REJECTED"
    assert history_records[3].previous_status in ["accepted", "selected"]
    assert history_records[3].new_status == "rejected"

    # Verify Confirmed Decisions Endpoint returns all records
    audit_res = client.get("/api/v1/hr/decisions", headers=headers_a)
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    dec_list = [d for d in audit_data["items"] if d["application_id"] == app_id]
    assert len(dec_list) == 4

    # Verify Candidate Portal reflects latest status (rejected)
    cand_apps = client.get("/api/v1/applications/candidate/all", headers=cand_headers)
    assert cand_apps.status_code == 200
    my_app = next((a for a in cand_apps.json() if a["id"] == app_id), None)
    assert my_app is not None
    assert my_app["status"] == "rejected"

    db.close()
