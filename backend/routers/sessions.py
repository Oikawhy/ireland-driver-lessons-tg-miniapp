"""
Sessions router — create, answer, finish test sessions.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
import database as db
from deps import current_user
from models import (
    SessionCreateRequest, SessionOut, AnswerSubmitRequest,
    AnswerSubmitResponse, SessionResultsOut, QuestionOut, AnswerOut,
)
from srs import SRSCard, process_wrong, compute_due_date

router = APIRouter(tags=["sessions"])


@router.post("/sessions", response_model=SessionOut)
async def create_session(
    request: SessionCreateRequest,
    user_id: int = Depends(current_user),
):
    """Start a new test session."""
    # Determine question count and time limit
    if request.test_type == "exam":
        total = 40
        time_limit = request.time_limit_sec
        if not time_limit:
            settings = await db.fetchrow(
                "SELECT exam_time_limit FROM user_settings WHERE user_id=$1", user_id)
            time_limit = settings["exam_time_limit"] if settings else 2400
    elif request.test_type == "marathon":
        total = await db.fetchval("SELECT COUNT(*) FROM questions")
        time_limit = None
    elif request.test_type == "category":
        if not request.category_id:
            raise HTTPException(400, "category_id required for category mode")
        total = await db.fetchval(
            "SELECT COUNT(*) FROM questions WHERE category_id=$1", request.category_id)
        time_limit = None
    elif request.test_type == "incorrect":
        total = await db.fetchval(
            "SELECT COUNT(*) FROM user_srs_cards WHERE user_id=$1 AND due_date <= NOW()",
            user_id)
        if total == 0:
            raise HTTPException(404, "No due SRS cards")
        time_limit = None
    else:
        raise HTTPException(400, f"Invalid test_type: {request.test_type}")

    row = await db.fetchrow("""
        INSERT INTO test_sessions (user_id, test_type, category_id, total_questions, time_limit_sec)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, test_type, status, total_questions, correct_count, started_at, time_limit_sec
    """, user_id, request.test_type, request.category_id, total, time_limit)

    return SessionOut(
        id=row["id"], test_type=row["test_type"], status=row["status"],
        total_questions=row["total_questions"], correct_count=row["correct_count"],
        started_at=row["started_at"], time_limit_sec=row["time_limit_sec"],
    )


@router.post("/sessions/{session_id}/answer", response_model=AnswerSubmitResponse)
async def submit_answer(
    session_id: int,
    request: AnswerSubmitRequest,
    lang: str = Query("en"),
    user_id: int = Depends(current_user),
):
    """Submit an answer for a question in a session."""
    # Verify session belongs to user and is in progress
    session = await db.fetchrow(
        "SELECT * FROM test_sessions WHERE id=$1 AND user_id=$2",
        session_id, user_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session["status"] != "in_progress":
        raise HTTPException(400, "Session is not in progress")

    # Check if answer is correct
    answer = await db.fetchrow(
        "SELECT is_correct FROM answers WHERE id=$1 AND question_id=$2",
        request.answer_id, request.question_id)
    if not answer:
        raise HTTPException(400, "Invalid answer_id for this question")

    is_correct = answer["is_correct"]

    # Record user answer (ON CONFLICT allows re-answering in exam mode)
    # Check if already answered
    existing_answer = await db.fetchrow(
        "SELECT is_correct FROM user_answers WHERE session_id=$1 AND question_id=$2",
        session_id, request.question_id)

    if existing_answer:
        # Re-answering: update the answer
        old_correct = existing_answer["is_correct"]
        await db.execute("""
            UPDATE user_answers SET answer_id=$1, is_correct=$2, answered_at=NOW()
            WHERE session_id=$3 AND question_id=$4
        """, request.answer_id, is_correct, session_id, request.question_id)
        # Adjust correct count
        if old_correct and not is_correct:
            await db.execute("UPDATE test_sessions SET correct_count = correct_count - 1 WHERE id=$1", session_id)
        elif not old_correct and is_correct:
            await db.execute("UPDATE test_sessions SET correct_count = correct_count + 1 WHERE id=$1", session_id)
    else:
        await db.execute("""
            INSERT INTO user_answers (session_id, question_id, answer_id, is_correct)
            VALUES ($1, $2, $3, $4)
        """, session_id, request.question_id, request.answer_id, is_correct)

    # Update correct count (only for new answers, handled above for re-answers)
    if not existing_answer and is_correct:
        await db.execute(
            "UPDATE test_sessions SET correct_count = correct_count + 1 WHERE id=$1",
            session_id)

    # If wrong → create/update SRS card
    if not is_correct:
        existing = await db.fetchrow(
            "SELECT * FROM user_srs_cards WHERE user_id=$1 AND question_id=$2",
            user_id, request.question_id)

        if existing:
            card = SRSCard(
                stability=existing["stability"],
                difficulty=existing["difficulty"],
                interval_days=existing["interval_days"],
                repetitions=existing["repetitions"],
                lapses=existing["lapses"],
            )
            updated = process_wrong(card)
            due = compute_due_date(updated)
            await db.execute("""
                UPDATE user_srs_cards SET
                    stability=$1, difficulty=$2, interval_days=$3,
                    due_date=$4, lapses=$5, last_review=NOW()
                WHERE user_id=$6 AND question_id=$7
            """, updated.stability, updated.difficulty, updated.interval_days,
                due, updated.lapses, user_id, request.question_id)
        else:
            card = SRSCard()  # defaults: stability=0.4, difficulty=5.0
            due = compute_due_date(card)
            await db.execute("""
                INSERT INTO user_srs_cards (user_id, question_id, stability, difficulty, interval_days, due_date)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id, question_id) DO NOTHING
            """, user_id, request.question_id, card.stability, card.difficulty,
                card.interval_days, due)

    # Get correct answer id and explanation
    correct = await db.fetchrow("""
        SELECT a.id,
               COALESCE(qt.explanation, q.explanation) AS explanation
        FROM answers a
        JOIN questions q ON q.id = a.question_id
        LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.lang = $1
        WHERE a.question_id = $2 AND a.is_correct = true
        LIMIT 1
    """, lang, request.question_id)

    return AnswerSubmitResponse(
        is_correct=is_correct,
        correct_answer_id=correct["id"] if correct else request.answer_id,
        explanation=correct["explanation"] if correct else None,
    )


@router.post("/sessions/{session_id}/finish", response_model=SessionResultsOut)
async def finish_session(
    session_id: int,
    user_id: int = Depends(current_user),
):
    """End a session and calculate results."""
    session = await db.fetchrow(
        "SELECT * FROM test_sessions WHERE id=$1 AND user_id=$2",
        session_id, user_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # Update status
    status = "completed"
    if session["time_limit_sec"]:
        elapsed = (datetime.now(timezone.utc) - session["started_at"]).total_seconds()
        if elapsed >= session["time_limit_sec"]:
            status = "timed_out"

    await db.execute("""
        UPDATE test_sessions SET status=$1, finished_at=NOW() WHERE id=$2
    """, status, session_id)

    # Get updated session
    updated = await db.fetchrow("SELECT * FROM test_sessions WHERE id=$1", session_id)

    passed = None
    if updated["test_type"] == "exam":
        passed = updated["correct_count"] >= 35

    return SessionResultsOut(
        id=updated["id"], test_type=updated["test_type"], status=updated["status"],
        total_questions=updated["total_questions"], correct_count=updated["correct_count"],
        started_at=updated["started_at"], finished_at=updated["finished_at"],
        passed=passed,
    )


@router.get("/sessions/{session_id}/results", response_model=SessionResultsOut)
async def get_results(
    session_id: int,
    lang: str = Query("en"),
    user_id: int = Depends(current_user),
):
    """Get session results with per-question review."""
    session = await db.fetchrow(
        "SELECT * FROM test_sessions WHERE id=$1 AND user_id=$2",
        session_id, user_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # Get all answered questions with user's answers
    rows = await db.fetch("""
        SELECT
            q.id, q.source_id, q.image_filename,
            COALESCE(qt.question_text, q.question_text) AS question_text,
            COALESCE(qt.explanation, q.explanation) AS explanation,
            COALESCE(qt.hint, q.hint) AS hint,
            COALESCE(ct.name, c.name) AS category_name,
            ua.is_correct AS user_correct, ua.answer_id AS user_answer_id
        FROM user_answers ua
        JOIN questions q ON q.id = ua.question_id
        LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.lang = $1
        LEFT JOIN categories c ON c.id = q.category_id
        LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = $1
        WHERE ua.session_id = $2
        ORDER BY ua.answered_at
    """, lang, session_id)

    questions = []
    question_ids = [r["id"] for r in rows]

    # Bulk fetch ALL answers in one query (avoids N+1)
    if question_ids:
        answers_rows = await db.fetch("""
            SELECT a.question_id, a.id,
                   COALESCE(at2.answer_text, a.answer_text) AS answer_text,
                   a.is_correct
            FROM answers a
            LEFT JOIN answer_translations at2 ON at2.answer_id = a.id AND at2.lang = $1
            WHERE a.question_id = ANY($2::int[])
            ORDER BY a.question_id, a.id
        """, lang, question_ids)
    else:
        answers_rows = []

    # Group answers by question_id
    answers_map = {}
    for a in answers_rows:
        qid = a["question_id"]
        if qid not in answers_map:
            answers_map[qid] = []
        answers_map[qid].append(AnswerOut(id=a["id"], answer_text=a["answer_text"], is_correct=a["is_correct"]))

    for r in rows:
        questions.append(QuestionOut(
            id=r["id"], source_id=r["source_id"],
            question_text=r["question_text"], explanation=r["explanation"],
            hint=r["hint"],
            image_filename=r["image_filename"], category_name=r["category_name"],
            answers=answers_map.get(r["id"], []),
            user_answer_id=r["user_answer_id"], user_correct=r["user_correct"],
        ))

    passed = None
    if session["test_type"] == "exam":
        passed = session["correct_count"] >= 35

    return SessionResultsOut(
        id=session["id"], test_type=session["test_type"], status=session["status"],
        total_questions=session["total_questions"], correct_count=session["correct_count"],
        started_at=session["started_at"], finished_at=session["finished_at"],
        passed=passed, questions=questions,
    )


@router.post("/sessions/{session_id}/discard")
async def discard_session(
    session_id: int,
    user_id: int = Depends(current_user),
):
    """Discard a session — marks as discarded so it doesn't count in stats."""
    session = await db.fetchrow(
        "SELECT * FROM test_sessions WHERE id=$1 AND user_id=$2",
        session_id, user_id)
    if not session:
        raise HTTPException(404, "Session not found")

    await db.execute(
        "UPDATE test_sessions SET status='discarded', finished_at=NOW() WHERE id=$1",
        session_id)
    return {"status": "discarded"}
