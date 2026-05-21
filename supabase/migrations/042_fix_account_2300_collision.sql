-- =============================================================================
-- Migration 042: Fix account 2300 collision with retention
-- Reclassifies retention ledger entries from 2300 to 2109 and
-- ensures account definitions for 2300 and 2109 are correct.
-- =============================================================================

-- Ensure the correct account definitions exist
INSERT INTO chart_of_accounts (account_code, account_name, account_type)
VALUES
  ('2109', 'Retention Payable', 'liability'),
  ('2300', 'Advance Billings / Contract Liabilities', 'liability')
ON CONFLICT (account_code) DO UPDATE
SET account_name = EXCLUDED.account_name,
    account_type = EXCLUDED.account_type;

-- Reclassify existing ledger entries for retention transactions
UPDATE ledger_entries le
SET account_code = '2109',
    account_name = (SELECT account_name FROM chart_of_accounts WHERE account_code = '2109')
FROM journal_entries je
WHERE le.journal_entry_id = je.id
  AND le.account_code = '2300'
  AND (
    je.source_type IN ('retention_withheld', 'retention_released', 'subcontractor_retention')
    OR le.description ILIKE '%retention%'
  );

-- Optional cleanup: if any 2300 rows remain for non-retention activity, they remain unchanged.
