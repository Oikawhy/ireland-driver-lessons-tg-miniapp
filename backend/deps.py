"""
Dependencies — shared FastAPI dependencies.
"""
from fastapi import Header, HTTPException
from auth import get_current_user_id


async def current_user(authorization: str = Header(default="")):
    """FastAPI dependency: extract user_id from JWT in Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user_id = await get_current_user_id(authorization)
        return user_id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
