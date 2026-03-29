"""
Stats router — dashboard stats, category breakdown, SRS review.
"""
from fastapi import APIRouter, Depends, Query
import database as db
from deps import current_user
from models import DashboardStats, CategoryStats, SRSCardOut, SRSReviewRequest, QuestionOut, AnswerOut
from srs import SRSCard, process_correct, process_wrong, compute_due_date, is_mastered

router = APIRouter(tags=["stats"])


@router.get("/stats/dashboard", response_model=DashboardStats)
async def dashboard(user_id: int = Depends(current_user)):
    """Get main dashboard stats for the current user."""
    total_q = await db.fetchval("SELECT COUNT(*) FROM questions")

    exams_taken = await db.fetchval(
        "SELECT COUNT(*) FROM test_sessions WHERE user_id=$1 AND test_type='exam' AND status != 'in_progress'",
        user_id)

    exams_passed = await db.fetchval(
        "SELECT COUNT(*) FROM test_sessions WHERE user_id=$1 AND test_type='exam' AND status='completed' AND correct_count >= 35",
        user_id)

    pass_rate = None
    if exams_taken > 0:
        pass_rate = round(100.0 * exams_passed / exams_taken, 1)

    mastered = await db.fetchval(
        "SELECT COUNT(*) FROM user_srs_cards WHERE user_id=$1 AND interval_days >= 30",
        user_id)

    due_today = await db.fetchval(
        "SELECT COUNT(*) FROM user_srs_cards WHERE user_id=$1 AND due_date <= NOW()",
        user_id)

    # Overall accuracy across all sessions
    accuracy_row = await db.fetchrow("""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END) AS correct
        FROM user_answers ua
        JOIN test_sessions ts ON ts.id = ua.session_id
        WHERE ts.user_id = $1
    """, user_id)

    overall_accuracy = None
    if accuracy_row and accuracy_row["total"] > 0:
        overall_accuracy = round(100.0 * accuracy_row["correct"] / accuracy_row["total"], 1)

    return DashboardStats(
        total_questions=total_q,
        exams_taken=exams_taken,
        exams_passed=exams_passed,
        pass_rate=pass_rate,
        mastered_count=mastered,
        due_today=due_today,
        overall_accuracy=overall_accuracy,
    )


@router.get("/stats/categories", response_model=list[CategoryStats])
async def category_stats(
    lang: str = Query("en"),
    user_id: int = Depends(current_user),
):
    """Get per-category stats with weakest-first ordering.
    Uses only the LATEST answer per question for accuracy calculation.
    """
    rows = await db.fetch("""
        SELECT
            c.id,
            COALESCE(ct.name, c.name) AS name,
            COUNT(DISTINCT q.id) AS question_count,
            COUNT(DISTINCT la.question_id) AS attempted,
            COALESCE(SUM(CASE WHEN la.is_correct THEN 1 ELSE 0 END), 0) AS correct
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
        ORDER BY CASE WHEN COUNT(la.question_id) = 0 THEN 1 ELSE 0 END,
                 100.0 * COALESCE(SUM(CASE WHEN la.is_correct THEN 1 ELSE 0 END), 0) / NULLIF(COUNT(la.question_id), 0)
    """, lang, user_id)

    return [CategoryStats(
        id=r["id"], name=r["name"],
        question_count=r["question_count"],
        attempted=r["attempted"],
        correct=r["correct"],
        accuracy=round(100.0 * r["correct"] / r["question_count"], 1) if r["attempted"] > 0 else None,
    ) for r in rows]


@router.get("/categories/{category_id}/block-stats")
async def block_stats(
    category_id: int,
    block_size: int = Query(20),
    user_id: int = Depends(current_user),
):
    """Get per-block accuracy stats for a category.
    Uses only the LATEST answer per question.
    """
    rows = await db.fetch("""
        SELECT q.id AS question_id,
               ROW_NUMBER() OVER (ORDER BY q.source_id) - 1 AS rn,
               la.is_correct
        FROM questions q
        LEFT JOIN (
            SELECT DISTINCT ON (ua.question_id) ua.question_id, ua.is_correct
            FROM user_answers ua
            JOIN test_sessions ts ON ts.id = ua.session_id
            WHERE ts.user_id = $1
            ORDER BY ua.question_id, ua.answered_at DESC
        ) la ON la.question_id = q.id
        WHERE q.category_id = $2
        ORDER BY q.source_id
    """, user_id, category_id)

    # Group by blocks
    blocks = {}
    for r in rows:
        block_start = (r["rn"] // block_size) * block_size
        if block_start not in blocks:
            blocks[block_start] = {"total": 0, "attempted": 0, "correct": 0}
        blocks[block_start]["total"] += 1
        if r["is_correct"] is not None:
            blocks[block_start]["attempted"] += 1
            if r["is_correct"]:
                blocks[block_start]["correct"] += 1

    result = []
    for block_start, stats in sorted(blocks.items()):
        acc = None
        if stats["total"] > 0 and stats["attempted"] > 0:
            acc = round(100.0 * stats["correct"] / stats["total"], 1)
        result.append({
            "block_start": block_start,
            "total": stats["total"],
            "attempted": stats["attempted"],
            "correct": stats["correct"],
            "accuracy": acc,
        })

    return result


@router.get("/srs/due", response_model=list[SRSCardOut])
async def get_due_cards(
    lang: str = Query("en"),
    user_id: int = Depends(current_user),
):
    """Get all SRS cards due for review."""
    rows = await db.fetch("""
        SELECT sc.*,
               q.source_id, q.image_filename,
               COALESCE(qt.question_text, q.question_text) AS question_text,
               COALESCE(qt.explanation, q.explanation) AS explanation,
               COALESCE(qt.hint, q.hint) AS hint,
               COALESCE(ct.name, c.name) AS category_name
        FROM user_srs_cards sc
        JOIN questions q ON q.id = sc.question_id
        LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.lang = $1
        LEFT JOIN categories c ON c.id = q.category_id
        LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = $1
        WHERE sc.user_id = $2 AND sc.due_date <= NOW()
        ORDER BY sc.due_date
    """, lang, user_id)

    # Bulk fetch all answers in ONE query
    question_ids = [r["question_id"] for r in rows]
    if question_ids:
        answers_rows = await db.fetch("""
            SELECT a.question_id, a.id, COALESCE(at2.answer_text, a.answer_text) AS answer_text, a.is_correct
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

    cards = []
    for r in rows:
        cards.append(SRSCardOut(
            id=r["id"], question_id=r["question_id"],
            stability=r["stability"], difficulty=r["difficulty"],
            interval_days=r["interval_days"], due_date=r["due_date"],
            repetitions=r["repetitions"], lapses=r["lapses"],
            question=QuestionOut(
                id=r["question_id"], source_id=r["source_id"],
                question_text=r["question_text"], explanation=r["explanation"],
                hint=r["hint"],
                image_filename=r["image_filename"], category_name=r["category_name"],
                answers=answers_map.get(r["question_id"], []),
            ),
        ))

    return cards


@router.post("/srs/review")
async def review_srs_card(
    request: SRSReviewRequest,
    user_id: int = Depends(current_user),
):
    """Process an SRS review result (correct/wrong)."""
    row = await db.fetchrow(
        "SELECT * FROM user_srs_cards WHERE user_id=$1 AND question_id=$2",
        user_id, request.question_id)

    if not row:
        raise Exception("SRS card not found")

    card = SRSCard(
        stability=row["stability"], difficulty=row["difficulty"],
        interval_days=row["interval_days"],
        repetitions=row["repetitions"], lapses=row["lapses"],
    )

    if request.is_correct:
        updated = process_correct(card)
    else:
        updated = process_wrong(card)

    due = compute_due_date(updated)

    await db.execute("""
        UPDATE user_srs_cards SET
            stability=$1, difficulty=$2, interval_days=$3,
            due_date=$4, repetitions=$5, lapses=$6, last_review=NOW()
        WHERE user_id=$7 AND question_id=$8
    """, updated.stability, updated.difficulty, updated.interval_days,
        due, updated.repetitions, updated.lapses, user_id, request.question_id)

    return {
        "mastered": is_mastered(updated),
        "next_due": due.isoformat(),
        "interval_days": round(updated.interval_days, 1),
    }
