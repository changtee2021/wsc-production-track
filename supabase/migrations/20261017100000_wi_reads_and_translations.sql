-- WI follow-up: per-employee read tracking + English/Myanmar translations.
-- * wi_reads: one row per (version, employee). Opening a manual bumps the view
--   counter; "read and understood" stamps acknowledged_at. A new version has
--   no rows yet, so everyone shows as "new version — please read" again.
-- * wi_publish now copies draft_content.translations into the snapshot so the
--   floor sees exactly the translations the reviewer approved.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['wp_production', 'wsc_production'] LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.wi_reads (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        wi_id uuid NOT NULL REFERENCES %1$I.wi_documents(id) ON DELETE RESTRICT,
        version_id uuid NOT NULL REFERENCES %1$I.wi_versions(id) ON DELETE RESTRICT,
        employee_id uuid NOT NULL REFERENCES %1$I.employees(id) ON DELETE CASCADE,
        view_count integer NOT NULL DEFAULT 1 CHECK (view_count >= 1),
        first_viewed_at timestamptz NOT NULL DEFAULT now(),
        last_viewed_at timestamptz NOT NULL DEFAULT now(),
        acknowledged_at timestamptz,
        lang text NOT NULL DEFAULT 'th' CHECK (lang IN ('th', 'en', 'my')),
        UNIQUE (version_id, employee_id)
      )$sql$, sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_reads_employee_idx ON %I.wi_reads (employee_id)', sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS wi_reads_wi_idx ON %I.wi_reads (wi_id, version_id)', sch);

    EXECUTE format('GRANT ALL ON %I.wi_reads TO service_role', sch);
    EXECUTE format('ALTER TABLE %I.wi_reads ENABLE ROW LEVEL SECURITY', sch);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = sch AND tablename = 'wi_reads' AND policyname = 'Block client access wi_reads'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.wi_reads AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        'Block client access wi_reads', sch);
    END IF;

    -- Atomic upsert so two taps (or two tabs) never lose a view or an
    -- acknowledgement; acknowledged_at is set once and never moved.
    EXECUTE format($sql$
      CREATE OR REPLACE FUNCTION %1$I.wi_record_read(
        p_wi_id uuid,
        p_version_id uuid,
        p_employee_id uuid,
        p_acknowledge boolean,
        p_lang text
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SET search_path = %1$I, pg_temp
      AS $fn$
      DECLARE
        r %1$I.wi_reads%%ROWTYPE;
      BEGIN
        INSERT INTO %1$I.wi_reads (wi_id, version_id, employee_id, acknowledged_at, lang)
        VALUES (p_wi_id, p_version_id, p_employee_id,
                CASE WHEN p_acknowledge THEN now() END,
                coalesce(p_lang, 'th'))
        ON CONFLICT (version_id, employee_id) DO UPDATE SET
          view_count = %1$I.wi_reads.view_count + CASE WHEN p_acknowledge THEN 0 ELSE 1 END,
          last_viewed_at = now(),
          acknowledged_at = coalesce(%1$I.wi_reads.acknowledged_at,
                                     CASE WHEN p_acknowledge THEN now() END),
          lang = coalesce(p_lang, %1$I.wi_reads.lang)
        RETURNING * INTO r;
        RETURN jsonb_build_object(
          'first_viewed_at', r.first_viewed_at,
          'acknowledged_at', r.acknowledged_at,
          'view_count', r.view_count
        );
      END
      $fn$
    $sql$, sch);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.wi_record_read(uuid, uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated', sch);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.wi_record_read(uuid, uuid, uuid, boolean, text) TO service_role', sch);

    -- Approve & publish in one transaction (unchanged rules), now including
    -- the translations the reviewer saw in the preview.
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
          'steps', coalesce(d.draft_content -> 'steps', '[]'::jsonb),
          'translations', coalesce(d.draft_content -> 'translations', '{}'::jsonb)
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
  END LOOP;
END $$;
