# app/routers/public.py
import uuid
from typing import List, Dict
from uuid import UUID
from fastapi import APIRouter, HTTPException, Path, Query, Request

from sqlalchemy import select, exists, and_, or_
from app.db.session import fetch_one, fetch_all
from app.db.models import (
    category as t_category,
    heading as t_heading,
    content as t_content,
    content_image as t_content_image,
)
from app.schemas import (
    ContentPublic,
    CategoryPublic as CategoryOut,
    HeadingPublic as HeadingOut,
    PageOut,
    MenuNode,
    ContentImageOut,
)

public_router = APIRouter(tags=["public"])

# ========== Helpers (EXISTS koşulları) ==========

def _exists_l1_has_content():
    h = t_heading.alias("h_l1c")
    ct = t_content.alias("ct_l1c")
    sub = (
        select(1)
        .select_from(h.join(ct, ct.c.heading_id == h.c.id))
        .where(and_(h.c.level == 1, h.c.category_id == t_category.c.id))
        .limit(1)
    )
    return exists(sub)

def _exists_any_l2_has_content():
    h1 = t_heading.alias("h1_c")
    l2 = t_heading.alias("l2_c")
    ct2 = t_content.alias("ct2_c")
    sub = (
        select(1)
        .select_from(
            h1.join(l2, l2.c.parent_heading_id == h1.c.id)
              .join(ct2, ct2.c.heading_id == l2.c.id)
        )
        .where(h1.c.category_id == t_category.c.id)
        .limit(1)
    )
    return exists(sub)

def _exists_l1_or_any_child_has_content_for_h(h_alias):
    ct1 = t_content.alias("ct_for_l1")
    l2 = t_heading.alias("l2_for_l1")
    ct2 = t_content.alias("ct2_for_l1")

    sub_l1 = (
        select(1)
        .select_from(ct1)
        .where(ct1.c.heading_id == h_alias.c.id)
        .limit(1)
    )
    sub_any_l2 = (
        select(1)
        .select_from(l2.join(ct2, ct2.c.heading_id == l2.c.id))
        .where(l2.c.parent_heading_id == h_alias.c.id)
        .limit(1)
    )
    return or_(exists(sub_l1), exists(sub_any_l2))

def _exists_l2_has_content_for_h(h_alias):
    ct = t_content.alias("ct_for_l2")
    sub = (
        select(1)
        .select_from(ct)
        .where(ct.c.heading_id == h_alias.c.id)
        .limit(1)
    )
    return exists(sub)

# ========== Endpoints ==========

@public_router.get("/categories", response_model=List[CategoryOut])
async def list_categories():
    stmt = (
        select(
            t_category.c.id, t_category.c.name, t_category.c.slug, t_category.c.sort_order
        )
        .where(or_(_exists_l1_has_content(), _exists_any_l2_has_content()))
        .distinct()
        .order_by(t_category.c.sort_order, t_category.c.name)
    )
    return await fetch_all(stmt)

@public_router.get("/categories/{category_slug}/headings", response_model=List[HeadingOut])
async def list_h1_headings(category_slug: str = Path(...)):
    cat_stmt = select(t_category.c.id).where(t_category.c.slug == category_slug)
    cat = await fetch_one(cat_stmt)
    if not cat:
        raise HTTPException(404, "Category not found")

    h = t_heading.alias("h_l1_list")
    stmt = (
        select(h.c.id, h.c.level, h.c.title, h.c.slug, h.c.sort_order)
        .where(
            and_(
                h.c.level == 1,
                h.c.category_id == cat["id"],
                _exists_l1_or_any_child_has_content_for_h(h),
            )
        )
        .order_by(h.c.sort_order, h.c.title)
    )
    return await fetch_all(stmt)

@public_router.get("/categories/{category_slug}/{h1_slug}/headings", response_model=List[HeadingOut])
async def list_h2_under_h1(category_slug: str, h1_slug: str):
    h1 = t_heading.alias("h1_for_l2")
    c = t_category.alias("c_for_l2")
    h1_stmt = (
        select(h1.c.id)
        .select_from(h1.join(c, h1.c.category_id == c.c.id))
        .where(and_(h1.c.level == 1, c.c.slug == category_slug, h1.c.slug == h1_slug))
        .limit(1)
    )
    h1_row = await fetch_one(h1_stmt)
    if not h1_row:
        raise HTTPException(404, "Level-1 heading not found")

    h = t_heading.alias("h_l2_list")
    stmt = (
        select(h.c.id, h.c.level, h.c.title, h.c.slug, h.c.sort_order)
        .where(
            and_(
                h.c.level == 2,
                h.c.parent_heading_id == h1_row["id"],
                _exists_l2_has_content_for_h(h),
            )
        )
        .order_by(h.c.sort_order, h.c.title)
    )
    return await fetch_all(stmt)

@public_router.get("/page/{category_slug}/{h1_slug}/{h2_slug}", response_model=PageOut)
async def get_page(category_slug: str, h1_slug: str, h2_slug: str):
    c = t_category.alias("c")
    h1 = t_heading.alias("h1")
    h2 = t_heading.alias("h2")
    ct = t_content.alias("ct")

    stmt = (
        select(
            c.c.slug.label("category"),
            h1.c.slug.label("h1"),
            h2.c.slug.label("h2"),
            h2.c.title.label("title"),
            ct.c.body.label("body"),
        )
        .select_from(
            c.join(h1, and_(h1.c.category_id == c.c.id, h1.c.level == 1))
             .join(h2, and_(h2.c.parent_heading_id == h1.c.id, h2.c.level == 2))
             .join(ct, ct.c.heading_id == h2.c.id)
        )
        .where(and_(c.c.slug == category_slug, h1.c.slug == h1_slug, h2.c.slug == h2_slug))
        .limit(1)
    )
    row = await fetch_one(stmt)
    if not row:
        raise HTTPException(404, "Page not found")
    return row

@public_router.get("/public/contents", response_model=List[ContentPublic])
async def list_public_contents(heading_id: UUID = Query(..., description="L1 veya L2 heading id")):
    ct = t_content.alias("ct")
    stmt = (
        select(ct.c.id, ct.c.heading_id, ct.c.body, ct.c.description)
        .where(ct.c.heading_id == heading_id)
        .order_by(ct.c.created_at.asc())
    )
    return await fetch_all(stmt)

# ---- Content Images (Public) ----

# ---- Content Images (Public) ----

def _abs_url(request: Request, url: str) -> str:
    """Return absolute URL suitable for current host (localhost/ngrok/prod).

    - If stored URL is absolute and points to localhost/127.0.0.1, rewrite to current host.
    - If stored URL is relative and starts with /static, prepend /api for Vite proxy consistency.
    - Otherwise, join with current base URL.
    """
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


@public_router.get("/contents/{id}/images", response_model=List[ContentImageOut])
async def list_images_by_content_id(id: uuid.UUID, request: Request):
    # content var mı kontrolü
    ct_stmt = select(t_content.c.id).where(t_content.c.id == id)
    ct_row = await fetch_one(ct_stmt)
    if not ct_row:
        raise HTTPException(404, "Content not found")

    stmt = (
        select(
            t_content_image.c.id,
            t_content_image.c.content_id,
            t_content_image.c.url,
            t_content_image.c.alt,
            t_content_image.c.sort_order,
            # yeni alanlar
            t_content_image.c.width,
            t_content_image.c.height,
            t_content_image.c.created_at,
            t_content_image.c.updated_at,
        )
        .where(t_content_image.c.content_id == id)
        .order_by(t_content_image.c.sort_order, t_content_image.c.created_at, t_content_image.c.id)
    )
    rows = await fetch_all(stmt)
    # RowMapping -> dict; url'leri güvenle dönüştür
    result = []
    for r in rows:
        d = dict(r)
        if d.get("url"):
            d["url"] = _abs_url(request, d["url"]) 
        result.append(d)
    return result


@public_router.get("/page/{category_slug}/{h1_slug}/{h2_slug}/images", response_model=List[ContentImageOut])
async def list_images_by_page(category_slug: str, h1_slug: str, h2_slug: str, request: Request):
    # h2 -> content id çöz
    c = t_category.alias("c_img")
    h1 = t_heading.alias("h1_img")
    h2 = t_heading.alias("h2_img")
    ct = t_content.alias("ct_img")

    ct_stmt = (
        select(ct.c.id)
        .select_from(
            c.join(h1, and_(h1.c.category_id == c.c.id, h1.c.level == 1))
             .join(h2, and_(h2.c.parent_heading_id == h1.c.id, h2.c.level == 2))
             .join(ct, ct.c.heading_id == h2.c.id)
        )
        .where(and_(c.c.slug == category_slug, h1.c.slug == h1_slug, h2.c.slug == h2_slug))
        .limit(1)
    )
    ct_row = await fetch_one(ct_stmt)
    if not ct_row:
        raise HTTPException(404, "Page not found")

    stmt = (
        select(
            t_content_image.c.id,
            t_content_image.c.content_id,
            t_content_image.c.url,
            t_content_image.c.alt,
            t_content_image.c.sort_order,
            # yeni alanlar
            t_content_image.c.width,
            t_content_image.c.height,
            t_content_image.c.created_at,
            t_content_image.c.updated_at,
        )
        .where(t_content_image.c.content_id == ct_row["id"])
        .order_by(t_content_image.c.sort_order, t_content_image.c.created_at, t_content_image.c.id)
    )
    rows = await fetch_all(stmt)
    result = []
    for r in rows:
        d = dict(r)
        if d.get("url"):
            d["url"] = _abs_url(request, d["url"]) 
        result.append(d)
    return result


@public_router.get("/menu", response_model=List[MenuNode])
async def menu():
    cats_stmt = (
        select(
            t_category.c.id, t_category.c.name, t_category.c.slug, t_category.c.sort_order
        )
        .where(or_(_exists_l1_has_content(), _exists_any_l2_has_content()))
        .distinct()
        .order_by(t_category.c.sort_order, t_category.c.name)
    )
    cats = await fetch_all(cats_stmt)

    h = t_heading.alias("h_vis")
    headings_stmt = (
        select(
            h.c.id, h.c.level, h.c.title, h.c.slug, h.c.sort_order,
            h.c.category_id, h.c.parent_heading_id
        )
        .where(
            or_(
                and_(h.c.level == 1, _exists_l1_or_any_child_has_content_for_h(h)),
                and_(h.c.level == 2, _exists_l2_has_content_for_h(h)),
            )
        )
        .order_by(h.c.sort_order, h.c.title)
    )
    headings = await fetch_all(headings_stmt)

    by_cat: Dict[uuid.UUID, List[dict]] = {c["id"]: [] for c in cats}
    h1_map: Dict[uuid.UUID, dict] = {}

    for h in headings:
        if h["level"] == 1 and h["category_id"] in by_cat:
            node = {"id": h["id"], "title": h["title"], "slug": h["slug"],
                    "sort_order": h["sort_order"], "children": []}
            by_cat[h["category_id"]].append(node)
            h1_map[h["id"]] = node

    for h in headings:
        if h["level"] == 2 and h["parent_heading_id"] in h1_map:
            node = {"id": h["id"], "title": h["title"], "slug": h["slug"],
                    "sort_order": h["sort_order"], "children": []}
            h1_map[h["parent_heading_id"]]["children"].append(node)

    menu_all: List[MenuNode] = []
    for c in cats:
        menu_all.extend(sorted(by_cat[c["id"]], key=lambda n: (n["sort_order"], n["title"])))
    return menu_all

@public_router.get("/search", response_model=List[dict])
async def search(q: str = Query(..., min_length=2), limit: int = Query(20, ge=1, le=100)):
    return await fetch_all(
        """
        (
          SELECT 'category'::text AS source_type, c.id AS source_id,
                 c.name AS matched_text, similarity(c.name::text, :q) AS similarity_score,
                 NULL::text AS context
          FROM category c
          WHERE
            (
              EXISTS (SELECT 1 FROM heading h JOIN content ct ON ct.heading_id = h.id
                      WHERE h.level = 1 AND h.category_id = c.id)
              OR EXISTS (SELECT 1 FROM heading h1
                         JOIN heading l2 ON l2.parent_heading_id = h1.id
                         JOIN content ct2 ON ct2.heading_id = l2.id
                         WHERE h1.category_id = c.id)
            )
            AND (c.name ILIKE '%' || :q || '%' OR c.description ILIKE '%' || :q || '%')
        )
        UNION ALL
        (
          SELECT 'heading'::text AS source_type, h.id AS source_id, h.title AS matched_text,
                 similarity(h.title::text, :q) AS similarity_score,
                 COALESCE(h.description, '') AS context
          FROM heading h
          WHERE
            (
              (h.level = 1 AND (
                EXISTS (SELECT 1 FROM content ct WHERE ct.heading_id = h.id)
                OR EXISTS (SELECT 1 FROM heading l2 JOIN content ct2 ON ct2.heading_id = l2.id
                           WHERE l2.parent_heading_id = h.id)
              ))
              OR
              (h.level = 2 AND EXISTS (SELECT 1 FROM content ct WHERE ct.heading_id = h.id))
            )
            AND (h.title ILIKE '%' || :q || '%' OR h.description ILIKE '%' || :q || '%')
        )
        UNION ALL
        (
          SELECT 'content'::text AS source_type, ct.id AS source_id,
                 CASE WHEN length(ct.body) > 200 THEN substring(ct.body FROM 1 FOR 200) || '…' ELSE ct.body END AS matched_text,
                 similarity(ct.body, :q) AS similarity_score,
                 CASE 
                   WHEN position(lower(:q) in lower(ct.body)) > 0 THEN 
                     substring(ct.body from GREATEST(position(lower(:q) in lower(ct.body)) - 60, 1) for 160)
                   ELSE substring(ct.body from 1 for 160)
                 END AS context
          FROM content ct
          WHERE (ct.body ILIKE '%' || :q || '%' OR ct.description ILIKE '%' || :q || '%')
        )
        ORDER BY similarity_score DESC
        LIMIT :limit
        """,
        {"q": q, "limit": limit},
    )
