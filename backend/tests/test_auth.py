import uuid
import pytest

def test_health_check(client):
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert "Smart Recruit" in data["product"]

def test_candidate_registration_and_login(client):
    unique_email = f"test.candidate.{uuid.uuid4().hex[:6]}@example.com"
    reg_res = client.post("/api/v1/auth/candidate/register", json={
        "email": unique_email,
        "password": "SecurePassword123!",
        "full_name": "Test Candidate",
        "phone": "+1-555-0199"
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["role"] == "candidate"

    # Login with newly registered candidate
    login_res = client.post("/api/v1/auth/candidate/login", json={
        "email": unique_email,
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

def test_hr_registration_and_login(client):
    unique_email = f"test.hr.{uuid.uuid4().hex[:6]}@example.com"
    reg_res = client.post("/api/v1/auth/hr/register", json={
        "email": unique_email,
        "password": "SecurePassword123!",
        "full_name": "Test HR Lead",
        "organization_name": "Apex Innovations"
    })
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert data["user"]["role"] == "hr"
    assert "organization" in data["user"]

    # Login HR
    login_res = client.post("/api/v1/auth/hr/login", json={
        "email": unique_email,
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    assert login_res.json()["user"]["role"] == "hr"

def test_cross_portal_login_rejection(client):
    # Candidate trying to log in at HR endpoint
    res = client.post("/api/v1/auth/hr/login", json={
        "email": "alex.chen@example.com",
        "password": "candidate123"
    })
    assert res.status_code == 403
    assert "Candidate privileges" in res.json()["detail"]

    # HR trying to log in at Candidate endpoint
    res2 = client.post("/api/v1/auth/candidate/login", json={
        "email": "hr@smartrecruit.io",
        "password": "recruiter123"
    })
    assert res2.status_code == 403
    assert "HR Recruiter" in res2.json()["detail"]
