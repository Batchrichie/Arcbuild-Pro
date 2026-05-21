-- =============================================================================
-- Migration 029: Phase B Retention
-- Adds retention ledger enhancements, invoice retention fields,
-- retention GL accounts, and retention ledger row level security.
-- =============================================================================

-- Section B1.1 — Add columns to retention_ledger
ALTER TABLE retention_ledger
  ADD COLUMN IF NOT EXISTS retention_type     TEXT    DEFAULT 'client'
      CHECK (retention_type IN ('client', 'subcontractor')),
  ADD COLUMN IF NOT EXISTS status             TEXT    DEFAULT 'withheld'
      CHECK (status IN ('withheld', 'partially_released', 'fully_released', 'disputed')),
  ADD COLUMN IF NOT EXISTS withheld_amount    NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS released_amount    NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount     NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_id         UUID REFERENCES invoices(id),
  ADD COLUMN IF NOT EXISTS subcontractor_id   UUID REFERENCES subcontractors(id),
  ADD COLUMN IF NOT EXISTS supplier_id        UUID REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS release_date       DATE,
  ADD COLUMN IF NOT EXISTS release_invoice_id UUID REFERENCES invoices(id),
  ADD COLUMN IF NOT EXISTS notes              TEXT,
  ADD COLUMN IF NOT EXISTS created_by         UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_retention_project ON retention_ledger (project_id);
CREATE INDEX IF NOT EXISTS idx_retention_status  ON retention_ledger (status);
CREATE INDEX IF NOT EXISTS idx_retention_type    ON retention_ledger (retention_type);

-- Section B1.2 — Add retention columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS retention_rate       NUMERIC(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_withheld   NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_payable          NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS is_retention_invoice BOOLEAN DEFAULT FALSE;

-- Section B1.3 — Insert GL account codes
INSERT INTO chart_of_accounts (account_code, account_name, account_type) VALUES
  ('1300', 'Retention Receivable', 'asset'),
  ('2109', 'Retention Payable',    'liability')
ON CONFLICT (account_code) DO NOTHING;

-- Section B1.4 — Row Level Security for retention_ledger
ALTER TABLE retention_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retention_admin   ON retention_ledger;
DROP POLICY IF EXISTS retention_pm_read ON retention_ledger;

-- CEO and Accountant: full access
CREATE POLICY retention_admin ON retention_ledger
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('ceo', 'accountant')
    )
  );

-- Project Manager: read only
CREATE POLICY retention_pm_read ON retention_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role = 'project_manager'
    )
  );
