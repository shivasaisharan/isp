def test_candidate_data_persistence(client):
    # Candidate logs in
    login = client.post("/api/v1/auth/candidate/login", json={
        "email": "alex.chen@example.com",
        "password": "candidate123"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify profile data persisted
    prof_res = client.get("/api/v1/candidate/profile", headers=headers)
    assert prof_res.status_code == 200
    profile = prof_res.json()
    assert "PyTorch" in profile["skills"]

    # Verify applications persisted
    apps_res = client.get("/api/v1/applications/candidate/all", headers=headers)
    assert apps_res.status_code == 200
    apps = apps_res.json()
    assert len(apps) >= 1

    # Verify activity timeline persisted
    act_res = client.get("/api/v1/activity", headers=headers)
    assert act_res.status_code == 200
    activities = act_res.json()
    assert len(activities) >= 1

    # Verify notifications persisted
    notifs_res = client.get("/api/v1/notifications", headers=headers)
    assert notifs_res.status_code == 200
    notifs = notifs_res.json()
    assert len(notifs) >= 1



def test_candidate_resume_deletion(client):
    # Candidate logs in
    login = client.post("/api/v1/auth/candidate/login", json={
        "email": "alex.chen@example.com",
        "password": "candidate123"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch candidate resumes
    resumes_res = client.get("/api/v1/candidate/resumes", headers=headers)
    assert resumes_res.status_code == 200
    resumes = resumes_res.json()
    assert len(resumes) >= 1

    # Delete the last resume
    resume_to_delete = resumes[-1]
    del_res = client.delete(f"/api/v1/candidate/resumes/{resume_to_delete['id']}", headers=headers)
    assert del_res.status_code == 200
    assert "successfully deleted" in del_res.json()["message"]

    # Verify resume no longer appears in list
    resumes_after = client.get("/api/v1/candidate/resumes", headers=headers).json()
    assert all(r["id"] != resume_to_delete["id"] for r in resumes_after)
