def test_unauthenticated_request_rejected(client):
    res = client.get("/api/v1/jobs/organization/all")
    assert res.status_code == 401

def test_candidate_cannot_access_hr_endpoints(client):
    # Log in as candidate
    login = client.post("/api/v1/auth/candidate/login", json={
        "email": "alex.chen@example.com",
        "password": "candidate123"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to access HR job list
    res = client.get("/api/v1/jobs/organization/all", headers=headers)
    assert res.status_code == 403
    assert "HR Recruiter portal permission required" in res.json()["detail"]

    # Attempt to post a job
    res2 = client.post("/api/v1/jobs", json={
        "title": "Unauthorized Job",
        "department": "Engineering",
        "description": "Exploit attempt"
    }, headers=headers)
    assert res2.status_code == 403

def test_candidate_cannot_submit_hiring_decision(client):
    # Log in as candidate
    login = client.post("/api/v1/auth/candidate/login", json={
        "email": "alex.chen@example.com",
        "password": "candidate123"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/decisions", json={
        "application_id": "app-fake-id",
        "decision": "selected",
        "rationale": "I select myself"
    }, headers=headers)
    assert res.status_code == 403
