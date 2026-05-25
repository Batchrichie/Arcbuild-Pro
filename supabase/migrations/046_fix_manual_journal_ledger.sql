-- =============================================================================
-- Migration 046: Fix manual journal RPCs to use ledger_entries (not journal_lines)
-- journal_lines was renamed to ledger_entries in migration 007.
-- =============================================================================

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
  v_line_count INT := 0;
  v_debit_lines INT := 0;
  v_credit_lines INT := 0;
  v_journal_id UUID;
  v_row JSONB;
  v_project_uuid UUID;
  v_division_uuid UUID;
  v_account_code TEXT;
  v_debit NUMERIC;
  v_credit NUMERIC;
  v_account_name TEXT;
BEGIN
  IF lines_param IS NULL OR jsonb_array_length(lines_param) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least two lines are required (one debit and one credit).');
  END IF;

  -- Count only lines with an account and a non-zero debit or credit
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(CASE WHEN COALESCE(NULLIF(x->> 'debit_amount', '')::numeric, 0) > 0 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN COALESCE(NULLIF(x->> 'credit_amount', '')::numeric, 0) > 0 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(COALESCE(NULLIF(x->> 'debit_amount', '')::numeric, 0)), 0),
    COALESCE(SUM(COALESCE(NULLIF(x->> 'credit_amount', '')::numeric, 0)), 0)
  INTO v_line_count, v_debit_lines, v_credit_lines, v_total_debit, v_total_credit
  FROM jsonb_array_elements(lines_param) AS x
  WHERE COALESCE(NULLIF(TRIM(x->> 'account_code'), ''), '') <> ''
    AND (
      COALESCE(NULLIF(x->> 'debit_amount', '')::numeric, 0) > 0
      OR COALESCE(NULLIF(x->> 'credit_amount', '')::numeric, 0) > 0
    );

  IF v_line_count < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'At least two lines with accounts and amounts are required (minimum one debit and one credit).'
    );
  END IF;

  IF v_debit_lines < 1 OR v_credit_lines < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Journal must include at least one debit line and one credit line.'
    );
  END IF;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Journal is not balanced.');
  END IF;

  PERFORM validate_active_accounts(ARRAY(
    SELECT DISTINCT TRIM(x->> 'account_code')
    FROM jsonb_array_elements(lines_param) AS x
    WHERE COALESCE(NULLIF(TRIM(x->> 'account_code'), ''), '') <> ''
      AND (
        COALESCE(NULLIF(x->> 'debit_amount', '')::numeric, 0) > 0
        OR COALESCE(NULLIF(x->> 'credit_amount', '')::numeric, 0) > 0
      )
  ));

  BEGIN
    INSERT INTO journal_entries (
      entry_date,
      description,
      reference,
      source_type,
      posted_by,
      created_by,
      is_posted
    )
    VALUES (
      COALESCE(entry_date_param, CURRENT_DATE),
      COALESCE(description_param, ''),
      reference_param,
      'manual',
      actor_uuid,
      actor_uuid,
      TRUE
    )
    RETURNING id INTO v_journal_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to create journal header: ' || SQLERRM);
  END;

  FOR v_row IN SELECT * FROM jsonb_array_elements(lines_param)
  LOOP
    v_account_code := NULLIF(TRIM(v_row->> 'account_code'), '');
    v_debit := COALESCE(NULLIF(v_row->> 'debit_amount', '')::numeric, 0);
    v_credit := COALESCE(NULLIF(v_row->> 'credit_amount', '')::numeric, 0);

    -- Skip blank optional rows
    IF v_account_code IS NULL OR (v_debit <= 0 AND v_credit <= 0) THEN
      CONTINUE;
    END IF;

    IF v_debit > 0 AND v_credit > 0 THEN
      DELETE FROM ledger_entries WHERE journal_entry_id = v_journal_id;
      DELETE FROM journal_entries WHERE id = v_journal_id;
      RETURN jsonb_build_object('success', false, 'error', 'A line cannot have both debit and credit amounts.');
    END IF;

    v_project_uuid := NULL;
    v_division_uuid := NULL;

    IF (v_row->> 'project_id') IS NOT NULL AND (v_row->> 'project_id') <> '' THEN
      BEGIN
        v_project_uuid := (v_row->> 'project_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_project_uuid := NULL;
      END;
    END IF;

    IF (v_row->> 'division_id') IS NOT NULL AND (v_row->> 'division_id') <> '' THEN
      BEGIN
        v_division_uuid := (v_row->> 'division_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_division_uuid := NULL;
      END;
    END IF;

    SELECT account_name INTO v_account_name
    FROM chart_of_accounts
    WHERE account_code = v_account_code;

    IF v_account_name IS NULL THEN
      DELETE FROM ledger_entries WHERE journal_entry_id = v_journal_id;
      DELETE FROM journal_entries WHERE id = v_journal_id;
      RETURN jsonb_build_object('success', false, 'error', 'Account code not found: ' || v_account_code);
    END IF;

    BEGIN
      INSERT INTO ledger_entries (
        journal_entry_id,
        account_code,
        account_name,
        debit_amount,
        credit_amount,
        description,
        project_id,
        division_id,
        currency
      )
      VALUES (
        v_journal_id,
        v_account_code,
        v_account_name,
        v_debit,
        v_credit,
        NULLIF(v_row->> 'line_description', ''),
        v_project_uuid,
        v_division_uuid,
        'GHS'
      );
    EXCEPTION WHEN OTHERS THEN
      DELETE FROM ledger_entries WHERE journal_entry_id = v_journal_id;
      DELETE FROM journal_entries WHERE id = v_journal_id;
      RETURN jsonb_build_object('success', false, 'error', 'Failed to insert ledger line: ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'journal_entry_id', v_journal_id,
    'entry_number', (SELECT entry_number FROM journal_entries WHERE id = v_journal_id),
    'total_debit', v_total_debit,
    'total_credit', v_total_credit
  );
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
  SELECT * INTO v_orig FROM journal_entries WHERE id = journal_id_param;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Original journal entry not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_entries'
      AND column_name = 'is_reversed'
  ) INTO v_has_is_reversed;

  IF v_has_is_reversed AND v_orig.is_reversed = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Journal entry already reversed');
  END IF;

  INSERT INTO journal_entries (
    entry_date,
    description,
    reference,
    source_type,
    posted_by,
    created_by,
    is_posted
  )
  VALUES (
    COALESCE(reversal_date_param, CURRENT_DATE),
    CONCAT('Reversal of ', COALESCE(v_orig.reference, v_orig.id::text), ': ', COALESCE(reason_param, '')),
    NULL,
    'manual_reversal',
    actor_uuid,
    actor_uuid,
    TRUE
  )
  RETURNING id INTO v_new_id;

  FOR v_line IN
    SELECT
      account_code,
      account_name,
      debit_amount,
      credit_amount,
      project_id,
      division_id,
      description
    FROM ledger_entries
    WHERE journal_entry_id = journal_id_param
  LOOP
    INSERT INTO ledger_entries (
      journal_entry_id,
      account_code,
      account_name,
      debit_amount,
      credit_amount,
      description,
      project_id,
      division_id,
      currency
    )
    VALUES (
      v_new_id,
      v_line.account_code,
      v_line.account_name,
      COALESCE(v_line.credit_amount, 0),
      COALESCE(v_line.debit_amount, 0),
      CONCAT('Reversal: ', COALESCE(reason_param, ''), ' — ', COALESCE(v_line.description, '')),
      v_line.project_id,
      v_line.division_id,
      'GHS'
    );
  END LOOP;

  IF v_has_is_reversed THEN
    UPDATE journal_entries SET is_reversed = TRUE WHERE id = journal_id_param;
  END IF;

  RETURN jsonb_build_object('success', true, 'reversal_journal_id', v_new_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_manual_journal(TEXT, DATE, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(UUID, DATE, TEXT, UUID) TO authenticated;
