import uuid
import pytest
from app.core.database import SessionLocal
from app.models.models import AuditEvent, User, Job, Application, Organization, OrganizationMembership
from app.services.audit_service import (
    get_organization_audit_trail_paginated,
    get_organization_audit_summary,
    export_audit_trail_csv
)

def get_hr_auth_headers(client, email="hr@smartrecruit.io", password="recruiter123"):
    login_res = client.post("/api/v1/auth/hr/login", json={
        "email": email,
        "password": password
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def create_candidate(client, name="Audit Candidate"):
    cand_email = f"audit.cand.{uuid.uuid4().hex[:8]}@example.com"
    cand_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_email,
        "password": "Password123!",
        "full_name": name
    })
    assert cand_reg.status_code == 201
    cand_token = cand_reg.json()["access_token"]
    return cand_reg.json()["user"], {"Authorization": f"Bearer {cand_token}"}

def test_audit_trail_resolves_uuids_to_human_readable_info(client):
    """
    Test that raw database UUIDs in AuditEvent are dynamically resolved into:
    Candidate Full Name, Candidate Reference, Job Title, Company Name, Reviewer Name & Designation.
    """
    hr_headers = get_hr_auth_headers(client)

    # 1. Post a new Job
    job_res = client.post("/api/v1/jobs", json={
        "title": f"Distributed Database Engineer {uuid.uuid4().hex[:4]}",
        "department": "Infrastructure",
        "experience_level": "Senior",
        "location": "Remote",
        "employment_type": "Full-Time",
        "required_skills": ["PostgreSQL", "Raft", "Distributed Systems"],
        "description": "Architecting resilient global consensus clusters.",
        "status": "published"
    }, headers=hr_headers)
    assert job_res.status_code == 201
    job_id = job_res.json()["id"]

    # 2. Candidate registers and applies
    candidate_user, cand_headers = create_candidate(client, "Shiva Sai Sharan Reddy")
    apply_res = client.post("/api/v1/applications", json={"job_id": job_id}, headers=cand_headers)
    assert apply_res.status_code == 201
    app_id = apply_res.json()["id"]

    # 3. HR accepts candidate with recorded rationale
    decision_notes = "Candidate demonstrates exceptional grasp of Paxos, Raft consensus, and distributed transactions."
    acc_res = client.post(f"/api/v1/decisions/applications/{app_id}/accept", json={
        "notes": decision_notes
    }, headers=hr_headers)
    assert acc_res.status_code == 200

    # 4. Query /api/v1/hr/audit-trail
    audit_res = client.get(f"/api/v1/hr/audit-trail?search=Shiva Sai Sharan Reddy", headers=hr_headers)
    assert audit_res.status_code == 200
    data = audit_res.json()
    assert data["total"] >= 1

    item = data["items"][0]
    # Check resolved candidate info
    assert item["candidate_name"] == "Shiva Sai Sharan Reddy"
    assert item["candidate_reference"].startswith("CAND-")
    assert item["candidate_id"] == candidate_user["id"]

    # Check resolved job & company info
    assert "Distributed Database Engineer" in item["job_title"]
    assert item["job_reference"].startswith("JOB-")
    assert item["company_name"] is not None

    # Check resolved reviewer / actor info
    assert item["actor_name"] is not None
    assert item["actor_designation"] in ["Recruiter Admin", "Senior Recruiter", "HR Recruiter", "Recruiter Owner"]
    assert item["actor_reference"].startswith("HR-")

    # Check human-readable action
    assert item["action_display"] in ["Candidate Accepted", "Final Hiring Decision Recorded"]
    assert item["category"] == "hiring"
    assert item["category_display"] == "Hiring Decisions"

    # Check status transitions and decision explanation
    assert item["new_status"] == "Accepted"
    assert "consensus" in item["decision_notes"].lower()

    # Check that original metadata is preserved
    assert item["details_json"] is not None
    assert "candidate_id" in item["details_json"]

def test_audit_trail_summary_metrics(client):
    """
    Test /api/v1/hr/audit-trail/summary returns accurate category counts.
    """
    hr_headers = get_hr_auth_headers(client)

    summary_res = client.get("/api/v1/hr/audit-trail/summary", headers=hr_headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()

    assert "total_audit_events" in summary
    assert "hiring_decisions" in summary
    assert "candidate_applications" in summary
    assert "interview_events" in summary
    assert "resume_events" in summary
    assert "security_events" in summary
    assert "job_management_events" in summary
    assert summary["total_audit_events"] >= 1

def test_audit_trail_multi_criteria_filtering_and_search(client):
    """
    Test filtering by category, search term, sort order, and pagination.
    """
    hr_headers = get_hr_auth_headers(client)

    # 1. Filter by category=hiring
    res_hiring = client.get("/api/v1/hr/audit-trail?category=hiring", headers=hr_headers)
    assert res_hiring.status_code == 200
    for item in res_hiring.json()["items"]:
        assert item["category"] == "hiring"

    # 2. Filter by category=job
    res_job = client.get("/api/v1/hr/audit-trail?category=job", headers=hr_headers)
    assert res_job.status_code == 200
    for item in res_job.json()["items"]:
        assert item["category"] == "job"

    # 3. Sort order asc vs desc
    res_desc = client.get("/api/v1/hr/audit-trail?sort_order=desc&page_size=5", headers=hr_headers)
    assert res_desc.status_code == 200
    res_asc = client.get("/api/v1/hr/audit-trail?sort_order=asc&page_size=5", headers=hr_headers)
    assert res_asc.status_code == 200

    if res_desc.json()["items"] and res_asc.json()["items"]:
        assert res_desc.json()["items"][0]["created_at"] >= res_asc.json()["items"][0]["created_at"]

def test_audit_trail_csv_export(client):
    """
    Test CSV export contains resolved human-readable columns.
    """
    hr_headers = get_hr_auth_headers(client)

    export_res = client.get("/api/v1/hr/audit-trail/export", headers=hr_headers)
    assert export_res.status_code == 200
    assert export_res.headers["content-type"].startswith("text/csv")
    csv_content = export_res.text

    # Verify CSV headers
    assert "Event Reference" in csv_content
    assert "Action Display" in csv_content
    assert "Candidate Name" in csv_content
    assert "Job Position" in csv_content
    assert "Company Name" in csv_content
    assert "Performed By" in csv_content
    assert "Decision Rationale / Notes" in csv_content

def test_audit_trail_organization_isolation(client):
    """
    Ensure an HR user cannot view another organization's compliance audit events.
    """
    # 1. Register a new HR user under a different organization
    org2_email = f"hr.isolated.{uuid.uuid4().hex[:6]}@isolatedcorp.io"
    org2_reg = client.post("/api/v1/auth/hr/register", json={
        "email": org2_email,
        "password": "Password123!",
        "full_name": "Isolated Corp HR",
        "organization_name": f"Isolated Corp {uuid.uuid4().hex[:4]}"
    })
    assert org2_reg.status_code == 201
    org2_token = org2_reg.json()["access_token"]
    org2_headers = {"Authorization": f"Bearer {org2_token}"}

    # Query Org 2 audit trail
    org2_audits = client.get("/api/v1/hr/audit-trail", headers=org2_headers)
    assert org2_audits.status_code == 200

    # Org 2 should only see its own audit records (e.g. HR_REGISTERED), not Org 1's decisions
    for item in org2_audits.json()["items"]:
        assert "Isolated Corp" in (item["company_name"] or "") or item["action"] == "HR_REGISTERED"
