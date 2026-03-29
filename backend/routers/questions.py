"""
Questions router — GET questions with translation support.
Server-side in-memory cache for questions+answers per language.
Exam mode shuffles from cache; marathon serves the full cache shuffled.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
import random
import database as db
from deps import current_user
from models import QuestionOut, AnswerOut, CategoryOut

router = APIRouter(tags=["questions"])

# ─── In-memory cache ─────────────────────────────
# Structure: { lang: [QuestionOut, ...] }
_questions_cache: dict[str, list[QuestionOut]] = {}


async def _load_cache(lang: str) -> list[QuestionOut]:
    """Load all questions+answers for a language into memory. Called once per lang."""
    if lang in _questions_cache:
        return _questions_cache[lang]

    rows = await db.fetch("""
        SELECT
            q.id, q.source_id, q.image_filename, q.category_id,
            COALESCE(qt.question_text, q.question_text) AS question_text,
            COALESCE(qt.explanation, q.explanation) AS explanation,
            COALESCE(qt.hint, q.hint) AS hint,
            COALESCE(ct.name, c.name) AS category_name
        FROM questions q
        LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.lang = $1
        LEFT JOIN categories c ON c.id = q.category_id
        LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = $1
        ORDER BY q.source_id
    """, lang)

    answers_rows = await db.fetch("""
        SELECT a.question_id, a.id, COALESCE(at2.answer_text, a.answer_text) AS answer_text, a.is_correct
        FROM answers a
        LEFT JOIN answer_translations at2 ON at2.answer_id = a.id AND at2.lang = $1
        ORDER BY a.question_id, a.id
    """, lang)

    answers_map: dict[int, list[AnswerOut]] = {}
    for a in answers_rows:
        qid = a["question_id"]
        if qid not in answers_map:
            answers_map[qid] = []
        answers_map[qid].append(AnswerOut(id=a["id"], answer_text=a["answer_text"], is_correct=a["is_correct"]))

    questions = []
    for r in rows:
        questions.append(QuestionOut(
            id=r["id"], source_id=r["source_id"],
            question_text=r["question_text"],
            explanation=r["explanation"],
            hint=r["hint"],
            image_filename=r["image_filename"],
            category_name=r["category_name"],
            category_id=r["category_id"],
            answers=answers_map.get(r["id"], []),
        ))

    _questions_cache[lang] = questions
    return questions


def invalidate_cache():
    """Clear the questions cache (called when data changes)."""
    _questions_cache.clear()


# ─── Routes ──────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
async def get_categories(
    lang: str = Query("en"),
    user_id: int = Depends(current_user),
):
    """Get all categories with question counts and user accuracy."""
    rows = await db.fetch("""
        SELECT
            c.id,
            COALESCE(ct.name, c.name) AS name,
            COUNT(DISTINCT q.id) AS question_count,
            -- Accuracy: correct answers / total questions in category
            CASE
                WHEN COUNT(la.question_id) > 0
                THEN ROUND(100.0 * SUM(CASE WHEN la.is_correct THEN 1 ELSE 0 END) / COUNT(DISTINCT q.id))
                ELSE NULL
            END AS accuracy
        FROM categories c
        LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = $1
        LEFT JOIN questions q ON q.category_id = c.id
        LEFT JOIN (
            SELECT DISTINCT ON (ua.question_id) ua.question_id, ua.is_correct
            FROM user_answers ua
            JOIN test_sessions ts ON ts.id = ua.session_id
            WHERE ts.user_id = $2
            ORDER BY ua.question_id, ua.answered_at DESC
        ) la ON la.question_id = q.id
        GROUP BY c.id, c.name, ct.name
        ORDER BY c.name
    """, lang, user_id)

    return [CategoryOut(
        id=r["id"], name=r["name"],
        question_count=r["question_count"],
        accuracy=float(r["accuracy"]) if r["accuracy"] is not None else None,
    ) for r in rows]


@router.get("/questions", response_model=list[QuestionOut])
async def get_questions(
    mode: str = Query("exam"),
    lang: str = Query("en"),
    category_id: Optional[int] = Query(None),
    limit: Optional[int] = Query(None),
    offset: Optional[int] = Query(None),
    user_id: int = Depends(current_user),
):
    """
    Get questions from in-memory cache. Instant response.
    - exam: 40 random questions
    - marathon: all shuffled
    - category: filter by category_id, optional offset+limit
    """
    all_questions = await _load_cache(lang)

    if mode == "exam":
        result = random.sample(all_questions, min(40, len(all_questions)))
    elif mode == "marathon":
        result = list(all_questions)
        random.shuffle(result)
    elif mode == "category" and category_id:
        filtered = [q for q in all_questions if q.category_id == category_id]
        if offset is not None:
            filtered = filtered[offset:]
        if limit is not None:
            filtered = filtered[:limit]
        result = filtered
    else:
        result = list(all_questions)

    return result
