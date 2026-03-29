"""
Ireland Driver Test — FastAPI Backend

Main application entry point:
  - Initializes DB pool on startup
  - Registers Telegram bot menu button
  - Includes all API routers
  - Serves question images as static files
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from telegram import Bot, MenuButtonWebApp, WebAppInfo

from config import config
from database import init_pool, close_pool
from auth import validate_init_data, create_jwt
from deps import current_user
from models import AuthRequest, AuthResponse
import database as db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    await init_pool()
    print("✅ Database pool initialized")

    # Register Telegram bot menu button
    if config.BOT_TOKEN and config.WEBAPP_URL:
        try:
            bot = Bot(token=config.BOT_TOKEN)
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="📝 Theory Test",
                    web_app=WebAppInfo(url=config.WEBAPP_URL),
                )
            )
            print(f"✅ Bot menu button registered → {config.WEBAPP_URL}")
        except Exception as e:
            print(f"⚠ Bot menu button registration failed: {e}")

    yield

    # Shutdown
    await close_pool()
    print("✅ Database pool closed")


app = FastAPI(
    title="Ireland Driver Test API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Telegram WebApp origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Telegram WebApp runs from various origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve question images
images_dir = os.path.join(os.path.dirname(__file__), "images")
if os.path.isdir(images_dir):
    app.mount("/images", StaticFiles(directory=images_dir), name="images")


# ─── Auth endpoint ───────────────────────────────────

@app.post("/api/auth", response_model=AuthResponse)
async def auth(request: AuthRequest):
    """Validate Telegram initData and return JWT."""
    try:
        tg_user = validate_init_data(request.init_data)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    telegram_id = tg_user["id"]
    username = tg_user.get("username")
    first_name = tg_user.get("first_name")

    # Upsert user
    row = await db.fetchrow(
        """INSERT INTO users (telegram_id, username, first_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (telegram_id) DO UPDATE SET username=$2, first_name=$3
           RETURNING id""",
        telegram_id, username, first_name,
    )
    db_user_id = row["id"]

    # Ensure user_settings row exists
    await db.execute(
        "INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
        db_user_id,
    )

    token = create_jwt(user_id=telegram_id, db_user_id=db_user_id)

    return AuthResponse(
        token=token,
        user_id=db_user_id,
        telegram_id=telegram_id,
        first_name=first_name,
    )


# ─── Health check ────────────────────────────────────

@app.get("/api/health")
async def health():
    count = await db.fetchval("SELECT COUNT(*) FROM questions")
    return {"status": "ok", "questions": count}


# ─── Register routers ────────────────────────────────

from routers import questions, sessions, stats, settings, bookmarks

app.include_router(questions.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(bookmarks.router, prefix="/api")
