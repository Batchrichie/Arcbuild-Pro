-- Run in Supabase SQL Editor (service role). One-shot GL repair + verification.
-- Requires migrations 046 and 047 applied first.

DO $$
DECLARE
  v_actor_user_id UUID;
  v_actor_profile_id UUID;
  v_backfill JSONB;
  v_report JSONB;
  v_util_net NUMERIC;
  v_fix JSONB;
BEGIN
  SELECT user_id, id INTO v_actor_user_id, v_actor_profile_id
  FROM profiles
  WHERE role IN ('accountant', 'ceo', 'system')
  ORDER BY CASE role WHEN 'system' THEN 0 WHEN 'accountant' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'No accountant/ceo/system profile found';
  END IF;

  RAISE NOTICE 'Acting user_id: %, profile_id: %', v_actor_user_id, v_actor_profile_id;

  v_backfill := backfill_missing_invoice_journals(v_actor_user_id);
  RAISE NOTICE 'backfill_missing_invoice_journals: %', v_backfill;

  RAISE NOTICE '--- Revenue accounts credited by post_invoice_journal ---';
  PERFORM 1; -- placeholder for notice block below
END $$;

SELECT 'backfill_result' AS section, backfill_missing_invoice_journals(p.user_id) AS payload
FROM profiles p
WHERE p.role IN ('accountant', 'ceo', 'system')
ORDER BY CASE p.role WHEN 'system' THEN 0 WHEN 'accountant' THEN 1 ELSE 2 END
LIMIT 1;

SELECT 'integrity_report' AS section, get_gl_integrity_report() AS payload;

-- Revenue COA mapping log (invoice source journals)
SELECT
  'revenue_credit_map' AS section,
  le.account_code AS revenue_account,
  le.account_name,
  SUM(le.credit_amount) AS total_credited,
  string_agg(DISTINCT je.reference, ', ' ORDER BY je.reference) AS invoice_refs
FROM ledger_entries le
JOIN journal_entries je ON je.id = le.journal_entry_id
WHERE je.source_type = 'invoice'
  AND le.credit_amount > 0
  AND le.account_code LIKE '4%'
GROUP BY le.account_code, le.account_name
ORDER BY le.account_code;

-- Trial balance check
SELECT
  'trial_balance' AS section,
  SUM(debit_amount) AS total_debits,
  SUM(credit_amount) AS total_credits,
  SUM(debit_amount) - SUM(credit_amount) AS difference
FROM ledger_entries;

-- AR balance
SELECT
  'ar_1110' AS section,
  SUM(debit_amount) AS debits,
  SUM(credit_amount) AS credits,
  SUM(debit_amount) - SUM(credit_amount) AS net_debit_balance
FROM ledger_entries
WHERE account_code = '1110';

-- Fix reversed 6202 if net credit
DO $$
DECLARE
  v_actor_profile_id UUID;
  v_util_net NUMERIC;
  v_fix JSONB;
BEGIN
  SELECT id INTO v_actor_profile_id FROM profiles
  WHERE role IN ('accountant', 'ceo', 'system')
  ORDER BY CASE role WHEN 'system' THEN 0 WHEN 'accountant' THEN 1 ELSE 2 END
  LIMIT 1;

  SELECT COALESCE(SUM(credit_amount), 0) - COALESCE(SUM(debit_amount), 0)
  INTO v_util_net
  FROM ledger_entries
  WHERE account_code = '6202';

  IF v_util_net > 0.01 THEN
    v_fix := post_manual_journal(
      'Correction — reverse mis-posted Utilities entry',
      CURRENT_DATE,
      'GL-FIX-6202',
      jsonb_build_array(
        jsonb_build_object('account_code', '6202', 'debit_amount', v_util_net, 'credit_amount', 0, 'line_description', 'Reverse incorrect credit on Utilities'),
        jsonb_build_object('account_code', '1101', 'debit_amount', 0, 'credit_amount', v_util_net, 'line_description', 'Offset to cash')
      ),
      v_actor_profile_id
    );
    RAISE NOTICE '6202 correction: %', v_fix;
  ELSE
    RAISE NOTICE '6202 Utilities balance OK (no credit-only reversal needed)';
  END IF;
END $$;

SELECT 'integrity_after_6202' AS section, get_gl_integrity_report() AS payload;
