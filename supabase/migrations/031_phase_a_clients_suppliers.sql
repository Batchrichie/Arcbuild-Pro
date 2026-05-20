-- =============================================================================
-- Migration 031: Phase A Clients and Suppliers
-- Adds missing client fields, creates suppliers, links supplier relationships,
-- and adds RLS policies for clients and suppliers.
-- =============================================================================

-- Section 1 — Add missing columns to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'Company'
      CHECK (client_type IN ('Company','Individual','Government')),
  ADD COLUMN IF NOT EXISTS tin TEXT,
  ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS',
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Ghana',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active'
      CHECK (status IN ('Active','Inactive','Blacklisted')),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Section 2 — RLS for clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_admin ON clients;
DROP POLICY IF EXISTS clients_pm_read ON clients;
DROP POLICY IF EXISTS clients_self ON clients;

CREATE POLICY clients_admin ON clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('ceo','accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('ceo','accountant')
    )
  );

CREATE POLICY clients_pm_read ON clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role = 'project_manager'
    )
  );

CREATE POLICY clients_self ON clients
  FOR SELECT
  USING (
    contact_email = (
      SELECT contact_email FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Section 3 — Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  supplier_type    TEXT DEFAULT 'Vendor'
      CHECK (supplier_type IN ('Vendor','Subcontractor','Professional Service','Utility')),
  tin              TEXT,
  vat_registered   BOOLEAN DEFAULT FALSE,
  vat_number       TEXT,
  wht_applicable   BOOLEAN DEFAULT TRUE,
  wht_rate         NUMERIC(5,2) DEFAULT 5.00,
  payment_terms    INTEGER DEFAULT 30,
  currency         TEXT DEFAULT 'GHS',
  contact_person   TEXT,
  contact_phone    TEXT,
  contact_email    TEXT,
  address          TEXT,
  region           TEXT,
  country          TEXT DEFAULT 'Ghana',
  bank_name        TEXT,
  bank_account_no  TEXT,
  bank_branch      TEXT,
  credit_limit     NUMERIC(15,2) DEFAULT 0,
  status           TEXT DEFAULT 'Active'
      CHECK (status IN ('Active','Inactive','Blacklisted')),
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name   ON suppliers (name);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers (status);

-- Section 4 — Link suppliers to existing tables
ALTER TABLE project_costs
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Section 5 — RLS for suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_admin ON suppliers;
DROP POLICY IF EXISTS suppliers_pm_read ON suppliers;

CREATE POLICY suppliers_admin ON suppliers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('ceo','accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('ceo','accountant')
    )
  );

CREATE POLICY suppliers_pm_read ON suppliers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role = 'project_manager'
    )
  );
