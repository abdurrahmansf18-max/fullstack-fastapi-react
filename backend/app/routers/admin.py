# app/routers/admin.py
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, insert, update, delete, func
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import pwd_context, create_access_token, get_current_admin
from app.db.session import fetch_one, fetch_all, execute
from app.db.models import admin_user as t_admin, category as t_category, heading as t_heading, content as t_content, content_image as t_content_image
from app.schemas import (
    TokenOut, AdminInitIn, AdminCreateIn, AdminOut, AdminPasswordIn,
    CategoryCreate, CategoryUpdate, CategoryOut,
    HeadingCreate, HeadingUpdate, HeadingOut,
    ContentCreate, ContentUpdate, ContentOut,
    ContentImageCreate, ContentImageUpdate, ContentImageOut,
    SearchResult,
)
from fastapi import File, UploadFile, Form
from app.core.storage import LocalStorage
from app.core.config import settings
from urllib.parse import urlparse
from pathlib import Path


admin_router = APIRouter(prefix="/admin", tags=["admin"])
storage = LocalStorage()  # env'den UPLOADS_DIR + STATIC_BASE_URL alır
# ---- URL helper (absolute for current host) ----
def _abs_url(request: Request, url: str) -> str:
    try:
        if url.startswith("http://") or url.startswith("https://"):
            from urllib.parse import urlparse
            parsed = urlparse(url)
            if parsed.hostname in {"localhost", "127.0.0.1"}:
                base = str(request.base_url).rstrip("/")
                path = parsed.path
                if path.startswith("/static/"):
                    return f"{base}/api{path}"
                return f"{base}{path}"
            return url
    except Exception:
        return url

    base = str(request.base_url).rstrip("/")
    if url.startswith("/static/"):
        return f"{base}/api{url}"
    if not url.startswith("/"):
        url = "/" + url
    return f"{base}{url}"

# ---- Auth & Admin Users ----
@admin_router.post("/init", response_model=AdminOut)
async def bootstrap_admin(payload: AdminInitIn):
    # SELECT COUNT(*) AS c FROM admin_user
    stmt_count = select(func.count().label("c")).select_from(t_admin)
    count_row = await fetch_one(stmt_count)
    if count_row["c"] > 0:
        raise HTTPException(status_code=403, detail="Init only allowed when there is no admin.")

    phash = pwd_context.hash(payload.password)
    stmt_ins = (
        insert(t_admin)
        .values(email=payload.email, password_hash=phash)
        .returning(t_admin.c.id, t_admin.c.email, t_admin.c.created_at)
    )
    rows = await execute(stmt_ins)
    return rows[0]

@admin_router.post("/login", response_model=TokenOut)
async def admin_login(form_data: OAuth2PasswordRequestForm = Depends()):
    stmt = select(
        t_admin.c.id, t_admin.c.email, t_admin.c.password_hash
    ).where(t_admin.c.email == form_data.username)

    row = await fetch_one(stmt)
    if not row or not pwd_context.verify(form_data.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    token = create_access_token({"uid": str(row["id"]), "sub": row["email"]})
    return {"access_token": token, "token_type": "bearer"}

@admin_router.get("/me", response_model=AdminOut)
async def me(current=Depends(get_current_admin)):
    stmt = select(t_admin.c.id, t_admin.c.email, t_admin.c.created_at).where(t_admin.c.id == uuid.UUID(current["id"]))
    row = await fetch_one(stmt)
    return row

@admin_router.post("/users", response_model=AdminOut, status_code=201)
async def create_admin_user(payload: AdminCreateIn, _=Depends(get_current_admin)):
    phash = pwd_context.hash(payload.password)
    try:
        stmt = (
            insert(t_admin)
            .values(email=payload.email, password_hash=phash, created_at=func.now(), updated_at=func.now())
            .returning(t_admin.c.id, t_admin.c.email, t_admin.c.created_at)
        )
        rows = await execute(stmt)
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail="Email already exists") from e
    return rows[0]

@admin_router.get("/users", response_model=List[AdminOut])
async def list_admin_users(_=Depends(get_current_admin)):
    stmt = select(t_admin.c.id, t_admin.c.email, t_admin.c.created_at).order_by(t_admin.c.created_at)
    return await fetch_all(stmt)

@admin_router.delete("/users/{admin_id}", status_code=204)
async def delete_admin_user(admin_id: uuid.UUID, _=Depends(get_current_admin)):
    # Son admin'i silmeyi engelle
    stmt_count = select(func.count().label("c")).select_from(t_admin)
    cnt = await fetch_one(stmt_count)
    if cnt and cnt["c"] <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last admin.")

    stmt = delete(t_admin).where(t_admin.c.id == admin_id).returning(t_admin.c.id)
    rows = await execute(stmt)
    if not rows:
        raise HTTPException(404, "Admin not found")
    return

@admin_router.patch("/users/{admin_id}/password", status_code=204)
async def change_admin_password(admin_id: uuid.UUID, p: AdminPasswordIn, _=Depends(get_current_admin)):
    phash = pwd_context.hash(p.password)
    stmt = (
        update(t_admin)
        .where(t_admin.c.id == admin_id)
        .values(password_hash=phash, updated_at=func.now())
        .returning(t_admin.c.id)
    )
    await execute(stmt)
    return

# ---- Category CRUD ----
@admin_router.post("/categories", response_model=CategoryOut)
async def create_category(payload: CategoryCreate, _=Depends(get_current_admin)):
    try:
        stmt = (
            insert(t_category)
            .values(name=payload.name, description=payload.description, sort_order=payload.sort_order or 0)
            .returning(
                t_category.c.id, t_category.c.name, t_category.c.slug, t_category.c.description,
                t_category.c.sort_order, t_category.c.created_at, t_category.c.updated_at
            )
        )
        rows = await execute(stmt)
        return rows[0]
    except IntegrityError:
        # Aynı isim/slug için benzersiz kısıt hatasını kullanıcıya anlaşılır şekilde ilet
        raise HTTPException(status_code=409, detail="Bu isimde bir kategori zaten var")

@admin_router.get("/categories", response_model=List[CategoryOut])
async def list_categories(_=Depends(get_current_admin)):
    stmt = (
        select(
            t_category.c.id, t_category.c.name, t_category.c.slug, t_category.c.description,
            t_category.c.sort_order, t_category.c.created_at, t_category.c.updated_at
        )
        .order_by(t_category.c.sort_order, t_category.c.name)
    )
    return await fetch_all(stmt)

@admin_router.get("/categories/{id}", response_model=CategoryOut)
async def get_category(id: uuid.UUID, _=Depends(get_current_admin)):
    stmt = (
        select(
            t_category.c.id, t_category.c.name, t_category.c.slug, t_category.c.description,
            t_category.c.sort_order, t_category.c.created_at, t_category.c.updated_at
        )
        .where(t_category.c.id == id)
    )
    row = await fetch_one(stmt)
    if not row:
        raise HTTPException(404, "Category not found")
    return row

@admin_router.put("/categories/{id}", response_model=CategoryOut)
async def update_category(id: uuid.UUID, payload: CategoryUpdate, _=Depends(get_current_admin)):
    data = payload.model_dump(exclude_unset=True)
    stmt = (
        update(t_category)
        .where(t_category.c.id == id)
        .values(**data)
        .returning(
            t_category.c.id, t_category.c.name, t_category.c.slug, t_category.c.description,
            t_category.c.sort_order, t_category.c.created_at, t_category.c.updated_at
        )
    )
    rows = await execute(stmt)
    if not rows:
        raise HTTPException(404, "Category not found")
    return rows[0]

@admin_router.delete("/categories/{id}", status_code=204)
async def delete_category(id: uuid.UUID, _=Depends(get_current_admin)):
    stmt = delete(t_category).where(t_category.c.id == id).returning(t_category.c.id)
    rows = await execute(stmt)
    if not rows:
        raise HTTPException(404, "Category not found")
    return

# ---- Heading CRUD ----
@admin_router.post("/headings", response_model=HeadingOut)
async def create_heading(payload: HeadingCreate, _=Depends(get_current_admin)):
    stmt = (
        insert(t_heading)
        .values(
            level=payload.level,
            category_id=payload.category_id,
            parent_heading_id=payload.parent_heading_id,
            title=payload.title,
            description=payload.description,
            sort_order=payload.sort_order or 0,
        )
        .returning(
            t_heading.c.id, t_heading.c.level, t_heading.c.category_id, t_heading.c.parent_heading_id,
            t_heading.c.title, t_heading.c.slug, t_heading.c.description, t_heading.c.sort_order,
            t_heading.c.created_at, t_heading.c.updated_at
        )
    )
    rows = await execute(stmt)
    return rows[0]

@admin_router.get("/headings", response_model=List[HeadingOut])
async def list_headings(
    level: Optional[int] = Query(None),
    category_id: Optional[uuid.UUID] = Query(None),
    parent_heading_id: Optional[uuid.UUID] = Query(None),
    _=Depends(get_current_admin),
):
    stmt = select(
        t_heading.c.id, t_heading.c.level, t_heading.c.category_id, t_heading.c.parent_heading_id,
        t_heading.c.title, t_heading.c.slug, t_heading.c.description, t_heading.c.sort_order,
        t_heading.c.created_at, t_heading.c.updated_at
    )

    # Dinamik filtreler
    conditions = []
    if level is not None:
        conditions.append(t_heading.c.level == level)
    if category_id is not None:
        conditions.append(t_heading.c.category_id == category_id)
    if parent_heading_id is not None:
        conditions.append(t_heading.c.parent_heading_id == parent_heading_id)
    if conditions:
        stmt = stmt.where(*conditions)

    stmt = stmt.order_by(t_heading.c.sort_order, t_heading.c.title)
    return await fetch_all(stmt)

@admin_router.get("/headings/{id}", response_model=HeadingOut)
async def get_heading(id: uuid.UUID, _=Depends(get_current_admin)):
    stmt = select(
        t_heading.c.id, t_heading.c.level, t_heading.c.category_id, t_heading.c.parent_heading_id,
        t_heading.c.title, t_heading.c.slug, t_heading.c.description, t_heading.c.sort_order,
        t_heading.c.created_at, t_heading.c.updated_at
    ).where(t_heading.c.id == id)
    row = await fetch_one(stmt)
    if not row:
        raise HTTPException(404, "Heading not found")
    return row

@admin_router.put("/headings/{id}", response_model=HeadingOut)
async def update_heading(id: uuid.UUID, payload: HeadingUpdate, _=Depends(get_current_admin)):
    data = payload.model_dump(exclude_unset=True)
    stmt = (
        update(t_heading)
        .where(t_heading.c.id == id)
        .values(**data)
        .returning(
            t_heading.c.id, t_heading.c.level, t_heading.c.category_id, t_heading.c.parent_heading_id,
            t_heading.c.title, t_heading.c.slug, t_heading.c.description, t_heading.c.sort_order,
            t_heading.c.created_at, t_heading.c.updated_at
        )
    )
    rows = await execute(stmt)
    if not rows:
        raise HTTPException(404, "Heading not found")
    return rows[0]

@admin_router.delete("/headings/{id}", status_code=204)
async def delete_heading(id: uuid.UUID, _=Depends(get_current_admin)):
    stmt = delete(t_heading).where(t_heading.c.id == id).returning(t_heading.c.id)
    rows = await execute(stmt)
    if not rows:
        raise HTTPException(404, "Heading not found")
    return

# ---- Content CRUD ----
@admin_router.post("/contents", response_model=ContentOut)
async def create_content(payload: ContentCreate, _=Depends(get_current_admin)):
    # heading başına tek içerik kuralı - var mı?
    stmt_exists = select(t_content.c.id).where(t_content.c.heading_id == payload.heading_id)
    exists = await fetch_one(stmt_exists)
    if exists:
        raise HTTPException(status_code=409, detail="This heading already has content.")

    stmt = (
        insert(t_content)
        .values(heading_id=payload.heading_id, body=payload.body, description=payload.description)
        .returning(
            t_content.c.id, t_content.c.heading_id, t_content.c.body, t_content.c.description,
            t_content.c.created_at, t_content.c.updated_at
        )
    )
    rows = await execute(stmt)
    return rows[0]

@admin_router.get("/contents", response_model=List[ContentOut])
async def list_contents(heading_id: Optional[uuid.UUID] = Query(None), _=Depends(get_current_admin)):
    stmt = select(
        t_content.c.id, t_content.c.heading_id, t_content.c.body, t_content.c.description,
        t_content.c.created_at, t_content.c.updated_at
    )
    if heading_id:
        stmt = stmt.where(t_content.c.heading_id == heading_id)
    stmt = stmt.order_by(t_content.c.created_at.desc())
    return await fetch_all(stmt)

@admin_router.get("/contents/{id}", response_model=ContentOut)
async def get_content(id: uuid.UUID, _=Depends(get_current_admin)):
    stmt = select(
        t_content.c.id, t_content.c.heading_id, t_content.c.body, t_content.c.description,
        t_content.c.created_at, t_content.c.updated_at
    ).where(t_content.c.id == id)
    row = await fetch_one(stmt)
    if not row:
        raise HTTPException(404, "Content not found")
    return row

@admin_router.put("/contents/{id}", response_model=ContentOut)
async def update_content(id: uuid.UUID, payload: ContentUpdate, _=Depends(get_current_admin)):
    data = payload.model_dump(exclude_unset=True)
    stmt = (
        update(t_content)
        .where(t_content.c.id == id)
        .values(**data)
        .returning(
            t_content.c.id, t_content.c.heading_id, t_content.c.body, t_content.c.description,
            t_content.c.created_at, t_content.c.updated_at
        )
    )
    rows = await execute(stmt)
    if not rows:
        raise HTTPException(404, "Content not found")
    return rows[0]

@admin_router.delete("/contents/{id}", status_code=204)
async def delete_content(id: uuid.UUID, _=Depends(get_current_admin)):
    stmt = delete(t_content).where(t_content.c.id == id).returning(t_content.c.id)
    rows = await execute(stmt)
    if not rows:
        raise HTTPException(404, "Content not found")
    return

# ---- Content Image CRUD ----
@admin_router.post("/content-images", response_model=ContentImageOut)
async def create_content_image(payload: ContentImageCreate, _=Depends(get_current_admin)):
    stmt = (
        insert(t_content_image)
        .values(
            content_id=payload.content_id,
            url=payload.url,
            alt=payload.alt or "",
            sort_order=payload.sort_order or 0,
            width=payload.width or 0,
            height=payload.height or 0,
        )
        .returning(
            t_content_image.c.id,
            t_content_image.c.content_id,
            t_content_image.c.url,
            t_content_image.c.alt,
            t_content_image.c.sort_order,
            t_content_image.c.width,
            t_content_image.c.height,
            t_content_image.c.created_at,
            t_content_image.c.updated_at,
        )
    )
    rows = await execute(stmt)
    return rows[0]

@admin_router.get("/content-images", response_model=List[ContentImageOut])
async def list_content_images(
    request: Request,
    content_id: Optional[uuid.UUID] = Query(None),
    _=Depends(get_current_admin),
):
    stmt = select(
        t_content_image.c.id, t_content_image.c.content_id, t_content_image.c.url,
        t_content_image.c.alt, t_content_image.c.sort_order,
        t_content_image.c.width, t_content_image.c.height,
        t_content_image.c.created_at, t_content_image.c.updated_at
    )
    if content_id:
        stmt = stmt.where(t_content_image.c.content_id == content_id)
    stmt = stmt.order_by(t_content_image.c.sort_order, t_content_image.c.created_at)
    rows = await fetch_all(stmt)
    # Görseller admin panelinde doğru domain ile görünsün
    result = []
    for r in rows:
        d = dict(r)
        if d.get("url"):
            d["url"] = _abs_url(request, d["url"]) 
        result.append(d)
    return result

@admin_router.get("/content-images/{id}", response_model=ContentImageOut)
async def get_content_image(id: uuid.UUID, request: Request, _=Depends(get_current_admin)):
    stmt = select(
        t_content_image.c.id, t_content_image.c.content_id, t_content_image.c.url,
        t_content_image.c.alt, t_content_image.c.sort_order,
        t_content_image.c.width, t_content_image.c.height,
        t_content_image.c.created_at, t_content_image.c.updated_at
    ).where(t_content_image.c.id == id)
    row = await fetch_one(stmt)
    if not row:
        raise HTTPException(404, "Content image not found")
    d = dict(row)
    if d.get("url"):
        d["url"] = _abs_url(request, d["url"]) 
    return d

@admin_router.put("/content-images/{id}", response_model=ContentImageOut)
async def update_content_image(id: uuid.UUID, payload: ContentImageUpdate, _=Depends(get_current_admin)):
    data = payload.model_dump(exclude_unset=True)
    stmt = (
        update(t_content_image)
        .where(t_content_image.c.id == id)
        .values(**data)
        .returning(
            t_content_image.c.id, t_content_image.c.content_id, t_content_image.c.url,
            t_content_image.c.alt, t_content_image.c.sort_order,
            t_content_image.c.width, t_content_image.c.height,
            t_content_image.c.created_at, t_content_image.c.updated_at
        )
    )
    rows = await execute(stmt)
    if not rows:
        raise HTTPException(404, "Content image not found")
    return rows[0]

@admin_router.post("/content-images/upload", response_model=ContentImageOut, status_code=201)
async def upload_content_image(
    content_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    alt: Optional[str] = Form(None),
    sort_order: Optional[int] = Form(0),
    width: Optional[int] = Form(0),    # <-- yeni
    height: Optional[int] = Form(0),   # <-- yeni
    _=Depends(get_current_admin),
):
    # (opsiyonel) content_id var mı doğrula
    exists = await fetch_one(select(t_content.c.id).where(t_content.c.id == content_id))
    if not exists:
        raise HTTPException(status_code=404, detail="Content not found")

    try:
        _, public_url = await storage.save_image(file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    stmt = (
        insert(t_content_image)
        .values(
            content_id=content_id,
            url=public_url,                 # TAM URL
            alt=alt or "",
            sort_order=sort_order or 0,
            width=width or 0,               # <-- eklendi
            height=height or 0,             # <-- eklendi
        )
        .returning(
            t_content_image.c.id,
            t_content_image.c.content_id,
            t_content_image.c.url,
            t_content_image.c.alt,
            t_content_image.c.sort_order,
            t_content_image.c.width,        # <-- eklendi
            t_content_image.c.height,       # <-- eklendi
            t_content_image.c.created_at,
            t_content_image.c.updated_at,
        )
    )
    rows = await execute(stmt)
    return rows[0]

@admin_router.delete("/content-images/{id}", status_code=204)
async def delete_content_image(id: uuid.UUID, _=Depends(get_current_admin)):
    row = await fetch_one(
        select(t_content_image.c.id, t_content_image.c.url).where(t_content_image.c.id == id)
    )
    if not row:
        raise HTTPException(404, "Content image not found")

    del_rows = await execute(
        delete(t_content_image).where(t_content_image.c.id == id).returning(t_content_image.c.id)
    )
    if not del_rows:
        raise HTTPException(404, "Content image not found")

    # URL'den dosya adını al ve uploads'tan sil
    parsed = urlparse(row["url"])
    fname = Path(parsed.path).name
    fpath = Path(settings.UPLOADS_DIR) / fname
    try:
        fpath.unlink(missing_ok=True)
    except Exception:
        pass
    return


# ---- Admin Search (TRGM) ----
@admin_router.get("/search", response_model=List[SearchResult])
async def admin_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(50, ge=1, le=200),
    _=Depends(get_current_admin),
):
    # SQL fonksiyonu: Core ile tanımlamak yerine string çağırmak en pratik
    return await fetch_all("SELECT * FROM search_all_trgm(:q, :limit)", {"q": q, "limit": limit})
