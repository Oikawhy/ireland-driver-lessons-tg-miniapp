"""
Database — asyncpg connection pool and query helpers.
"""
import asyncpg
from config import config

pool: asyncpg.Pool | None = None


async def init_pool(dsn: str | None = None):
    """Initialize the connection pool."""
    global pool
    pool = await asyncpg.create_pool(
        dsn or config.DATABASE_URL,
        min_size=2,
        max_size=10,
    )
    return pool


async def close_pool():
    """Close the connection pool."""
    global pool
    if pool:
        await pool.close()
        pool = None


async def fetch(query: str, *args):
    """Fetch multiple rows."""
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def fetchrow(query: str, *args):
    """Fetch a single row."""
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetchval(query: str, *args):
    """Fetch a single value."""
    async with pool.acquire() as conn:
        return await conn.fetchval(query, *args)


async def execute(query: str, *args):
    """Execute a query (INSERT/UPDATE/DELETE)."""
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)
