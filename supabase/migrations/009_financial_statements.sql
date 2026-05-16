-- =============================================================================
-- ARCBUILD PRO — Migration 009: Financial Statements (Module 2.5)
--
-- Drops orphaned indexes from the legacy journal_lines table, then creates the
-- Trial Balance, Income Statement and Balance Sheet views and grants.
-- =============================================================================

-- Clean up orphaned indexes from journal_lines rename
DROP INDEX IF EXISTS idx_journal_lines_account_code;
DROP INDEX IF EXISTS idx_journal_lines_journal_entry_id;
DROP INDEX IF EXISTS idx_journal_lines_project_id;

-- -----------------------------------------------------------------------------
-- Trial Balance view
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW trial_balance AS
SELECT
  gl.account_code,
  gl.account_name,
  coa.account_type,
  SUM(gl.debit_amount)  AS total_debits,
  SUM(gl.credit_amount) AS total_credits,
  SUM(gl.debit_amount) - SUM(gl.credit_amount) AS net_balance
FROM general_ledger gl
JOIN chart_of_accounts coa ON coa.account_code = gl.account_code
GROUP BY gl.account_code, gl.account_name, coa.account_type
ORDER BY gl.account_code;

-- -----------------------------------------------------------------------------
-- Income Statement view (monthly periods, by division name)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW income_statement AS
SELECT
  gl.account_code,
  gl.account_name,
  coa.account_type,
  d.name AS division_name,
  SUM(gl.credit_amount) - SUM(gl.debit_amount) AS amount,
  DATE_TRUNC('month', gl.entry_date) AS period_month
FROM general_ledger gl
JOIN chart_of_accounts coa ON coa.account_code = gl.account_code
LEFT JOIN divisions d ON d.id = gl.division_id
WHERE coa.account_type IN ('revenue', 'expense')
GROUP BY
  gl.account_code, gl.account_name, coa.account_type,
  d.name, DATE_TRUNC('month', gl.entry_date)
ORDER BY gl.account_code;

-- -----------------------------------------------------------------------------
-- Balance Sheet view
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW balance_sheet AS
SELECT
  gl.account_code,
  gl.account_name,
  coa.account_type,
  SUM(gl.debit_amount) - SUM(gl.credit_amount) AS balance
FROM general_ledger gl
JOIN chart_of_accounts coa ON coa.account_code = gl.account_code
WHERE coa.account_type IN ('asset', 'liability', 'equity')
GROUP BY gl.account_code, gl.account_name, coa.account_type
ORDER BY gl.account_code;

-- Grants
GRANT SELECT ON trial_balance TO authenticated;
GRANT SELECT ON income_statement TO authenticated;
GRANT SELECT ON balance_sheet TO authenticated;

-- End of migration 009
