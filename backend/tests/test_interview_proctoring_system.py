import io
import uuid
import pytest

def test_interview_proctoring_and_recording_pipeline(client):
    # 1. HR logs in
    hr_login = client.post("/api/v1/auth/hr/login", json={
        "email": "hr@smartrecruit.io",
        "password": "recruiter123"
    })
    assert hr_login.status_code == 200
    hr_token = hr_login.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    jobs_res = client.get("/api/v1/jobs/organization/all", headers=hr_headers)
    assert jobs_res.status_code == 200
    jobs = jobs_res.json()
    assert len(jobs) > 0
    job_id = jobs[0]["id"]

    # 2. Candidate registers and applies
    cand_email = f"proctor.cand.{uuid.uuid4().hex[:6]}@example.com"
    cand_reg = client.post("/api/v1/auth/candidate/register", json={
        "email": cand_email,
        "password": "Password123!",
        "full_name": "Jordan Proctor"
    })
    assert cand_reg.status_code == 201
    cand_token = cand_reg.json()["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}

    apply_res = client.post("/api/v1/applications", json={
        "job_id": job_id
    }, headers=cand_headers)
    assert apply_res.status_code == 201
    app_id = apply_res.json()["id"]

    # 3. Start interview session
    interview_start = client.post("/api/v1/interviews/start", json={
        "application_id": app_id,
        "duration_minutes": 20
    }, headers=cand_headers)
    assert interview_start.status_code == 200
    session_id = interview_start.json()["id"]

    # 4. Candidate submits hardware consent and verification
    consent_res = client.post(f"/api/v1/interviews/{session_id}/consent", json={
        "webcam_granted": True,
        "microphone_granted": True,
        "screen_share_granted": True,
        "recording_consent_agreed": True,
        "fullscreen_consent_agreed": True,
        "browser_info": {"userAgent": "Chrome/130.0", "platform": "Win32"}
    }, headers=cand_headers)
    assert consent_res.status_code == 200
    consent_data = consent_res.json()
    assert consent_data["webcam_granted"] is True
    assert consent_data["screen_share_granted"] is True

    # 5. Log Proctoring events (fullscreen enter, screenshare start, etc.)
    ev1 = client.post(f"/api/v1/interviews/{session_id}/proctoring-events", json={
        "event_type": "screen_share_started",
        "severity": "info",
        "is_security_violation": False,
        "description": "Candidate initiated full display sharing.",
        "timestamp_offset_seconds": 1.5,
        "metadata": {"displaySurface": "monitor"}
    }, headers=cand_headers)
    assert ev1.status_code == 200
    assert ev1.json()["event_type"] == "screen_share_started"

    ev2 = client.post(f"/api/v1/interviews/{session_id}/proctoring-events", json={
        "event_type": "screen_share_stopped",
        "severity": "critical",
        "is_security_violation": True,
        "description": "Candidate stopped screen sharing track.",
        "timestamp_offset_seconds": 25.0
    }, headers=cand_headers)
    assert ev2.status_code == 200
    assert ev2.json()["is_security_violation"] is True

    # 6. Upload video recording chunks
    fake_webm_header = b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01" + b"A" * 1024
    chunk1_res = client.post(
        f"/api/v1/interviews/{session_id}/recordings/chunks",
        data={"chunk_index": 0, "duration_seconds": 10.0, "is_final": False},
        files={"file": ("chunk_00000.webm", io.BytesIO(fake_webm_header), "video/webm")},
        headers=cand_headers
    )
    assert chunk1_res.status_code == 200
    assert chunk1_res.json()["status"] == "chunk_received"
    recording_id = chunk1_res.json()["recording_id"]

    chunk2_res = client.post(
        f"/api/v1/interviews/{session_id}/recordings/chunks",
        data={"chunk_index": 1, "duration_seconds": 10.0, "is_final": True},
        files={"file": ("chunk_00001.webm", io.BytesIO(b"B" * 1024), "video/webm")},
        headers=cand_headers
    )
    assert chunk2_res.status_code == 200
    assert chunk2_res.json()["chunk_index"] == 1

    # 7. Finalize recording
    finalize_res = client.post(f"/api/v1/interviews/{session_id}/recordings/finalize", headers=cand_headers)
    assert finalize_res.status_code == 200
    assert finalize_res.json()["status"] == "ready"
    assert finalize_res.json()["duration_seconds"] >= 20.0

    # 8. Test Video Streaming with HTTP Range Request (206 Partial Content)
    stream_res = client.get(
        f"/api/v1/interviews/{session_id}/recordings/{recording_id}/stream",
        headers={"Range": "bytes=0-100"}
    )
    assert stream_res.status_code == 206
    assert stream_res.headers["Content-Range"].startswith("bytes 0-100/")
    assert len(stream_res.content) == 101

    # 9. HR views Proctoring Review
    review_res = client.get(f"/api/v1/interviews/{session_id}/proctoring-review", headers=hr_headers)
    assert review_res.status_code == 200
    review_data = review_res.json()
    assert review_data["session_id"] == session_id
    assert len(review_data["recordings"]) >= 1
    assert len(review_data["events"]) >= 3  # consent_granted + ev1 + ev2 + recording_finalized
    assert review_data["consent"]["webcam_granted"] is True
    assert review_data["proctoring_verdict"] == "pending"

    # 10. HR submits Proctoring Verdict
    verdict_res = client.post(
        f"/api/v1/interviews/{session_id}/proctoring-verdict",
        json={
            "verdict": "cleared",
            "reviewer_notes": "Candidate reconnected screen promptly. No unauthorized behavior observed."
        },
        headers=hr_headers
    )
    assert verdict_res.status_code == 200
    assert verdict_res.json()["proctoring_verdict"] == "cleared"

    # Verify review reflects cleared verdict
    review_after = client.get(f"/api/v1/interviews/{session_id}/proctoring-review", headers=hr_headers)
    assert review_after.json()["proctoring_verdict"] == "cleared"
    assert "No unauthorized behavior" in review_after.json()["reviewer_notes"]

