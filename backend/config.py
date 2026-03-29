"""
Configuration — loads environment variables.
"""
import os


class Config:
    BOT_TOKEN: str = os.environ.get("BOT_TOKEN", "")
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "")
    WEBAPP_URL: str = os.environ.get("WEBAPP_URL", "")
    JWT_SECRET: str = os.environ.get("JWT_SECRET", BOT_TOKEN)  # use bot token as JWT secret
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24


config = Config()
