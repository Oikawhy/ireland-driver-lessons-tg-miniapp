"""
Integration tests — Bookmark CRUD.
Synchronous tests against running backend.
"""
from conftest import _run, _queryrow


def test_add_bookmark(client, auth_header):
    q = _run(_queryrow("SELECT id FROM questions WHERE source_id = 90001"))
    resp = client.post("/api/bookmarks", json={"question_id": q["id"]}, headers=auth_header)
    assert resp.status_code == 200


def test_list_bookmarks(client, auth_header):
    q = _run(_queryrow("SELECT id FROM questions WHERE source_id = 90001"))
    client.post("/api/bookmarks", json={"question_id": q["id"]}, headers=auth_header)
    resp = client.get("/api/bookmarks?lang=en", headers=auth_header)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_remove_bookmark(client, auth_header):
    q = _run(_queryrow("SELECT id FROM questions WHERE source_id = 90003"))
    client.post("/api/bookmarks", json={"question_id": q["id"]}, headers=auth_header)
    resp = client.delete(f"/api/bookmarks/{q['id']}", headers=auth_header)
    assert resp.status_code == 200
    resp = client.get("/api/bookmarks?lang=en", headers=auth_header)
    assert not any(b["question_id"] == q["id"] for b in resp.json())


def test_bookmark_duplicate_idempotent(client, auth_header):
    q = _run(_queryrow("SELECT id FROM questions WHERE source_id = 90002"))
    r1 = client.post("/api/bookmarks", json={"question_id": q["id"]}, headers=auth_header)
    r2 = client.post("/api/bookmarks", json={"question_id": q["id"]}, headers=auth_header)
    assert r1.status_code == 200
    assert r2.status_code == 200


def test_bookmarks_require_auth(client):
    resp = client.get("/api/bookmarks")
    assert resp.status_code == 401
