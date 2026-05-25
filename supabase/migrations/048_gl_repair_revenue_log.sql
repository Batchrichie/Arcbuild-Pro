-- Migration 048: GL repair bundle — revenue mapping in backfill, utilities correction RPC

CREATE OR REPLACE FUNCTION public.correct_reversed_expense_account(
  account_code_param TEXT,
  offset_account_param TEXT,
  acting_user_id UUID,
  reference_param TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_net_credit NUMERIC;
  v_fix JSONB;
BEGIN
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = acting_user_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  SELECT COALESCE(SUM(credit_amount), 0) - COALESCE(SUM(debit_amount), 0)
  INTO v_net_credit
  FROM ledger_entries
  WHERE account_code = account_code_param;

  IF v_net_credit <= 0.01 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'message', 'No abnormal credit balance to correct');
  END IF;

  v_fix := post_manual_journal(
    format('Correction — reverse mis-posted %s', account_code_param),
    CURRENT_DATE,
    COALESCE(reference_param, 'GL-FIX-' || account_code_param),
    jsonb_build_array(
      jsonb_build_object(
        'account_code', account_code_param,
        'debit_amount', v_net_credit,
        'credit_amount', 0,
        'line_description', 'Reverse incorrect credit balance'
      ),
      jsonb_build_object(
        'account_code', offset_account_param,
        'debit_amount', 0,
        'credit_amount', v_net_credit,
        'line_description', 'Offset for expense correction'
      )
    ),
    v_profile_id
  );

  RETURN v_fix || jsonb_build_object('corrected_amount', v_net_credit);
END;
$$;


CREATE OR REPLACE FUNCTION public.backfill_missing_invoice_journals(acting_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  jr JSONB;
  posted INT := 0;
  skipped INT := 0;
  errors JSONB := '[]'::JSONB;
  revenue_map JSONB := '[]'::JSONB;
  v_division TEXT;
  v_revenue_code TEXT;
BEGIN
  FOR inv IN
    SELECT i.id, i.invoice_number, i.status, i.division_id, d.name AS division_name
    FROM invoices i
    LEFT JOIN divisions d ON d.id = i.division_id
    WHERE i.status IN ('approved', 'sent', 'paid')
      AND NOT public.invoice_has_gl_posting(i.id)
    ORDER BY i.created_at
  LOOP
    v_division := inv.division_name;
    v_revenue_code := CASE v_division
      WHEN 'Construction' THEN '4100'
      WHEN 'Architecture' THEN '4200'
      WHEN 'Real Estate' THEN '4300'
      WHEN 'Logistics' THEN '4400'
      ELSE '4500'
    END;

    jr := post_invoice_journal(inv.id, acting_user_id, TRUE);

    IF COALESCE((jr->>'success')::BOOLEAN, FALSE) THEN
      IF COALESCE((jr->>'skipped')::BOOLEAN, FALSE) THEN
        skipped := skipped + 1;
      ELSE
        posted := posted + 1;
        revenue_map := revenue_map || jsonb_build_array(jsonb_build_object(
          'invoice_number', inv.invoice_number,
          'division', v_division,
          'revenue_account_credited', v_revenue_code,
          'journal_entry_id', jr->>'journal_entry_id',
          'total_posted_ghs', jr->>'total_posted_ghs'
        ));
      END IF;
    ELSE
      errors := errors || jsonb_build_array(jsonb_build_object(
        'invoice_number', inv.invoice_number,
        'division', v_division,
        'intended_revenue_account', v_revenue_code,
        'error', jr->>'error'
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', jsonb_array_length(errors) = 0,
    'posted', posted,
    'skipped', skipped,
    'errors', errors,
    'revenue_posting_map', revenue_map
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.run_gl_integrity_repair(acting_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backfill JSONB;
  v_util JSONB;
  v_report JSONB;
BEGIN
  v_backfill := backfill_missing_invoice_journals(acting_user_id);
  v_util := correct_reversed_expense_account('6202', '1101', acting_user_id, 'GL-FIX-6202');
  v_report := get_gl_integrity_report();

  RETURN jsonb_build_object(
    'backfill', v_backfill,
    'utilities_correction', v_util,
    'integrity_report', v_report,
    'revenue_accounts_summary', (
      SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'revenue_account')), '[]'::JSONB)
      FROM (
        SELECT jsonb_build_object(
          'revenue_account', le.account_code,
          'account_name', le.account_name,
          'total_credited', SUM(le.credit_amount)
        ) AS row
        FROM ledger_entries le
        JOIN journal_entries je ON je.id = le.journal_entry_id
        WHERE je.source_type = 'invoice'
          AND le.credit_amount > 0
          AND le.account_code LIKE '4%'
        GROUP BY le.account_code, le.account_name
      ) s
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.correct_reversed_expense_account(TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_gl_integrity_repair(UUID) TO authenticated;
