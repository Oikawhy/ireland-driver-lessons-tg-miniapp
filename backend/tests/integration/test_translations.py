"""
Integration tests — Translation fallback + language switching.
Synchronous tests against running backend.
"""
from conftest import _run, _queryrow, _exec


def test_categories_english(client, auth_header):
    resp = client.get("/api/categories?lang=en", headers=auth_header)
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert "Test Category" in names


def test_categories_unknown_lang_fallback(client, auth_header):
    resp = client.get("/api/categories?lang=xx", headers=auth_header)
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert "Test Category" in names


def test_questions_return_english(client, auth_header):
    resp = client.get("/api/questions?mode=marathon&lang=en", headers=auth_header)
    assert resp.status_code == 200
    assert len(resp.json()) > 0


def test_categories_russian_translation(client, auth_header, test_data):
    cat_id = test_data["cat_id"]
    _run(_exec(
        """INSERT INTO category_translations (category_id, lang, name)
           VALUES ($1, 'ru', 'Тестовая')
           ON CONFLICT (category_id, lang) DO UPDATE SET name='Тестовая'""", cat_id))

    resp = client.get("/api/categories?lang=ru", headers=auth_header)
    assert resp.status_code == 200
    test_cat = next((c for c in resp.json() if c["id"] == cat_id), None)
    assert test_cat is not None
    assert test_cat["name"] == "Тестовая"

    _run(_exec("DELETE FROM category_translations WHERE category_id=$1 AND lang='ru'", cat_id))


def test_questions_russian_translation(client, auth_header, test_data):
    q = _run(_queryrow("SELECT id FROM questions WHERE source_id = 90001"))
    _run(_exec(
        """INSERT INTO question_translations (question_id, lang, question_text, explanation)
           VALUES ($1, 'ru', 'Тестовый вопрос?', 'Объяснение')
           ON CONFLICT (question_id, lang) DO UPDATE SET question_text='Тестовый вопрос?'""", q["id"]))

    resp = client.get("/api/questions?mode=marathon&lang=ru", headers=auth_header)
    assert resp.status_code == 200
    translated = next((qq for qq in resp.json() if qq["id"] == q["id"]), None)
    assert translated is not None
    assert translated["question_text"] == "Тестовый вопрос?"

    _run(_exec("DELETE FROM question_translations WHERE question_id=$1 AND lang='ru'", q["id"]))


def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["questions"] > 0
