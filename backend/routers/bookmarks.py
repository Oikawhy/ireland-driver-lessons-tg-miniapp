"""
Bookmarks router — save/unsave questions.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
import database as db
from deps import current_user
from models import BookmarkCreate, BookmarkOut, QuestionOut, AnswerOut

router = APIRouter(tags=["bookmarks"])


@router.get("/bookmarks", response_model=list[BookmarkOut])
async def get_bookmarks(
    lang: str = Query("en"),
    user_id: int = Depends(current_user),
):
    """Get all bookmarked questions for the current user."""
    rows = await db.fetch("""
        SELECT b.id, b.question_id, b.created_at,
               q.source_id, q.image_filename,
               COALESCE(qt.question_text, q.question_text) AS question_text,
               COALESCE(qt.explanation, q.explanation) AS explanation,
               COALESCE(qt.hint, q.hint) AS hint,
               COALESCE(ct.name, c.name) AS category_name
        FROM user_bookmarks b
        JOIN questions q ON q.id = b.question_id
        LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.lang = $1
        LEFT JOIN categories c ON c.id = q.category_id
        LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = $1
        WHERE b.user_id = $2
        ORDER BY b.created_at DESC
    """, lang, user_id)

    bookmarks = []
    for r in rows:
        answers_rows = await db.fetch("""
            SELECT a.id, COALESCE(at2.answer_text, a.answer_text) AS answer_text, a.is_correct
            FROM answers a
            LEFT JOIN answer_translations at2 ON at2.answer_id = a.id AND at2.lang = $1
            WHERE a.question_id = $2
        """, lang, r["question_id"])

        bookmarks.append(BookmarkOut(
            id=r["id"], question_id=r["question_id"], created_at=r["created_at"],
            question=QuestionOut(
                id=r["question_id"], source_id=r["source_id"],
                question_text=r["question_text"], explanation=r["explanation"],
                hint=r["hint"],
                image_filename=r["image_filename"], category_name=r["category_name"],
                answers=[AnswerOut(id=a["id"], answer_text=a["answer_text"], is_correct=a["is_correct"])
                         for a in answers_rows],
            ),
        ))

    return bookmarks


@router.post("/bookmarks", response_model=BookmarkOut)
async def create_bookmark(
    request: BookmarkCreate,
    user_id: int = Depends(current_user),
):
    """Bookmark a question."""
    # Check question exists
    q = await db.fetchrow("SELECT id FROM questions WHERE id=$1", request.question_id)
    if not q:
        raise HTTPException(404, "Question not found")

    row = await db.fetchrow("""
        INSERT INTO user_bookmarks (user_id, question_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, question_id) DO UPDATE SET created_at = user_bookmarks.created_at
        RETURNING id, question_id, created_at
    """, user_id, request.question_id)

    return BookmarkOut(id=row["id"], question_id=row["question_id"], created_at=row["created_at"])


@router.delete("/bookmarks/{question_id}")
async def delete_bookmark(
    question_id: int,
    user_id: int = Depends(current_user),
):
    """Remove a bookmark."""
    result = await db.execute(
        "DELETE FROM user_bookmarks WHERE user_id=$1 AND question_id=$2",
        user_id, question_id)

    if result == "DELETE 0":
        raise HTTPException(404, "Bookmark not found")

    return {"status": "deleted"}
