-- Add opening balance support to the general ledger chart of accounts
ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS opening_balance numeric(18,2) NOT NULL DEFAULT 0;
