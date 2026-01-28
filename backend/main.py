from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import (
    APP_TITLE, APP_VERSION, FRONTEND_ORIGIN,
    STATIC_MOUNT_PATH, ABS_UPLOADS_DIR
)
from app.db.session import fetch_one
from app.routers.admin import admin_router
from app.routers.public import public_router

app = FastAPI(title=APP_TITLE, version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static mount: /static and /api/static -> ABS_UPLOADS_DIR ---
Path(ABS_UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
app.mount(STATIC_MOUNT_PATH, StaticFiles(directory=ABS_UPLOADS_DIR), name="static")
app.mount("/api" + STATIC_MOUNT_PATH, StaticFiles(directory=ABS_UPLOADS_DIR), name="api-static")

app.include_router(admin_router)
app.include_router(public_router)

@app.get("/healthz", tags=["meta"])
async def healthz():
    try:
        row = await fetch_one("SELECT 1 AS ok")
        return {"ok": bool(row)}
    except Exception as e:
        raise HTTPException(500, f"DB error: {e}")
