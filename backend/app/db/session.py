#  backend/app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import DATABASE_URL

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    future=True
)

async def fetch_one(query, params: dict | None = None):
    async with engine.connect() as conn:
        if isinstance(query, str):
            res = await conn.execute(text(query), params or {})
        else:
            res = await conn.execute(query)
        return res.mappings().first()

async def fetch_all(query, params: dict | None = None):
    async with engine.connect() as conn:
        if isinstance(query, str):
            res = await conn.execute(text(query), params or {})
        else:
            res = await conn.execute(query)
        return res.mappings().all()

async def execute(query, params: dict | None = None):
    async with engine.begin() as conn:
        if isinstance(query, str):
            res = await conn.execute(text(query), params or {})
        else:
            res = await conn.execute(query)
        try:
            return res.mappings().all()  # RETURNING kullanan sorgular için
        except Exception:
            return None
