-- Add RPC for posting opening balance journal entries
-- This function creates a balanced opening entry and links it to the account via source_type/source_id.

CREATE OR REPLACE FUNCTION public.post_opening_balance_journal(
  account_code_param text,
  account_name_param text,
  account_type_param text,
  opening_balance_param numeric,
  entry_date_param date,
  actor_uuid uuid,
  source_id_param uuid
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_journal_id uuid;
  v_debit_account text;
  v_credit_account text;
  v_debit_amount numeric;
  v_credit_amount numeric;
  v_debit_description text;
  v_credit_description text;
  v_source_exists boolean;
BEGIN
  IF opening_balance_param IS NULL OR opening_balance_param <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opening balance must be greater than zero.');
  END IF;

  IF source_id_param IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM journal_entries
      WHERE source_type = 'opening_balance'
        AND source_id = source_id_param
    ) INTO v_source_exists;

    IF v_source_exists THEN
      RETURN jsonb_build_object('success', false, 'error', 'Opening balance journal already exists for this account.');
    END IF;
  END IF;

  IF account_type_param NOT IN ('asset', 'liability', 'equity', 'revenue', 'expense') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported account type for opening balance.');
  END IF;

  INSERT INTO journal_entries (
    entry_date,
    description,
    reference,
    source_type,
    source_id,
    posted_by,
    created_by,
    is_posted
  ) VALUES (
    COALESCE(entry_date_param, CURRENT_DATE),
    'Opening balance for ' || COALESCE(account_code_param, ''),
    COALESCE(account_code_param, '') || ' opening balance',
    'opening_balance',
    source_id_param,
    actor_uuid,
    actor_uuid,
    true
  ) RETURNING id INTO v_journal_id;

  IF account_type_param IN ('asset', 'expense') THEN
    v_debit_account := account_code_param;
    v_debit_amount := opening_balance_param;
    v_credit_account := '3200';
    v_credit_amount := opening_balance_param;
    v_debit_description := 'Opening balance for ' || COALESCE(account_code_param, '');
    v_credit_description := 'Opening balance offset for ' || COALESCE(account_code_param, '');
  ELSE
    v_debit_account := '3200';
    v_debit_amount := opening_balance_param;
    v_credit_account := account_code_param;
    v_credit_amount := opening_balance_param;
    v_debit_description := 'Opening balance offset for ' || COALESCE(account_code_param, '');
    v_credit_description := 'Opening balance for ' || COALESCE(account_code_param, '');
  END IF;

  INSERT INTO ledger_entries (
    journal_entry_id,
    account_code,
    account_name,
    debit_amount,
    credit_amount,
    description,
    created_at
  ) VALUES (
    v_journal_id,
    v_debit_account,
    CASE WHEN v_debit_account = '3200' THEN 'Opening Balances Equity' ELSE account_name_param END,
    v_debit_amount,
    CASE WHEN v_debit_account = '3200' THEN 0 ELSE 0 END,
    v_debit_description,
    now()
  );

  INSERT INTO ledger_entries (
    journal_entry_id,
    account_code,
    account_name,
    debit_amount,
    credit_amount,
    description,
    created_at
  ) VALUES (
    v_journal_id,
    v_credit_account,
    CASE WHEN v_credit_account = '3200' THEN 'Opening Balances Equity' ELSE account_name_param END,
    CASE WHEN v_credit_account = '3200' THEN opening_balance_param ELSE 0 END,
    CASE WHEN v_credit_account = account_code_param THEN opening_balance_param ELSE 0 END,
    v_credit_description,
    now()
  );

  RETURN jsonb_build_object('success', true, 'journal_entry_id', v_journal_id);

EXCEPTION WHEN OTHERS THEN
  DELETE FROM journal_entries WHERE id = v_journal_id;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
