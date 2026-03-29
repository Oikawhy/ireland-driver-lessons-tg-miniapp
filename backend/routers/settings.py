"""
Settings router — user settings CRUD.
"""
from fastapi import APIRouter, Depends, HTTPException
import database as db
from deps import current_user
from models import UserSettings

router = APIRouter(tags=["settings"])


@router.get("/settings", response_model=UserSettings)
async def get_settings(user_id: int = Depends(current_user)):
    """Get current user settings."""
    row = await db.fetchrow(
        "SELECT * FROM user_settings WHERE user_id=$1", user_id)
    if not row:
        return UserSettings()
    return UserSettings(
        marathon_auto_next=row["marathon_auto_next"],
        theme=row["theme"],
        haptic_feedback=row["haptic_feedback"],
        exam_time_limit=row["exam_time_limit"],
        language=row["language"],
    )


@router.put("/settings", response_model=UserSettings)
async def update_settings(
    settings: UserSettings,
    user_id: int = Depends(current_user),
):
    """Update user settings."""
    # Validate exam_time_limit range (30-45 minutes = 1800-2700 seconds)
    if settings.exam_time_limit < 1800 or settings.exam_time_limit > 2700:
        raise HTTPException(400, "exam_time_limit must be between 1800 and 2700 seconds")

    # Validate language
    if settings.language not in ("en", "ru"):
        raise HTTPException(400, "Supported languages: en, ru")

    # Validate theme
    if settings.theme not in ("auto", "dark", "light"):
        raise HTTPException(400, "Theme must be: auto, dark, light")

    await db.execute("""
        INSERT INTO user_settings (user_id, marathon_auto_next, theme, haptic_feedback, exam_time_limit, language)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
            marathon_auto_next=$2, theme=$3, haptic_feedback=$4,
            exam_time_limit=$5, language=$6
    """, user_id, settings.marathon_auto_next, settings.theme,
        settings.haptic_feedback, settings.exam_time_limit, settings.language)

    return settings


@router.delete("/settings/clear-srs")
async def clear_srs(user_id: int = Depends(current_user)):
    """Clear all SRS (incorrect test) cards for the user."""
    await db.execute("DELETE FROM user_srs_cards WHERE user_id=$1", user_id)
    return {"status": "ok", "message": "SRS cards cleared"}


@router.delete("/settings/clear-all")
async def clear_all_data(user_id: int = Depends(current_user)):
    """Clear ALL user data: answers, sessions, SRS, bookmarks."""
    await db.execute("DELETE FROM user_answers WHERE session_id IN (SELECT id FROM test_sessions WHERE user_id=$1)", user_id)
    await db.execute("DELETE FROM test_sessions WHERE user_id=$1", user_id)
    await db.execute("DELETE FROM user_srs_cards WHERE user_id=$1", user_id)
    await db.execute("DELETE FROM user_bookmarks WHERE user_id=$1", user_id)
    return {"status": "ok", "message": "All user data cleared"}

