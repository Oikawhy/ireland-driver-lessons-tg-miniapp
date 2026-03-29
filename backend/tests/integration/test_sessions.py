"""
Integration tests — Session lifecycle.
Synchronous tests against running backend.
"""
from conftest import _run, _queryrow, BACKEND_URL


def test_create_exam_session(client, auth_header):
    resp = client.post("/api/sessions", json={"test_type": "exam"}, headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "in_progress"
    assert data["test_type"] == "exam"
    assert data["total_questions"] > 0


def test_create_marathon_session(client, auth_header):
    resp = client.post("/api/sessions", json={"test_type": "marathon"}, headers=auth_header)
    assert resp.status_code == 200
    assert resp.json()["test_type"] == "marathon"


def test_create_category_session(client, auth_header, test_data):
    resp = client.post(
        "/api/sessions",
        json={"test_type": "category", "category_id": test_data["cat_id"]},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert resp.json()["test_type"] == "category"


def test_submit_correct_answer(client, auth_header):
    # Create session
    resp = client.post("/api/sessions", json={"test_type": "marathon"}, headers=auth_header)
    session_id = resp.json()["id"]

    # Get test question + correct answer
    q = _run(_queryrow("SELECT id FROM questions WHERE source_id = 90001"))
    a = _run(_queryrow("SELECT id FROM answers WHERE question_id = $1 AND is_correct = TRUE", q["id"]))

    resp = client.post(
        f"/api/sessions/{session_id}/answer",
        json={"question_id": q["id"], "answer_id": a["id"]},
        headers=auth_header,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_correct"] is True
    assert data["correct_answer_id"] == a["id"]


def test_submit_wrong_answer_creates_srs_card(client, auth_header, test_data):
    user_id = test_data["user_id"]

    resp = client.post("/api/sessions", json={"test_type": "marathon"}, headers=auth_header)
    session_id = resp.json()["id"]

    q = _run(_queryrow("SELECT id FROM questions WHERE source_id = 90002"))
    a = _run(_queryrow("SELECT id FROM answers WHERE question_id = $1 AND is_correct = FALSE LIMIT 1", q["id"]))

    resp = client.post(
        f"/api/sessions/{session_id}/answer",
        json={"question_id": q["id"], "answer_id": a["id"]},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert resp.json()["is_correct"] is False

    card = _run(_queryrow(
        "SELECT * FROM user_srs_cards WHERE user_id=$1 AND question_id=$2", user_id, q["id"]))
    assert card is not None


def test_finish_session(client, auth_header):
    resp = client.post("/api/sessions", json={"test_type": "marathon"}, headers=auth_header)
    session_id = resp.json()["id"]

    # Answer 3 correctly, 2 wrong
    for i in range(1, 6):
        q = _run(_queryrow("SELECT id FROM questions WHERE source_id = $1", 90000 + i))
        if i <= 3:
            a = _run(_queryrow("SELECT id FROM answers WHERE question_id=$1 AND is_correct=TRUE", q["id"]))
        else:
            a = _run(_queryrow("SELECT id FROM answers WHERE question_id=$1 AND is_correct=FALSE LIMIT 1", q["id"]))
        client.post(
            f"/api/sessions/{session_id}/answer",
            json={"question_id": q["id"], "answer_id": a["id"]},
            headers=auth_header,
        )

    resp = client.post(f"/api/sessions/{session_id}/finish", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("completed", "timed_out")
    assert data["correct_count"] == 3


def test_get_session_results(client, auth_header):
    resp = client.post("/api/sessions", json={"test_type": "marathon"}, headers=auth_header)
    session_id = resp.json()["id"]

    q = _run(_queryrow("SELECT id FROM questions WHERE source_id = 90001"))
    a = _run(_queryrow("SELECT id FROM answers WHERE question_id=$1 AND is_correct=TRUE", q["id"]))
    client.post(f"/api/sessions/{session_id}/answer",
                json={"question_id": q["id"], "answer_id": a["id"]}, headers=auth_header)
    client.post(f"/api/sessions/{session_id}/finish", headers=auth_header)

    resp = client.get(f"/api/sessions/{session_id}/results?lang=en", headers=auth_header)
    assert resp.status_code == 200
    assert resp.json()["correct_count"] == 1


def test_session_requires_auth(client):
    resp = client.post("/api/sessions", json={"test_type": "exam"})
    assert resp.status_code == 401
