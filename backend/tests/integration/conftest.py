"""
Integration test fixtures.

Uses synchronous httpx + asyncpg via asyncio.run().
Tests hit the REAL running backend at http://localhost:8000.
"""
import os
import sys
import asyncio
import pytest
import asyncpg
import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from auth import create_jwt

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://botuser:botpass@db:5432/driver_test")


def _run(coro):
    """Run an async function synchronously."""
    return asyncio.get_event_loop().run_until_complete(coro)


async def _seed():
    """Seed test data and return user_id + cat_id."""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        user = await conn.fetchrow(
            """INSERT INTO users (telegram_id, username, first_name)
               VALUES (99999, 'testbot', 'TestUser')
               ON CONFLICT (telegram_id)
               DO UPDATE SET username='testbot', first_name='TestUser'
               RETURNING id""")
        user_id = user["id"]
        await conn.execute(
            "INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING", user_id)

        cat = await conn.fetchrow(
            """INSERT INTO categories (name) VALUES ('Test Category')
               ON CONFLICT (name) DO UPDATE SET name='Test Category'
               RETURNING id""")
        cat_id = cat["id"]

        for i in range(1, 6):
            sid = 90000 + i
            q = await conn.fetchrow(
                """INSERT INTO questions (source_id, question_text, explanation, category_id)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (source_id) DO UPDATE SET question_text=$2, explanation=$3, category_id=$4
                   RETURNING id""", sid, f"Test question {i}?", f"Explanation for {i}", cat_id)
            await conn.execute("DELETE FROM answers WHERE question_id=$1", q["id"])
            for j in range(4):
                await conn.execute(
                    "INSERT INTO answers (question_id, answer_text, is_correct) VALUES ($1, $2, $3)",
                    q["id"], f"Answer {j} for Q{i}", j == 0)
        return {"user_id": user_id, "cat_id": cat_id}
    finally:
        await conn.close()


async def _cleanup(user_id):
    """Remove test data."""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            "DELETE FROM user_answers WHERE session_id IN (SELECT id FROM test_sessions WHERE user_id=$1)", user_id)
        await conn.execute("DELETE FROM test_sessions WHERE user_id=$1", user_id)
        await conn.execute("DELETE FROM user_bookmarks WHERE user_id=$1", user_id)
        await conn.execute("DELETE FROM user_srs_cards WHERE user_id=$1", user_id)
    finally:
        await conn.close()


async def _query(sql, *args):
    """Run a single query and return the result."""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        return await conn.fetch(sql, *args)
    finally:
        await conn.close()


async def _queryrow(sql, *args):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        return await conn.fetchrow(sql, *args)
    finally:
        await conn.close()


async def _exec(sql, *args):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        return await conn.execute(sql, *args)
    finally:
        await conn.close()


@pytest.fixture(autouse=True)
def test_data():
    """Seed before, cleanup after each test."""
    data = _run(_seed())
    yield data
    _run(_cleanup(data["user_id"]))


@pytest.fixture
def auth_header(test_data):
    token = create_jwt(user_id=99999, db_user_id=test_data["user_id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    with httpx.Client(base_url=BACKEND_URL, timeout=10.0) as c:
        yield c
