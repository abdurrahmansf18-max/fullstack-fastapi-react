-- 1) EXTENSIONS

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   
CREATE EXTENSION IF NOT EXISTS unaccent;   
CREATE EXTENSION IF NOT EXISTS pg_trgm;    

-- 2) TABLES

CREATE TABLE IF NOT EXISTS admin_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name citext NOT NULL UNIQUE,
  description text,
  slug text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_name_not_blank CHECK (btrim(name::text) <> ''),
  CONSTRAINT category_slug_format_ck CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS heading (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES category(id) ON DELETE CASCADE,
  parent_heading_id uuid REFERENCES heading(id) ON DELETE CASCADE,
  level smallint NOT NULL CHECK (level IN (1,2)),
  title citext NOT NULL,
  description text,
  slug text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT heading_title_not_blank CHECK (btrim(title::text) <> ''),
  CONSTRAINT heading_level_parent_ck CHECK (
    (level = 1 AND category_id IS NOT NULL AND parent_heading_id IS NULL) OR
    (level = 2 AND parent_heading_id IS NOT NULL AND category_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heading_id uuid NOT NULL UNIQUE REFERENCES heading(id) ON DELETE CASCADE,
  body text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_image (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 0,    -- NOT NULL ve DEFAULT 0 eklendi
  height integer NOT NULL DEFAULT 0,   -- NOT NULL ve DEFAULT 0 eklendi
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_image_url_ck CHECK (btrim(url) <> '' AND url ~ '^(https?://|/|s3://)')
);

-- 3) HELPERS / FUNCTIONS

CREATE OR REPLACE FUNCTION normalize_slug(src text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text;
BEGIN
  IF src IS NULL OR btrim(src) = '' THEN
    RETURN NULL;
  END IF;
  s := lower(regexp_replace(unaccent(src), '[^a-z0-9]+', '-', 'g'));
  s := regexp_replace(s, '^-+|-+$', '', 'g');
  IF s = '' THEN
    RETURN NULL;
  END IF;
  RETURN s;
END;$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION set_category_slug()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE base text; s text; i int := 2;
BEGIN
  base := normalize_slug(NEW.name);
  s := base;
  WHILE EXISTS (SELECT 1 FROM category c WHERE c.slug = s AND c.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
    s := base || '-' || i; i := i + 1;
  END LOOP;
  NEW.slug := s;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION set_heading_slug()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE base text; s text; i int := 2;
BEGIN
  base := normalize_slug(NEW.title);
  s := base;

  IF NEW.level = 1 THEN
    WHILE EXISTS (
      SELECT 1 FROM heading h
      WHERE h.level = 1 AND h.category_id = NEW.category_id AND h.slug = s
            AND h.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      s := base || '-' || i; i := i + 1;
    END LOOP;

  ELSE
    WHILE EXISTS (
      SELECT 1 FROM heading h
      WHERE h.level = 2 AND h.parent_heading_id = NEW.parent_heading_id AND h.slug = s
            AND h.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      s := base || '-' || i; i := i + 1;
    END LOOP;
  END IF;

  NEW.slug := s;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION prevent_l2_when_parent_has_content()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE has_content boolean;
BEGIN
  IF NEW.level = 2 THEN
    SELECT EXISTS (SELECT 1 FROM content c WHERE c.heading_id = NEW.parent_heading_id)
      INTO has_content;
    IF has_content THEN
      RAISE EXCEPTION 'Ana başlık (L1) içerik barındırıyorken alt başlık (L2) oluşturulamaz/güncellenemez.';
    END IF;
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION heading_parent_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p_level smallint;
BEGIN
  IF NEW.level = 2 THEN
    SELECT level INTO p_level FROM heading WHERE id = NEW.parent_heading_id;
    IF p_level IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'L2 heading''in ebeveyni level=1 olmalı.';
    END IF;
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION prevent_level_update()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.level IS DISTINCT FROM OLD.level THEN
    RAISE EXCEPTION 'Heading level sonradan değiştirilemez (immutable).';
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION enforce_content_vs_children()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE child_count int;
BEGIN
  IF (SELECT level FROM heading WHERE id = NEW.heading_id) = 1 THEN
    SELECT COUNT(*) INTO child_count FROM heading WHERE parent_heading_id = NEW.heading_id;
    IF child_count > 0 THEN
      RAISE EXCEPTION 'L1 heading alt başlık içerirken kendisine içerik eklenemez.';
    END IF;
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION search_all_trgm(q text, limit_count int DEFAULT 50)
RETURNS TABLE(source text, id uuid, label text, snippet text, score real)
LANGUAGE sql AS $$
  (
    SELECT 'category'::text, c.id, c.name::text, c.description, similarity(c.name::text, q) AS score
    FROM category c
    WHERE c.name ILIKE '%'||q||'%' OR c.description ILIKE '%'||q||'%'
  )
  UNION ALL
  (
    SELECT 'heading', h.id, h.title::text, h.description, similarity(h.title::text, q) AS score
    FROM heading h
    WHERE h.title ILIKE '%'||q||'%' OR h.description ILIKE '%'||q||'%'
  )
  UNION ALL
  (
    SELECT 'content', ct.id, NULL::text, substring(ct.body from 1 for 240), similarity(ct.body, q) AS score
    FROM content ct
    WHERE ct.body ILIKE '%'||q||'%' OR ct.description ILIKE '%'||q||'%'
  )
  ORDER BY score DESC
  LIMIT limit_count;
$$;

-- 4) TRIGGERS

CREATE TRIGGER trg_admin_user_updated
BEFORE UPDATE ON admin_user
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_category_updated
BEFORE UPDATE ON category
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_heading_updated
BEFORE UPDATE ON heading
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_content_updated
BEFORE UPDATE ON content
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_content_image_updated
BEFORE UPDATE ON content_image
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_category_slug
BEFORE INSERT OR UPDATE OF name, slug ON category
FOR EACH ROW EXECUTE FUNCTION set_category_slug();

CREATE TRIGGER trg_set_heading_slug
BEFORE INSERT OR UPDATE OF title, slug ON heading
FOR EACH ROW EXECUTE FUNCTION set_heading_slug();

CREATE TRIGGER trg_content_parent_rule
BEFORE INSERT OR UPDATE OF heading_id ON content
FOR EACH ROW EXECUTE FUNCTION enforce_content_vs_children();

CREATE TRIGGER trg_heading_parent_guard
BEFORE INSERT OR UPDATE OF parent_heading_id, level ON heading
FOR EACH ROW EXECUTE FUNCTION heading_parent_guard();

CREATE TRIGGER trg_prevent_l2_when_parent_has_content
BEFORE INSERT OR UPDATE OF parent_heading_id, level ON heading
FOR EACH ROW EXECUTE FUNCTION prevent_l2_when_parent_has_content();

CREATE TRIGGER trg_prevent_level_update
BEFORE UPDATE OF level ON heading
FOR EACH ROW EXECUTE FUNCTION prevent_level_update();

-- 5) UNIQUE & PERFORMANCE INDEXES

CREATE UNIQUE INDEX IF NOT EXISTS uq_category_slug
  ON category(slug);

CREATE UNIQUE INDEX IF NOT EXISTS uq_heading_level1_slug
  ON heading(category_id, slug) WHERE level = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_heading_level2_slug
  ON heading(parent_heading_id, slug) WHERE level = 2;

CREATE INDEX IF NOT EXISTS idx_heading_category_l1
  ON heading(category_id) WHERE level = 1;

CREATE INDEX IF NOT EXISTS idx_heading_parent_l2
  ON heading(parent_heading_id) WHERE level = 2;

CREATE INDEX IF NOT EXISTS idx_heading_l1_sort
  ON heading(category_id, sort_order, id) WHERE level = 1;

CREATE INDEX IF NOT EXISTS idx_heading_l2_sort
  ON heading(parent_heading_id, sort_order, id) WHERE level = 2;

CREATE INDEX IF NOT EXISTS idx_category_name_trgm
  ON category USING gin ((name::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_category_desc_trgm
  ON category USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_heading_title_trgm
  ON heading USING gin ((title::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_heading_desc_trgm
  ON heading USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_content_body_trgm
  ON content USING gin (body gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_content_desc_trgm
  ON content USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_content_image_order
  ON content_image(content_id, sort_order, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_image_sort
  ON content_image(content_id, sort_order);