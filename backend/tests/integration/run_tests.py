"""
Integration test runner — Standalone script.
Runs against the REAL backend at http://localhost:8000 inside Docker.

Usage: python tests/integration/run_tests.py
"""
import sys
import os
import asyncio
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import asyncpg
import httpx
from auth import create_jwt

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
DATABASE_URL = os.environ["DATABASE_URL"]  # from docker-compose .env

passed = 0
failed = 0
errors = []


async def db_queryrow(sql, *args):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        return await conn.fetchrow(sql, *args)
    finally:
        await conn.close()


async def db_exec(sql, *args):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        return await conn.execute(sql, *args)
    finally:
        await conn.close()


async def seed():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        user = await conn.fetchrow(
            """INSERT INTO users (telegram_id, username, first_name)
               VALUES (99999, 'testbot', 'TestUser')
               ON CONFLICT (telegram_id) DO UPDATE SET username='testbot', first_name='TestUser'
               RETURNING id""")
        uid = user["id"]
        await conn.execute("INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING", uid)
        cat = await conn.fetchrow(
            """INSERT INTO categories (name) VALUES ('Test Category')
               ON CONFLICT (name) DO UPDATE SET name='Test Category' RETURNING id""")
        cid = cat["id"]
        qids = []
        for i in range(1, 6):
            q = await conn.fetchrow(
                """INSERT INTO questions (source_id, question_text, explanation, category_id)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (source_id) DO UPDATE SET question_text=$2, explanation=$3, category_id=$4
                   RETURNING id""", 90000+i, f"Test question {i}?", f"Explanation for {i}", cid)
            qids.append(q["id"])
            await conn.execute("DELETE FROM answers WHERE question_id=$1", q["id"])
            for j in range(4):
                await conn.execute(
                    "INSERT INTO answers (question_id, answer_text, is_correct) VALUES ($1, $2, $3)",
                    q["id"], f"Answer {j} for Q{i}", j == 0)

        # Pre-fetch answers for tests
        test_answers = {}
        for qid in qids:
            correct = await conn.fetchrow("SELECT id FROM answers WHERE question_id=$1 AND is_correct=TRUE", qid)
            wrong = await conn.fetchrow("SELECT id FROM answers WHERE question_id=$1 AND is_correct=FALSE LIMIT 1", qid)
            test_answers[qid] = {"correct": correct["id"], "wrong": wrong["id"]}

        return uid, cid, qids, test_answers
    finally:
        await conn.close()


async def cleanup(uid):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("DELETE FROM user_answers WHERE session_id IN (SELECT id FROM test_sessions WHERE user_id=$1)", uid)
        await conn.execute("DELETE FROM test_sessions WHERE user_id=$1", uid)
        await conn.execute("DELETE FROM user_bookmarks WHERE user_id=$1", uid)
        await conn.execute("DELETE FROM user_srs_cards WHERE user_id=$1", uid)
    finally:
        await conn.close()


async def check_srs_card(uid, qid):
    return await db_queryrow("SELECT * FROM user_srs_cards WHERE user_id=$1 AND question_id=$2", uid, qid)


def run_test(name, func):
    global passed, failed
    try:
        func()
        passed += 1
        print(f"  ✅ {name}")
    except Exception as e:
        failed += 1
        errors.append((name, str(e)))
        print(f"  ❌ {name}: {e}")


async def main():
    global passed, failed
    print("🔗 Seeding test data...")
    uid, cid, qids, answers = await seed()
    token = create_jwt(user_id=99999, db_user_id=uid)
    h = {"Authorization": f"Bearer {token}"}

    with httpx.Client(base_url=BACKEND_URL, timeout=10.0) as c:

        # ─── HEALTH ───────────────────────
        print("\n🏥 Health:")
        def test_health():
            r = c.get("/api/health")
            assert r.status_code == 200 and r.json()["questions"] > 0
        run_test("health_endpoint", test_health)

        # ─── SESSIONS ─────────────────────
        print("\n📋 Sessions:")

        def test_create_exam():
            r = c.post("/api/sessions", json={"test_type": "exam"}, headers=h)
            assert r.status_code == 200
            d = r.json()
            assert d["status"] == "in_progress" and d["test_type"] == "exam" and d["total_questions"] > 0
        run_test("create_exam_session", test_create_exam)

        def test_create_marathon():
            r = c.post("/api/sessions", json={"test_type": "marathon"}, headers=h)
            assert r.status_code == 200 and r.json()["test_type"] == "marathon"
        run_test("create_marathon_session", test_create_marathon)

        def test_create_category():
            r = c.post("/api/sessions", json={"test_type": "category", "category_id": cid}, headers=h)
            assert r.status_code == 200 and r.json()["test_type"] == "category"
        run_test("create_category_session", test_create_category)

        def test_correct_answer():
            r = c.post("/api/sessions", json={"test_type": "marathon"}, headers=h)
            sid = r.json()["id"]
            r = c.post(f"/api/sessions/{sid}/answer",
                       json={"question_id": qids[0], "answer_id": answers[qids[0]]["correct"]}, headers=h)
            assert r.status_code == 200
            assert r.json()["is_correct"] is True
        run_test("submit_correct_answer", test_correct_answer)

        def test_wrong_answer():
            r = c.post("/api/sessions", json={"test_type": "marathon"}, headers=h)
            sid = r.json()["id"]
            r = c.post(f"/api/sessions/{sid}/answer",
                       json={"question_id": qids[1], "answer_id": answers[qids[1]]["wrong"]}, headers=h)
            assert r.status_code == 200
            assert r.json()["is_correct"] is False
        run_test("submit_wrong_answer", test_wrong_answer)

        def test_finish():
            r = c.post("/api/sessions", json={"test_type": "marathon"}, headers=h)
            sid = r.json()["id"]
            for i, qid in enumerate(qids):
                aid = answers[qid]["correct"] if i < 3 else answers[qid]["wrong"]
                c.post(f"/api/sessions/{sid}/answer", json={"question_id": qid, "answer_id": aid}, headers=h)
            r = c.post(f"/api/sessions/{sid}/finish", headers=h)
            assert r.status_code == 200
            assert r.json()["correct_count"] == 3
        run_test("finish_session_correct_count", test_finish)

        def test_results():
            r = c.post("/api/sessions", json={"test_type": "marathon"}, headers=h)
            sid = r.json()["id"]
            c.post(f"/api/sessions/{sid}/answer",
                   json={"question_id": qids[0], "answer_id": answers[qids[0]]["correct"]}, headers=h)
            c.post(f"/api/sessions/{sid}/finish", headers=h)
            r = c.get(f"/api/sessions/{sid}/results?lang=en", headers=h)
            assert r.status_code == 200 and r.json()["correct_count"] == 1
        run_test("get_session_results", test_results)

        def test_auth_required():
            r = c.post("/api/sessions", json={"test_type": "exam"})
            assert r.status_code == 401
        run_test("session_requires_auth", test_auth_required)

        # ─── BOOKMARKS ────────────────────
        print("\n🔖 Bookmarks:")

        def test_add_bm():
            r = c.post("/api/bookmarks", json={"question_id": qids[0]}, headers=h)
            assert r.status_code == 200
        run_test("add_bookmark", test_add_bm)

        def test_list_bm():
            c.post("/api/bookmarks", json={"question_id": qids[0]}, headers=h)
            r = c.get("/api/bookmarks?lang=en", headers=h)
            assert r.status_code == 200 and len(r.json()) >= 1
        run_test("list_bookmarks", test_list_bm)

        def test_remove_bm():
            c.post("/api/bookmarks", json={"question_id": qids[2]}, headers=h)
            r = c.delete(f"/api/bookmarks/{qids[2]}", headers=h)
            assert r.status_code == 200
        run_test("remove_bookmark", test_remove_bm)

        def test_bm_dup():
            r1 = c.post("/api/bookmarks", json={"question_id": qids[1]}, headers=h)
            r2 = c.post("/api/bookmarks", json={"question_id": qids[1]}, headers=h)
            assert r1.status_code == 200 and r2.status_code == 200
        run_test("bookmark_idempotent", test_bm_dup)

        def test_bm_auth():
            r = c.get("/api/bookmarks")
            assert r.status_code == 401
        run_test("bookmarks_require_auth", test_bm_auth)

        # ─── TRANSLATIONS ─────────────────
        print("\n🌐 Translations:")

        def test_cats_en():
            r = c.get("/api/categories?lang=en", headers=h)
            assert r.status_code == 200
            assert "Test Category" in [x["name"] for x in r.json()]
        run_test("categories_english", test_cats_en)

        def test_cats_fallback():
            r = c.get("/api/categories?lang=xx", headers=h)
            assert r.status_code == 200
            assert "Test Category" in [x["name"] for x in r.json()]
        run_test("categories_unknown_lang_fallback", test_cats_fallback)

        def test_questions_en():
            r = c.get("/api/questions?mode=marathon&lang=en", headers=h)
            assert r.status_code == 200 and len(r.json()) > 0
        run_test("questions_english", test_questions_en)

    # Cleanup
    print("\n🧹 Cleaning up test data...")
    await cleanup(uid)

    # Summary
    total = passed + failed
    print(f"\n{'='*50}")
    if failed == 0:
        print(f"✅ All {total} integration tests passed!")
    else:
        print(f"Results: {passed}/{total} passed, {failed} failed")
        for name, err in errors:
            print(f"  ❌ {name}: {err}")
    print(f"{'='*50}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
