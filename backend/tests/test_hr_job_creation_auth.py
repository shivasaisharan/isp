import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.models import User, Organization, OrganizationMembership, Job
from app.core.security import create_access_token

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_hr_job_creation_authentication_and_tenancy(client, db):
    # 1. Unauthenticated access returns 401
    resp_unauth_hr = client.post("/api/v1/hr/jobs", json={
        "title": "Unauthenticated Role",
        "department": "Engineering",
        "description": "Test unauthenticated"
    })
    assert resp_unauth_hr.status_code == 401
    assert "Authentication credentials were not provided" in resp_unauth_hr.json().get("detail", "")

    resp_unauth_jobs = client.post("/api/v1/jobs", json={
        "title": "Unauthenticated Role",
        "department": "Engineering",
        "description": "Test unauthenticated"
    })
    assert resp_unauth_jobs.status_code == 401
    assert "Authentication credentials were not provided" in resp_unauth_jobs.json().get("detail", "")

    # 2. Candidate role access returns 403 Forbidden
    candidate = db.query(User).filter(User.role == "candidate").first()
    assert candidate is not None
    candidate_token = create_access_token(candidate.id, candidate.role)
    candidate_headers = {"Authorization": f"Bearer {candidate_token}"}

    resp_candidate_hr = client.post("/api/v1/hr/jobs", json={
        "title": "Candidate Attempted Job",
        "department": "Engineering",
        "description": "Should fail with 403"
    }, headers=candidate_headers)
    assert resp_candidate_hr.status_code == 403
    assert "HR Recruiter portal permission required" in resp_candidate_hr.json().get("detail", "")

    resp_candidate_jobs = client.post("/api/v1/jobs", json={
        "title": "Candidate Attempted Job",
        "department": "Engineering",
        "description": "Should fail with 403"
    }, headers=candidate_headers)
    assert resp_candidate_jobs.status_code == 403
    assert "HR Recruiter portal permission required" in resp_candidate_jobs.json().get("detail", "")

    # 3. Authenticated HR user creates job via POST /api/v1/hr/jobs
    hr_user = db.query(User).filter(User.role == "hr").first()
    assert hr_user is not None
    hr_token = create_access_token(hr_user.id, hr_user.role)
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    membership = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == hr_user.id).first()
    assert membership is not None

    hr_job_payload = {
        "title": "Principal AI Alignment Engineer",
        "department": "Engineering",
        "experience_level": "Senior",
        "location_scope": "Hybrid - New York, NY",
        "compensation_range": "$175,000 - $210,000",
        "required_skills": ["Python", "python", "PyTorch", "FASTAPI", "FastAPI"],
        "preferred_skills": ["Kubernetes", "kubernetes", "vLLM"],
        "description": "Design and architect next-generation recruitment AI systems.",
        "status": "PUBLISHED"
    }

    resp_create_hr = client.post("/api/v1/hr/jobs", json=hr_job_payload, headers=hr_headers)
    assert resp_create_hr.status_code == 201
    data_hr = resp_create_hr.json()
    assert data_hr["title"] == "Principal AI Alignment Engineer"
    assert data_hr["location"] == "Hybrid - New York, NY"
    assert data_hr["salary_range"] == "$175,000 - $210,000"
    assert data_hr["status"] == "published"
    # Case-insensitive deduplication check
    assert data_hr["required_skills"] == ["Python", "PyTorch", "FASTAPI"]
    assert data_hr["preferred_skills"] == ["Kubernetes", "vLLM"]
    assert data_hr["organization_id"] == membership.organization_id

    # 4. Authenticated HR user creates job via POST /api/v1/jobs
    jobs_payload = {
        "title": "Lead Cloud Infrastructure Specialist",
        "department": "Security",
        "experience_level": "Lead",
        "location": "Remote",
        "salary_range": "$160,000 - $190,000",
        "required_skills": ["Terraform", "AWS", "terraform", "Docker"],
        "description": "Maintain zero-trust multi-cloud infrastructure.",
        "status": "published"
    }
    resp_create_jobs = client.post("/api/v1/jobs", json=jobs_payload, headers=hr_headers)
    assert resp_create_jobs.status_code == 201
    data_jobs = resp_create_jobs.json()
    assert data_jobs["title"] == "Lead Cloud Infrastructure Specialist"
    assert data_jobs["required_skills"] == ["Terraform", "AWS", "Docker"]
    assert data_jobs["organization_id"] == membership.organization_id

    # 5. Verify organizational job listings via GET /api/v1/hr/jobs and GET /api/v1/jobs/organization/all
    resp_list_hr = client.get("/api/v1/hr/jobs", headers=hr_headers)
    assert resp_list_hr.status_code == 200
    list_hr_titles = [j["title"] for j in resp_list_hr.json()]
    assert "Principal AI Alignment Engineer" in list_hr_titles
    assert "Lead Cloud Infrastructure Specialist" in list_hr_titles

    resp_list_org = client.get("/api/v1/jobs/organization/all", headers=hr_headers)
    assert resp_list_org.status_code == 200
    list_org_titles = [j["title"] for j in resp_list_org.json()]
    assert "Principal AI Alignment Engineer" in list_org_titles
    assert "Lead Cloud Infrastructure Specialist" in list_org_titles

    # 6. Verify public listings via GET /api/v1/jobs contains both published jobs
    resp_public = client.get("/api/v1/jobs")
    assert resp_public.status_code == 200
    public_titles = [j["title"] for j in resp_public.json()]
    assert "Principal AI Alignment Engineer" in public_titles
    assert "Lead Cloud Infrastructure Specialist" in public_titles

    # 7. Verify HR auto-provisioning / tenancy fallback works
    import uuid
    fresh_email = f"test_fresh_hr_{uuid.uuid4().hex[:8]}@example.com"
    new_hr = User(
        email=fresh_email,
        full_name="Fresh Recruiter",
        hashed_password="hash",
        role="hr",
        is_active=True
    )
    db.add(new_hr)
    db.commit()
    db.refresh(new_hr)

    fresh_hr_token = create_access_token(new_hr.id, new_hr.role)
    fresh_hr_headers = {"Authorization": f"Bearer {fresh_hr_token}"}

    resp_fresh_hr = client.post("/api/v1/hr/jobs", json={
        "title": "Fresh HR Test Position",
        "department": "Product",
        "description": "Testing automatic organization membership allocation."
    }, headers=fresh_hr_headers)
    assert resp_fresh_hr.status_code == 201
    fresh_job = resp_fresh_hr.json()
    assert fresh_job["title"] == "Fresh HR Test Position"
    assert fresh_job["organization_id"] is not None
