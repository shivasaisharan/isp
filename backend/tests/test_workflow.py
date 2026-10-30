import uuid

def test_full_recruitment_lifecycle(client):
    # 1. HR logs in
    hr_login = client.post("/api/v1/auth/hr/login", json={
        "email": "hr@smartrecruit.io",
        "password": "recruiter123"
    })
    assert hr_login.status_code == 200
    hr_token = hr_login.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # 2. HR creates a new job opening
    job_res = client.post("/api/v1/jobs", json={
        "title": f"DevOps Infrastructure Lead {uuid.uuid4().hex[:4]}",
        "department": "Platform Reliability",
        "experience_level": "Senior",
        "location": "Remote",
        "employment_type": "Full-Time",
        "required_skills": ["Kubernetes", "Terraform", "AWS", "Python", "Docker"],
        "description": "Lead the modernization and scaling of cloud infrastructure.",
        "status": "published"
    }, headers=hr_headers)
    assert job_res.status_code == 201
    job_id = job_res.json()["id"]

    # 3. New candidate registers and logs in
    cand_email = f"devops.cand.{uuid.uuid4().hex[:6]}@example.com"
    cand_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_email,
        "password": "Password123!",
        "full_name": "Jordan Lee"
    })
    assert cand_reg.status_code == 201
    cand_token = cand_reg.json()["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}

    # 4. Candidate applies for the job
    apply_res = client.post("/api/v1/applications", json={
        "job_id": job_id
    }, headers=cand_headers)
    assert apply_res.status_code == 201
    app_id = apply_res.json()["id"]

    # 5. Candidate starts AI interview
    interview_start = client.post("/api/v1/interviews/start", json={
        "application_id": app_id,
        "duration_minutes": 15
    }, headers=cand_headers)
    assert interview_start.status_code == 200
    session_data = interview_start.json()
    session_id = session_data["id"]
    q1 = session_data["current_question"]
    assert q1 is not None

    # 6. Candidate answers question 1
    ans_res = client.post("/api/v1/interviews/answer", json={
        "session_id": session_id,
        "question_id": q1["id"],
        "answer": "We architected our multi-region Kubernetes clusters with Terraform and AWS EKS. We improved pipeline throughput by 40% and maintained 99.99% availability."
    }, headers=cand_headers)
    assert ans_res.status_code == 200
    assert ans_res.json()["evaluated_score"] > 50

    # 7. Candidate finalizes interview session
    comp_res = client.post(f"/api/v1/interviews/{session_id}/complete", headers=cand_headers)
    assert comp_res.status_code == 200
    report_id = comp_res.json()["report_id"]

    # 8. HR views Top 5 recommendations for the job
    top5_res = client.get(f"/api/v1/rankings/job/{job_id}/top-candidates", headers=hr_headers)
    assert top5_res.status_code == 200
    top5 = top5_res.json()
    assert len(top5) >= 1
    assert top5[0]["application_id"] == app_id
    assert top5[0]["rank"] == 1

    # 9. HR reviews report and makes final hiring decision (select)
    decision_res = client.post("/api/v1/decisions", json={
        "application_id": app_id,
        "decision": "selected",
        "rationale": "Outstanding Kubernetes and Terraform experience demonstrated in AI evaluation."
    }, headers=hr_headers)
    assert decision_res.status_code == 201
    assert decision_res.json()["decision"] == "selected"

    # 10. Candidate verifies application status and activity history
    cand_app = client.get(f"/api/v1/applications/{app_id}", headers=cand_headers)
    assert cand_app.status_code == 200
    assert cand_app.json()["status"] == "selected"

    activity_res = client.get("/api/v1/activity", headers=cand_headers)
    assert activity_res.status_code == 200
    activities = activity_res.json()
    assert len(activities) >= 2
