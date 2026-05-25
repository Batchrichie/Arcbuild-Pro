-- Migration 049: Allow GL repair journals to bypass RLS (service-style posting)

ALTER FUNCTION public.post_manual_journal(TEXT, DATE, TEXT, JSONB, UUID) SECURITY DEFINER;
ALTER FUNCTION public.post_manual_journal(TEXT, DATE, TEXT, JSONB, UUID) SET search_path = public;

-- Standalone utilities fix callable without authenticated session (repair scripts)
CREATE OR REPLACE FUNCTION public.fix_utilities_6202_journal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_net NUMERIC;
  v_journal_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM profiles WHERE role = 'system' LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM profiles WHERE role IN ('accountant', 'ceo') LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(credit_amount), 0) - COALESCE(SUM(debit_amount), 0)
  INTO v_net
  FROM ledger_entries WHERE account_code = '6202';

  IF v_net <= 0.01 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'message', '6202 already normal');
  END IF;

  INSERT INTO journal_entries (entry_date, description, reference, source_type, posted_by, created_by, is_posted)
  VALUES (CURRENT_DATE, 'Correction — reverse mis-posted Utilities', 'GL-FIX-6202', 'manual', v_profile_id, v_profile_id, TRUE)
  RETURNING id INTO v_journal_id;

  INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, currency)
  VALUES (v_journal_id, '6202', 'Utilities', v_net, 0, 'Reverse incorrect credit', 'GHS');

  INSERT INTO ledger_entries (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, currency)
  VALUES (v_journal_id, '1101', 'Cash — GHS', 0, v_net, 'Offset utilities correction', 'GHS');

  RETURN jsonb_build_object('success', true, 'journal_entry_id', v_journal_id, 'corrected_amount', v_net);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fix_utilities_6202_journal() TO anon, authenticated;
