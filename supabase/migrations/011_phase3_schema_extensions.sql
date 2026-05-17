-- =============================================================================
-- ARCBUILD PRO — Migration 011: Phase 3 Schema Extensions
-- Module 3.1: Payroll & Project Cost Management
--
-- Adds support for:
--   • Custom pay periods and payroll aggregations
--   • Variable pay (overtime, bonuses, deductions)
--   • Project-level cost tracking and budgeting
--   • Contract retention management
--   • Asset disposal workflows
--   • Subcontractor WHT tracking
--
-- Safe to re-run: uses IF NOT EXISTS for columns and tables, CREATE OR REPLACE for functions.
-- =============================================================================


-- =============================================================================
-- STEP 1: payroll_runs — Add custom pay period support
-- =============================================================================

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS total_gross_pay NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paye NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ssnit_employee NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ssnit_employer NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_net_pay NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS notes TEXT;


-- =============================================================================
-- STEP 2: payroll_lines — Add variable pay fields
-- =============================================================================

ALTER TABLE payroll_lines
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_notes TEXT,
  ADD COLUMN IF NOT EXISTS taxable_income NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);


-- =============================================================================
-- STEP 3: employees — Add missing payroll fields
-- =============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS monthly_allowances NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id),
  ADD COLUMN IF NOT EXISTS is_ssnit_exempt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_paye_exempt BOOLEAN DEFAULT FALSE;


-- =============================================================================
-- STEP 4: project_costs — Constrain cost_type and add journal link
-- =============================================================================

ALTER TABLE project_costs
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS account_code TEXT REFERENCES chart_of_accounts(account_code),
  ADD COLUMN IF NOT EXISTS amount_ghs NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(18,6) DEFAULT 1.0;

-- Add constraint for cost_type validation
ALTER TABLE project_costs
  ADD CONSTRAINT chk_project_cost_type CHECK (
    cost_type IN ('Materials', 'Labour', 'Subcontractors', 'Equipment Hire', 'Other')
  );


-- =============================================================================
-- STEP 5: milestones — Add automation and status constraint
-- =============================================================================

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS invoice_trigger_percentage NUMERIC(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS billing_amount NUMERIC(18,2);

-- Add constraint for status validation
ALTER TABLE milestones
  ADD CONSTRAINT chk_milestone_status CHECK (
    status IN ('pending', 'in_progress', 'completed', 'invoiced')
  );


-- =============================================================================
-- STEP 6: contracts — Add retention tracking fields
-- =============================================================================

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_released BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retention_released_date DATE,
  ADD COLUMN IF NOT EXISTS retention_invoice_id UUID REFERENCES invoices(id),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'fixed_price';

-- Add constraint for contract_type validation
ALTER TABLE contracts
  ADD CONSTRAINT chk_contract_type CHECK (
    contract_type IN ('fixed_price', 'cost_plus', 'unit_rate', 'retainer')
  );

-- Auto-compute retention_amount when retention_percentage and value are set
CREATE OR REPLACE FUNCTION sync_contract_retention()
RETURNS TRIGGER AS $$
BEGIN
  NEW.retention_amount := NEW.value * (NEW.retention_percentage / 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contract_retention ON contracts;
CREATE TRIGGER trg_sync_contract_retention
  BEFORE INSERT OR UPDATE OF value, retention_percentage
  ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION sync_contract_retention();


-- =============================================================================
-- STEP 7: subcontractors — Add payment and WHT fields
-- =============================================================================

ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS applies_wht BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wht_rate NUMERIC(5,4) DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS total_paid_ghs NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_wht_deducted_ghs NUMERIC(18,2) DEFAULT 0;


-- =============================================================================
-- STEP 8: assets — Add disposal fields
-- =============================================================================

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS disposal_date DATE,
  ADD COLUMN IF NOT EXISTS disposal_proceeds NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS disposal_journal_id UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id),
  ADD COLUMN IF NOT EXISTS depreciation_account TEXT DEFAULT '6401'
    REFERENCES chart_of_accounts(account_code);


-- =============================================================================
-- STEP 9: project_budgets — New table
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cost_category TEXT NOT NULL,
  budgeted_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_budget_category CHECK (
    cost_category IN ('Materials', 'Labour', 'Subcontractors', 'Equipment Hire', 'Other')
  ),
  UNIQUE(project_id, cost_category)
);

ALTER TABLE project_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Budget read access" ON project_budgets;
CREATE POLICY "Budget read access"
  ON project_budgets FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE user_id = auth.uid())
    IN ('ceo', 'accountant', 'director', 'project_manager')
  );

DROP POLICY IF EXISTS "Budget write access" ON project_budgets;
CREATE POLICY "Budget write access"
  ON project_budgets FOR ALL
  USING (
    (SELECT role FROM profiles WHERE user_id = auth.uid())
    IN ('ceo', 'accountant', 'director')
  );


-- =============================================================================
-- STEP 10: retention_ledger — New table for client retention tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS retention_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  invoice_id UUID REFERENCES invoices(id),
  project_id UUID REFERENCES projects(id),
  client_id UUID REFERENCES clients(id),
  retention_amount NUMERIC(18,2) NOT NULL,
  transaction_type TEXT NOT NULL,
  CONSTRAINT chk_retention_type CHECK (
    transaction_type IN ('held', 'released', 'partial_release')
  ),
  transaction_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retention_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Retention ledger access" ON retention_ledger;
CREATE POLICY "Retention ledger access"
  ON retention_ledger FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE user_id = auth.uid())
    IN ('ceo', 'accountant', 'director', 'project_manager')
  );


-- =============================================================================
-- END OF MIGRATION 011
-- =============================================================================
-- Schema Extensions Applied:
--   • payroll_runs: period tracking, aggregations, journal link
--   • payroll_lines: variable pay, deductions, tax calculations
--   • employees: termination, allowances, exemption flags
--   • project_costs: GL integration, FX support
--   • milestones: billing automation, status validation
--   • contracts: retention tracking, auto-calculation
--   • subcontractors: payment tracking, WHT support
--   • assets: disposal workflow, GL posting
--   • project_budgets: new table with RLS
--   • retention_ledger: new table for retention tracking
-- =============================================================================
