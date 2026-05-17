-- =============================================================================
-- Migration 024: Manual journal RPCs
-- Adds two helper functions used by the UI to post and reverse manual journals.
-- Run this file in the Supabase SQL editor or via psql.
-- =============================================================================

-- NOTE: This file is conservative about optional columns. It writes the core
-- records into `journal_entries` and `journal_lines` and will attempt to mark
-- originals as reversed only if an `is_reversed` column exists.

CREATE OR REPLACE FUNCTION public.post_manual_journal(
  description_param TEXT,
  entry_date_param DATE,
  reference_param TEXT,
  lines_param JSONB,
  actor_uuid UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_journal_id UUID;
  v_row JSONB;
  v_project_uuid UUID;
BEGIN
  -- basic validation
  IF lines_param IS NULL OR jsonb_array_length(lines_param) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No lines provided.');
  END IF;

  SELECT COALESCE(SUM((NULLIF(x->> 'debit_amount',''))::numeric),0)
    INTO v_total_debit
    FROM jsonb_array_elements(lines_param) AS x;

  SELECT COALESCE(SUM((NULLIF(x->> 'credit_amount',''))::numeric),0)
    INTO v_total_credit
    FROM jsonb_array_elements(lines_param) AS x;

  IF v_total_debit IS NULL THEN v_total_debit := 0; END IF;
  IF v_total_credit IS NULL THEN v_total_credit := 0; END IF;

  IF v_total_debit <> v_total_credit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Journal is not balanced.');
  END IF;

  BEGIN
    -- create header
    INSERT INTO journal_entries(entry_date, description, reference, created_by, is_posted)
    VALUES (COALESCE(entry_date_param, CURRENT_DATE), COALESCE(description_param,''), reference_param, actor_uuid, true)
    RETURNING id INTO v_journal_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to create journal header: ' || SQLERRM);
  END;

  -- insert lines
  FOR v_row IN SELECT * FROM jsonb_array_elements(lines_param)
  LOOP
    BEGIN
      v_project_uuid := NULL;
      IF (v_row->> 'project_id') IS NOT NULL AND (v_row->> 'project_id') <> '' THEN
        -- projects are UUID in this schema; attempt cast, fallback to NULL on failure
        BEGIN
          v_project_uuid := (v_row->> 'project_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_project_uuid := NULL;
        END;
      END IF;

      INSERT INTO journal_lines(journal_entry_id, account_code, debit, credit, project_id, description)
      VALUES (
        v_journal_id,
        NULLIF(v_row->> 'account_code',''),
        COALESCE(NULLIF(v_row->> 'debit_amount','')::numeric,0),
        COALESCE(NULLIF(v_row->> 'credit_amount','')::numeric,0),
        v_project_uuid,
        NULLIF(v_row->> 'line_description','')
      );
    EXCEPTION WHEN OTHERS THEN
      -- rollback header and existing lines on error
      DELETE FROM journal_lines WHERE journal_entry_id = v_journal_id;
      DELETE FROM journal_entries WHERE id = v_journal_id;
      RETURN jsonb_build_object('success', false, 'error', 'Failed to insert journal line: ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'journal_entry_id', v_journal_id, 'total_debit', v_total_debit, 'total_credit', v_total_credit);
END;
$$;


CREATE OR REPLACE FUNCTION public.reverse_journal_entry(
  journal_id_param UUID,
  reversal_date_param DATE,
  reason_param TEXT,
  actor_uuid UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_orig RECORD;
  v_new_id UUID;
  v_line RECORD;
  v_has_is_reversed BOOLEAN := false;
BEGIN
  -- load original
  SELECT * INTO v_orig FROM journal_entries WHERE id = journal_id_param;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Original journal entry not found');
  END IF;

  -- check if already reversed (if column exists)
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'is_reversed'
  ) INTO v_has_is_reversed;

  IF v_has_is_reversed THEN
    PERFORM 1 FROM journal_entries WHERE id = journal_id_param AND is_reversed = true;
    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Journal entry already reversed');
    END IF;
  END IF;

  -- create reversal header
  INSERT INTO journal_entries(entry_date, description, reference, created_by, is_posted)
  VALUES (COALESCE(reversal_date_param, CURRENT_DATE), CONCAT('Reversal of ', COALESCE(v_orig.reference, v_orig.id::text), ': ', COALESCE(reason_param,'')), NULL, actor_uuid, true)
  RETURNING id INTO v_new_id;

  -- copy and swap lines
  FOR v_line IN SELECT account_code, debit, credit, project_id, description FROM journal_lines WHERE journal_entry_id = journal_id_param
  LOOP
    INSERT INTO journal_lines(journal_entry_id, account_code, debit, credit, project_id, description)
    VALUES (
      v_new_id,
      v_line.account_code,
      COALESCE(v_line.credit,0),
      COALESCE(v_line.debit,0),
      v_line.project_id,
      CONCAT('Reversal: ', COALESCE(reason_param,''), ' — ', COALESCE(v_line.description,''))
    );
  END LOOP;

  -- mark original as reversed if column exists
  IF v_has_is_reversed THEN
    EXECUTE 'UPDATE journal_entries SET is_reversed = TRUE WHERE id = $1' USING journal_id_param;
  END IF;

  RETURN jsonb_build_object('success', true, 'reversal_journal_id', v_new_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Optional: grant execute to anon and authenticated roles if you want UI-level access
-- GRANT EXECUTE ON FUNCTION public.post_manual_journal(TEXT, DATE, TEXT, JSONB, UUID) TO authenticated, anon;
-- GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(UUID, DATE, TEXT, UUID) TO authenticated, anon;
