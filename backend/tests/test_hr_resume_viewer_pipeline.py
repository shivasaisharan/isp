import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.models import User, Application, ResumeFile, OrganizationMembership, Organization
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

def test_hr_resume_pdf_pipeline_e2e(client, db):
    # 1. Identify an HR user and their organization
    hr_user = db.query(User).filter(User.role == "hr").first()
    assert hr_user is not None
    membership = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == hr_user.id).first()
    assert membership is not None

    hr_token = create_access_token(hr_user.id, hr_user.role)
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # 2. Identify an application belonging to this organization that has a resume
    app_obj = (
        db.query(Application)
        .filter(Application.resume_file_id != None)
        .first()
    )
    assert app_obj is not None
    assert app_obj.resume_file_id is not None

    # Ensure application's job belongs to HR user's organization for test predictability
    app_obj.job.organization_id = membership.organization_id
    db.commit()

    # 3. Request resume metadata: GET /api/v1/hr/applications/{app_id}/resume
    resp_meta = client.get(f"/api/v1/hr/applications/{app_obj.id}/resume", headers=hr_headers)
    assert resp_meta.status_code == 200
    meta = resp_meta.json()
    assert meta["application_id"] == app_obj.id
    assert "resume" in meta
    resume_info = meta["resume"]
    assert resume_info["resume_id"] == app_obj.resume_file_id
    assert resume_info["file_type"] == "application/pdf"
    assert "stream_url" in resume_info
    assert "download_url" in resume_info

    # 4. Request PDF binary using stream_url (with query token)
    stream_url = resume_info["stream_url"]
    # Ensure stream_url has /api/v1 prefix if called on test client
    full_stream_path = f"/api/v1{stream_url}" if not stream_url.startswith("/api/v1") else stream_url
    resp_stream = client.get(full_stream_path)
    assert resp_stream.status_code == 200
    assert resp_stream.headers.get("content-type") == "application/pdf"
    assert resp_stream.headers.get("accept-ranges") == "bytes"
    assert "inline" in resp_stream.headers.get("content-disposition", "")
    assert resume_info["file_name"] in resp_stream.headers.get("content-disposition", "")

    # 5. Verify PDF magic signature: starts with %PDF-
    content = resp_stream.content
    assert len(content) > 0
    assert content.startswith(b"%PDF-"), "Streamed resume must start with %PDF- signature"

    # 6. Request PDF binary using Bearer header (without ?token= query param)
    clean_stream_path = f"/api/v1/hr/applications/{app_obj.id}/resume/file"
    resp_bearer = client.get(clean_stream_path, headers=hr_headers)
    assert resp_bearer.status_code == 200
    assert resp_bearer.headers.get("content-type") == "application/pdf"
    assert resp_bearer.content.startswith(b"%PDF-")

    # 7. Request with download=true: verify attachment disposition
    resp_download = client.get(f"{clean_stream_path}?download=true", headers=hr_headers)
    assert resp_download.status_code == 200
    assert "attachment" in resp_download.headers.get("content-disposition", "")
    assert resume_info["file_name"] in resp_download.headers.get("content-disposition", "")
    assert resp_download.content.startswith(b"%PDF-")

    # 8. Unauthenticated access should return 401
    resp_unauth = client.get(clean_stream_path)
    assert resp_unauth.status_code == 401

    # 9. Candidate access should return 403 Forbidden
    candidate_user = db.query(User).filter(User.role == "candidate").first()
    assert candidate_user is not None
    cand_token = create_access_token(candidate_user.id, candidate_user.role)
    cand_headers = {"Authorization": f"Bearer {cand_token}"}
    resp_cand = client.get(clean_stream_path, headers=cand_headers)
    assert resp_cand.status_code == 403
    assert "HR recruiters" in resp_cand.json().get("detail", "")

    # 10. Cross-organization HR access should return 403 Forbidden
    import uuid
    uid_hex = uuid.uuid4().hex[:8]
    other_org = Organization(name=f"Other Corp {uid_hex}", slug=f"other-corp-{uid_hex}")
    db.add(other_org)
    db.commit()
    db.refresh(other_org)

    other_hr = User(
        email=f"other_hr_{uid_hex}@example.com",
        full_name="Other HR",
        hashed_password="hash",
        role="hr",
        is_active=True
    )
    db.add(other_hr)
    db.commit()
    db.refresh(other_hr)

    other_membership = OrganizationMembership(
        organization_id=other_org.id,
        user_id=other_hr.id,
        role="admin"
    )
    db.add(other_membership)
    db.commit()

    other_token = create_access_token(other_hr.id, other_hr.role)
    other_headers = {"Authorization": f"Bearer {other_token}"}

    resp_cross_org = client.get(clean_stream_path, headers=other_headers)
    assert resp_cross_org.status_code == 403
    assert "another organization" in resp_cross_org.json().get("detail", "")
