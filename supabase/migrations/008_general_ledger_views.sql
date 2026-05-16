-- =============================================================================
-- ARCBUILD PRO — Migration 008: General Ledger Views + Indexes
-- Module 2.4
--
-- Creates read-optimized views for the General Ledger and per-account running
-- balances, plus performance indexes and grants for `authenticated` users.
-- =============================================================================

-- Helper: current user role (lightweight; relies on profiles.user_id = auth.uid())
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
    SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- View: general_ledger
-- A flattened view combining journal_entries and ledger_entries for UI queries.
-- Columns chosen for direct consumption by the React components.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW general_ledger AS
SELECT
    le.id AS ledger_id,
    je.id AS journal_entry_id,
    je.entry_date,
    je.entry_number,
    je.source_type,
    je.source_id,
    le.account_code,
    coa.account_name AS coa_account_name,
    le.account_name,
    le.description,
    le.client_id,
    le.project_id,
    le.division_id,
    le.currency,
    le.foreign_amount,
    le.fx_rate,
    le.debit_amount,
    le.credit_amount,
    (le.debit_amount - le.credit_amount) AS amount,
    je.posted_by,
    je.created_by,
    le.created_at
FROM ledger_entries le
JOIN journal_entries je ON je.id = le.journal_entry_id
LEFT JOIN chart_of_accounts coa ON coa.account_code = le.account_code;

-- -----------------------------------------------------------------------------
-- View: account_running_balance
-- Running balance per account_code ordered by posting date then ledger id.
-- NOTE: Running balance is computed in GHS-equivalent amounts using debit/credit
-- which should already be stored in GHS in `debit_amount` / `credit_amount`.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW account_running_balance AS
SELECT
    ledger_id,
    account_code,
    entry_date,
    entry_number,
    description,
    client_id,
    project_id,
    division_id,
    debit_amount,
    credit_amount,
    (debit_amount - credit_amount) AS amount,
    SUM(debit_amount - credit_amount) OVER (
        PARTITION BY account_code
        ORDER BY COALESCE(entry_date, created_at), created_at, ledger_id
        ROWS UNBOUNDED PRECEDING
    ) AS running_balance
FROM (
    SELECT
        le.id AS ledger_id,
        le.account_code,
        je.entry_date,
        je.entry_number,
        le.description,
        le.client_id,
        le.project_id,
        le.division_id,
        le.debit_amount,
        le.credit_amount,
        le.created_at
    FROM ledger_entries le
    JOIN journal_entries je ON je.id = le.journal_entry_id
) s;

-- -----------------------------------------------------------------------------
-- Performance indexes referenced by Module 2.4
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account_date ON ledger_entries(account_code, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_division_project ON ledger_entries(division_id, project_id);

-- Grant select on views to authenticated role
GRANT SELECT ON general_ledger TO authenticated;
GRANT SELECT ON account_running_balance TO authenticated;

-- (Removed ALTER INDEX SET SCHEMA statements because some Postgres
-- environments reject them during migration execution.)

-- End of migration 008
