"""
Authentication — Telegram initData validation + JWT.

Telegram WebApp initData validation:
  https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
import hmac
import hashlib
import json
import time
from urllib.parse import parse_qs, unquote
from datetime import datetime, timedelta, timezone

import jwt
from config import config


def validate_init_data(init_data: str, bot_token: str | None = None) -> dict:
    """
    Validate Telegram WebApp initData and return the user dict.
    Raises ValueError if validation fails.
    """
    token = bot_token or config.BOT_TOKEN
    if not token:
        raise ValueError("BOT_TOKEN not configured")

    # Parse the init_data query string
    parsed = parse_qs(init_data)

    # Extract hash
    received_hash = parsed.get("hash", [None])[0]
    if not received_hash:
        raise ValueError("Missing hash in initData")

    # Build data-check-string (sorted key=value pairs, excluding hash)
    data_check_parts = []
    for key in sorted(parsed.keys()):
        if key == "hash":
            continue
        value = parsed[key][0]
        data_check_parts.append(f"{key}={value}")
    data_check_string = "\n".join(data_check_parts)

    # Compute HMAC
    secret_key = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise ValueError("Invalid initData signature")

    # Check auth_date is not too old (allow 24 hours)
    auth_date_str = parsed.get("auth_date", [None])[0]
    if auth_date_str:
        auth_date = int(auth_date_str)
        if time.time() - auth_date > 86400:
            raise ValueError("initData is too old (>24h)")

    # Parse user data
    user_str = parsed.get("user", [None])[0]
    if not user_str:
        raise ValueError("Missing user in initData")

    user = json.loads(unquote(user_str))
    return user


def create_jwt(user_id: int, db_user_id: int, secret: str | None = None) -> str:
    """Create a JWT token for the authenticated user."""
    payload = {
        "user_id": db_user_id,
        "telegram_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, secret or config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_jwt(token: str, secret: str | None = None) -> dict:
    """Decode and verify a JWT token. Raises jwt.InvalidTokenError on failure."""
    return jwt.decode(
        token,
        secret or config.JWT_SECRET,
        algorithms=[config.JWT_ALGORITHM],
    )


async def get_current_user_id(authorization: str) -> int:
    """
    Extract db user_id from Authorization header.
    Raises ValueError on invalid token.
    """
    if not authorization.startswith("Bearer "):
        raise ValueError("Invalid authorization header")
    token = authorization[7:]
    payload = decode_jwt(token)
    return payload["user_id"]
