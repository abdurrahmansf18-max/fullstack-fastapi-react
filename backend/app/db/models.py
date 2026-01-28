# app/db/models.py
from sqlalchemy import (
    MetaData, Table, Column, CheckConstraint, ForeignKey,
    Text, Integer, SmallInteger
)
from sqlalchemy.dialects.postgresql import UUID, CITEXT, TIMESTAMP
from sqlalchemy.sql import func, text
from sqlalchemy.schema import Index

metadata = MetaData()

# ==============
# Tables
# ==============

admin_user = Table(
    "admin_user", metadata,
    Column("id", UUID(as_uuid=True), primary_key=True,
           server_default=text("gen_random_uuid()")),
    Column("email", CITEXT, nullable=False, unique=True),
    Column("password_hash", Text, nullable=False),
    Column("last_login_at", TIMESTAMP(timezone=True)),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
)

category = Table(
    "category", metadata,
    Column("id", UUID(as_uuid=True), primary_key=True,
           server_default=text("gen_random_uuid()")),
    Column("name", CITEXT, nullable=False, unique=True),
    Column("description", Text),
    Column("slug", Text, nullable=False),
    Column("sort_order", Integer, nullable=False, server_default=text("0")),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("btrim(name::text) <> ''", name="category_name_not_blank"),
    CheckConstraint("slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'", name="category_slug_format_ck"),
)

heading = Table(
    "heading", metadata,
    Column("id", UUID(as_uuid=True), primary_key=True,
           server_default=text("gen_random_uuid()")),
    Column("category_id", UUID(as_uuid=True), ForeignKey("category.id", ondelete="CASCADE")),
    Column("parent_heading_id", UUID(as_uuid=True), ForeignKey("heading.id", ondelete="CASCADE")),
    Column("level", SmallInteger, nullable=False),
    Column("title", CITEXT, nullable=False),
    Column("description", Text),
    Column("slug", Text, nullable=False),
    Column("sort_order", Integer, nullable=False, server_default=text("0")),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("btrim(title::text) <> ''", name="heading_title_not_blank"),
    CheckConstraint(
        "((level = 1 AND category_id IS NOT NULL AND parent_heading_id IS NULL) OR "
        "(level = 2 AND parent_heading_id IS NOT NULL AND category_id IS NULL))",
        name="heading_level_parent_ck",
    ),
)

content = Table(
    "content", metadata,
    Column("id", UUID(as_uuid=True), primary_key=True,
           server_default=text("gen_random_uuid()")),
    Column("heading_id", UUID(as_uuid=True), ForeignKey("heading.id", ondelete="CASCADE"),
           nullable=False, unique=True),
    Column("body", Text, nullable=False),
    Column("description", Text),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
)

# EKSİK OLAN TABLO: content_image
content_image = Table(
    "content_image", metadata,
    Column("id", UUID(as_uuid=True), primary_key=True,
           server_default=text("gen_random_uuid()")),
    Column("content_id", UUID(as_uuid=True), ForeignKey("content.id", ondelete="CASCADE"), nullable=False),
    Column("url", Text, nullable=False),
    Column("alt", Text, nullable=False, server_default=text("''")),
    Column("sort_order", Integer, nullable=False, server_default=text("0")),
    Column("width", Integer, nullable=False, server_default=text("0")),   # yeni eklendi
    Column("height", Integer, nullable=False, server_default=text("0")),  # yeni eklendi
    Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("btrim(url) <> '' AND url ~ '^(https?://|/|s3://)'", name="content_image_url_ck"),
)

# ==============
# Indexes (DDL ile aynı)
# ==============

# Slug benzersizlikleri
Index("uq_category_slug", category.c.slug, unique=True)

Index(
    "uq_heading_level1_slug",
    heading.c.category_id, heading.c.slug,
    unique=True,
    postgresql_where=(heading.c.level == 1),
)

Index(
    "uq_heading_level2_slug",
    heading.c.parent_heading_id, heading.c.slug,
    unique=True,
    postgresql_where=(heading.c.level == 2),
)

# FK ve listeleme hızlandırma
Index("idx_heading_category_l1", heading.c.category_id, postgresql_where=(heading.c.level == 1))
Index("idx_heading_parent_l2", heading.c.parent_heading_id, postgresql_where=(heading.c.level == 2))
Index(
    "idx_heading_l1_sort",
    heading.c.category_id, heading.c.sort_order, heading.c.id,
    postgresql_where=(heading.c.level == 1),
)
Index(
    "idx_heading_l2_sort",
    heading.c.parent_heading_id, heading.c.sort_order, heading.c.id,
    postgresql_where=(heading.c.level == 2),
)

# Content Image Indexleri
Index(
    "idx_content_image_order",
    content_image.c.content_id, content_image.c.sort_order, content_image.c.id
)
Index(
    "uq_content_image_sort",
    content_image.c.content_id, content_image.c.sort_order,
    unique=True
)

# TRGM arama index'leri (pg_trgm yüklü olmalı)
Index(
    "idx_category_name_trgm",
    category.c.name,
    postgresql_using="gin",
    postgresql_ops={category.c.name.key: "gin_trgm_ops"},
)
Index(
    "idx_category_desc_trgm",
    category.c.description,
    postgresql_using="gin",
    postgresql_ops={category.c.description.key: "gin_trgm_ops"},
)
Index(
    "idx_heading_title_trgm",
    heading.c.title,
    postgresql_using="gin",
    postgresql_ops={heading.c.title.key: "gin_trgm_ops"},
)
Index(
    "idx_heading_desc_trgm",
    heading.c.description,
    postgresql_using="gin",
    postgresql_ops={heading.c.description.key: "gin_trgm_ops"},
)
Index(
    "idx_content_body_trgm",
    content.c.body,
    postgresql_using="gin",
    postgresql_ops={content.c.body.key: "gin_trgm_ops"},
)
Index(
    "idx_content_desc_trgm",
    content.c.description,
    postgresql_using="gin",
    postgresql_ops={content.c.description.key: "gin_trgm_ops"},
)