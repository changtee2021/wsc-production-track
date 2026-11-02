-- Work Instruction (WI) management: categories, documents (working draft as
-- jsonb), immutable published version snapshots, review trail, activity log,
-- and links to existing production steps/categories.
-- Writes go through server functions (service role); anon/authenticated are
-- blocked, matching the other department tables in this app.

DO $$
DECLARE
  sch text;
  tbl text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['wp_production', 'wsc_production'] LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.wi_categories (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
        description text CHECK (description IS NULL OR char_length(description) <= 500),
        sort_order integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by_name text,
        updated_by_name text
      )$sql$, sch);
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS wi_categories_name_uidx ON %I.wi_categories (lower(btrim(name)))',
      sch);

    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I.wi_code_seq', sch);

    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.wi_documents (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        wi_code text NOT NULL UNIQUE
          DEFAULT ('WI-' || lpad(nextval('%1$I.wi_code_seq')::text, 4, '0')),
        title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
        description text,
        category_id uuid REFERENCES %1$I.wi_categories(id) ON DELETE RESTRICT,
        owner_name text,
        tags text[] NOT NULL DEFAULT '{}',
        est_minutes integer CHECK (est_minutes IS NULL OR est_minutes BETWEEN 0 AND 10000),
        equipment text,
        safety_notes text,
        related_docs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(related_docs) = 'array'),
        draft_content jsonb NOT NULL DEFAULT '{"steps":[]}'::jsonb
          CHECK (jsonb_typeof(draft_content) = 'object'),
        status text NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
        has_unpublished_changes boolean NOT NULL DEFAULT true,
        pending_change_summary text,
        current_version_id uuid,
        submitted_by_name text,
        submitted_at timestamptz,
        published_at timestamptz,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by_name text,
        updated_by_name text
      )$sql$, sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_documents_status_idx ON %I.wi_documents (status, updated_at DESC)', sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_documents_category_idx ON %I.wi_documents (category_id)', sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_documents_tags_idx ON %I.wi_documents USING gin (tags)', sch);

    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.wi_versions (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        wi_id uuid NOT NULL REFERENCES %1$I.wi_documents(id) ON DELETE RESTRICT,
        major integer NOT NULL CHECK (major >= 1),
        minor integer NOT NULL CHECK (minor >= 0),
        content_snapshot jsonb NOT NULL CHECK (jsonb_typeof(content_snapshot) = 'object'),
        change_summary text,
        editor_name text,
        reviewer_name text,
        published_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (wi_id, major, minor)
      )$sql$, sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_versions_wi_idx ON %I.wi_versions (wi_id, published_at DESC)', sch);

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'wi_documents_current_version_fkey'
        AND conrelid = format('%I.wi_documents', sch)::regclass
    ) THEN
      EXECUTE format($sql$
        ALTER TABLE %1$I.wi_documents
          ADD CONSTRAINT wi_documents_current_version_fkey
          FOREIGN KEY (current_version_id) REFERENCES %1$I.wi_versions(id) ON DELETE RESTRICT
      $sql$, sch);
    END IF;

    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.wi_reviews (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        wi_id uuid NOT NULL REFERENCES %1$I.wi_documents(id) ON DELETE RESTRICT,
        version_id uuid REFERENCES %1$I.wi_versions(id) ON DELETE RESTRICT,
        outcome text NOT NULL CHECK (outcome IN ('submitted', 'approved', 'changes_requested')),
        comment text,
        actor_name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )$sql$, sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_reviews_wi_idx ON %I.wi_reviews (wi_id, created_at DESC)', sch);

    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.wi_activity (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        wi_id uuid REFERENCES %1$I.wi_documents(id) ON DELETE RESTRICT,
        action text NOT NULL CHECK (action IN (
          'created', 'updated', 'duplicated', 'submitted', 'published',
          'changes_requested', 'archived', 'restored', 'linked', 'unlinked'
        )),
        actor_name text,
        detail jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )$sql$, sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_activity_created_idx ON %I.wi_activity (created_at DESC)', sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_activity_wi_idx ON %I.wi_activity (wi_id, created_at DESC)', sch);

    -- Deleting a production step/category stays possible (existing admin
    -- behaviour), so links cascade away instead of blocking the delete.
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.wi_production_links (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        wi_id uuid NOT NULL REFERENCES %1$I.wi_documents(id) ON DELETE CASCADE,
        step_id uuid NOT NULL REFERENCES %1$I.steps(id) ON DELETE CASCADE,
        category_id uuid REFERENCES %1$I.categories(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by_name text
      )$sql$, sch);
    EXECUTE format($sql$
      CREATE UNIQUE INDEX IF NOT EXISTS wi_production_links_uidx ON %1$I.wi_production_links
        (wi_id, step_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
    $sql$, sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_production_links_step_idx ON %I.wi_production_links (step_id)', sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_production_links_category_idx ON %I.wi_production_links (category_id)', sch);

    FOREACH tbl IN ARRAY ARRAY['wi_categories', 'wi_documents', 'wi_versions', 'wi_reviews', 'wi_activity', 'wi_production_links'] LOOP
      EXECUTE format('GRANT ALL ON %I.%I TO service_role', sch, tbl);
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', sch, tbl);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = sch AND tablename = tbl AND policyname = 'Block client access ' || tbl
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
          'Block client access ' || tbl, sch, tbl);
      END IF;
    END LOOP;
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.wi_code_seq TO service_role', sch);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_wi_categories_touch ON %I.wi_categories', sch);
    EXECUTE format(
      'CREATE TRIGGER trg_wi_categories_touch BEFORE UPDATE ON %1$I.wi_categories FOR EACH ROW EXECUTE FUNCTION %1$I.fn_touch_updated_at()',
      sch);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_wi_documents_touch ON %I.wi_documents', sch);
    EXECUTE format(
      'CREATE TRIGGER trg_wi_documents_touch BEFORE UPDATE ON %1$I.wi_documents FOR EACH ROW EXECUTE FUNCTION %1$I.fn_touch_updated_at()',
      sch);

    -- Published snapshots are audit evidence of what employees followed:
    -- they may never be edited or removed, only superseded by a new version.
    EXECUTE format($sql$
      CREATE OR REPLACE FUNCTION %1$I.wi_versions_immutable()
      RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        RAISE EXCEPTION 'wi_versions rows are immutable (published snapshots)';
      END
      $fn$
    $sql$, sch);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_wi_versions_immutable ON %I.wi_versions', sch);
    EXECUTE format(
      'CREATE TRIGGER trg_wi_versions_immutable BEFORE UPDATE OR DELETE ON %1$I.wi_versions FOR EACH ROW EXECUTE FUNCTION %1$I.wi_versions_immutable()',
      sch);

    -- Approve & publish in one transaction: snapshot the working draft,
    -- assign the next version number, and record review + activity, so a
    -- published version can never exist without its audit rows.
    EXECUTE format($sql$
      CREATE OR REPLACE FUNCTION %1$I.wi_publish(
        p_wi_id uuid,
        p_bump text,
        p_reviewer text,
        p_comment text
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SET search_path = %1$I, pg_temp
      AS $fn$
      DECLARE
        d %1$I.wi_documents%%ROWTYPE;
        v_major integer;
        v_minor integer;
        v_id uuid;
        v_snapshot jsonb;
      BEGIN
        IF p_bump NOT IN ('major', 'minor') THEN
          RAISE EXCEPTION 'invalid version bump';
        END IF;
        IF coalesce(btrim(p_reviewer), '') = '' THEN
          RAISE EXCEPTION 'reviewer name required';
        END IF;

        SELECT * INTO d FROM %1$I.wi_documents WHERE id = p_wi_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'WI not found';
        END IF;
        IF d.status <> 'pending_review' THEN
          RAISE EXCEPTION 'WI must be pending review before publishing';
        END IF;
        IF lower(btrim(p_reviewer)) = lower(btrim(coalesce(d.submitted_by_name, ''))) THEN
          RAISE EXCEPTION 'reviewer must differ from submitter';
        END IF;

        SELECT major, minor INTO v_major, v_minor
        FROM %1$I.wi_versions WHERE wi_id = p_wi_id
        ORDER BY major DESC, minor DESC LIMIT 1;

        IF v_major IS NULL THEN
          v_major := 1; v_minor := 0;
        ELSIF p_bump = 'major' THEN
          v_major := v_major + 1; v_minor := 0;
        ELSE
          v_minor := v_minor + 1;
        END IF;

        v_snapshot := jsonb_build_object(
          'wi_code', d.wi_code,
          'title', d.title,
          'description', d.description,
          'category_id', d.category_id,
          'category_name', (SELECT c.name FROM %1$I.wi_categories c WHERE c.id = d.category_id),
          'owner_name', d.owner_name,
          'tags', to_jsonb(d.tags),
          'est_minutes', d.est_minutes,
          'equipment', d.equipment,
          'safety_notes', d.safety_notes,
          'related_docs', d.related_docs,
          'steps', coalesce(d.draft_content -> 'steps', '[]'::jsonb)
        );

        INSERT INTO %1$I.wi_versions
          (wi_id, major, minor, content_snapshot, change_summary, editor_name, reviewer_name)
        VALUES
          (p_wi_id, v_major, v_minor, v_snapshot, d.pending_change_summary, d.submitted_by_name, btrim(p_reviewer))
        RETURNING id INTO v_id;

        UPDATE %1$I.wi_documents SET
          status = 'published',
          current_version_id = v_id,
          published_at = now(),
          has_unpublished_changes = false,
          pending_change_summary = NULL,
          updated_by_name = btrim(p_reviewer)
        WHERE id = p_wi_id;

        INSERT INTO %1$I.wi_reviews (wi_id, version_id, outcome, comment, actor_name)
        VALUES (p_wi_id, v_id, 'approved', nullif(btrim(coalesce(p_comment, '')), ''), btrim(p_reviewer));

        INSERT INTO %1$I.wi_activity (wi_id, action, actor_name, detail)
        VALUES (p_wi_id, 'published', btrim(p_reviewer),
          jsonb_build_object('version', v_major || '.' || v_minor, 'version_id', v_id));

        RETURN jsonb_build_object('version_id', v_id, 'major', v_major, 'minor', v_minor);
      END
      $fn$
    $sql$, sch);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.wi_publish(uuid, text, text, text) FROM PUBLIC, anon, authenticated', sch);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.wi_publish(uuid, text, text, text) TO service_role', sch);

    EXECUTE format($sql$
      INSERT INTO %1$I.wi_categories (name, description, sort_order)
      SELECT v.name, v.description, v.sort_order
      FROM (VALUES
        ('งานผลิต', 'ขั้นตอนการผลิตในไลน์', 10),
        ('QC ตรวจคุณภาพ', 'มาตรฐานการตรวจสอบคุณภาพ', 20),
        ('แพ็คของ & จัดส่ง', 'การบรรจุและเตรียมส่ง', 30),
        ('ซ่อมบำรุง', 'การดูแลเครื่องจักรและอุปกรณ์', 40),
        ('ความปลอดภัย', 'ข้อปฏิบัติด้านความปลอดภัย', 50)
      ) AS v(name, description, sort_order)
      WHERE NOT EXISTS (SELECT 1 FROM %1$I.wi_categories)
    $sql$, sch);
  END LOOP;
END $$;

-- Private bucket for WI images/videos. Paths are prefixed with the app schema
-- (`wsc_production/wi/...`) because WP and WSC share this storage project.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wi-media', 'wi-media', false, 104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
