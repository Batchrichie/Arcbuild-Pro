-- =============================================================================
-- ARCBUILD PRO — Migration 041: IAS 36 Impairment of Assets
-- Module 4.2: Receivable aging, impairment assessments, journal posting, and asset impairment indicators
--
-- Creates impairment tables, aging engine, impairment posting functions, and IFRS-friendly GL account seeds.
-- Safe to re-run: uses CREATE OR REPLACE FUNCTION, ON CONFLICT DO NOTHING, and idempotent schema creation.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Seed impairment and receivable accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code)
VALUES
  ('6800', 'Impairment Loss Expense', 'expense', '6000'),
  ('1112', 'Input VAT Receivable', 'asset', '1100'),
  ('1141', 'Inventory Write-down', 'asset', '1100'),
  ('1211', 'Accumulated Depreciation', 'asset', '1200')
ON CONFLICT (account_code) DO NOTHING;

-- =============================================================================
-- Impairment assessment schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS impairment_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('receivable', 'inventory', 'fixed_asset')),
  basis TEXT NOT NULL CHECK (basis IN ('aging', 'indicator')),
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  carrying_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  recoverable_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  impairment_loss NUMERIC(18, 2) GENERATED ALWAYS AS (GREATEST(0, carrying_amount - recoverable_amount)) STORED,
  notes TEXT,
  posted BOOLEAN NOT NULL DEFAULT FALSE,
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invoice_id, basis, assessment_date)
);

CREATE INDEX IF NOT EXISTS idx_impairment_assessments_project_id ON impairment_assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_impairment_assessments_invoice_id ON impairment_assessments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_impairment_assessments_asset_id ON impairment_assessments(asset_id);
CREATE INDEX IF NOT EXISTS idx_impairment_assessments_asset_type ON impairment_assessments(asset_type);

-- =============================================================================
-- Receivable aging schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS receivable_aging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  run_date DATE NOT NULL,
  due_date DATE NOT NULL,
  days_overdue INTEGER GENERATED ALWAYS AS (GREATEST(0, run_date - due_date)) STORED,
  aging_bucket TEXT GENERATED ALWAYS AS (
    CASE
      WHEN GREATEST(0, run_date - due_date) = 0 THEN 'current'
      WHEN GREATEST(0, run_date - due_date) <= 30 THEN '1-30'
      WHEN GREATEST(0, run_date - due_date) <= 60 THEN '31-60'
      WHEN GREATEST(0, run_date - due_date) <= 90 THEN '61-90'
      ELSE '90+'
    END
  ) STORED,
  invoice_amount NUMERIC(18, 2) NOT NULL,
  expected_receipt_ghs NUMERIC(18, 2) NOT NULL,
  provision_rate NUMERIC(5, 4) GENERATED ALWAYS AS (
    CASE
      WHEN GREATEST(0, run_date - due_date) = 0 THEN 0
      WHEN GREATEST(0, run_date - due_date) <= 30 THEN 0.02
      WHEN GREATEST(0, run_date - due_date) <= 60 THEN 0.05
      WHEN GREATEST(0, run_date - due_date) <= 90 THEN 0.15
      ELSE 0.50
    END
  ) STORED,
  provision_amount NUMERIC(18, 2) GENERATED ALWAYS AS (
    ROUND(
      expected_receipt_ghs * (
        CASE
          WHEN GREATEST(0, run_date - due_date) = 0 THEN 0
          WHEN GREATEST(0, run_date - due_date) <= 30 THEN 0.02
          WHEN GREATEST(0, run_date - due_date) <= 60 THEN 0.05
          WHEN GREATEST(0, run_date - due_date) <= 90 THEN 0.15
          ELSE 0.50
        END
      ),
      2
    )
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invoice_id, run_date)
);

CREATE INDEX IF NOT EXISTS idx_receivable_aging_invoice_id ON receivable_aging(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receivable_aging_run_date ON receivable_aging(run_date);
CREATE INDEX IF NOT EXISTS idx_receivable_aging_project_id ON receivable_aging(project_id);

-- =============================================================================
-- FUNCTION: run_receivables_aging
-- Populates receivable aging and creates impairment assessments on aging basis.
-- =============================================================================

CREATE OR REPLACE FUNCTION run_receivables_aging(p_run_date DATE)
RETURNS JSONB AS $$
DECLARE
  actor_profile profiles%ROWTYPE;
  assessment_count INTEGER := 0;
BEGIN
  SELECT * INTO actor_profile FROM profiles WHERE user_id = auth.uid();
  IF actor_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  INSERT INTO receivable_aging (
    invoice_id,
    project_id,
    client_id,
    run_date,
    due_date,
    invoice_amount,
    expected_receipt_ghs
  )
  SELECT
    i.id,
    i.project_id,
    i.client_id,
    p_run_date,
    i.due_date,
    COALESCE(i.gross_total_ghs, 0),
    COALESCE(i.expected_receipt_ghs, COALESCE(i.gross_total_ghs, 0))
  FROM invoices i
  WHERE i.due_date IS NOT NULL
    AND COALESCE(i.expected_receipt_ghs, COALESCE(i.gross_total_ghs, 0)) > 0
    AND i.status::text IN ('approved', 'sent', 'partially_paid')
  ON CONFLICT (invoice_id, run_date) DO UPDATE
    SET project_id = EXCLUDED.project_id,
        client_id = EXCLUDED.client_id,
        due_date = EXCLUDED.due_date,
        invoice_amount = EXCLUDED.invoice_amount,
        expected_receipt_ghs = EXCLUDED.expected_receipt_ghs,
        created_at = NOW();

  INSERT INTO impairment_assessments (
    project_id,
    invoice_id,
    asset_type,
    basis,
    assessment_date,
    carrying_amount,
    recoverable_amount,
    notes,
    created_by
  )
  SELECT
    ra.project_id,
    ra.invoice_id,
    'receivable',
    'aging',
    p_run_date,
    ra.expected_receipt_ghs,
    ROUND(ra.expected_receipt_ghs * (1 - ra.provision_rate), 2),
    'Aging-based impairment assessment generated from receivable aging.',
    actor_profile.id
  FROM receivable_aging ra
  WHERE ra.run_date = p_run_date
  ON CONFLICT (invoice_id, basis, assessment_date) DO NOTHING;

  GET DIAGNOSTICS assessment_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'run_date', p_run_date,
    'records_processed', (SELECT COUNT(*) FROM receivable_aging WHERE run_date = p_run_date),
    'assessments_created', assessment_count
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION run_receivables_aging(DATE) TO authenticated;

-- =============================================================================
-- FUNCTION: post_impairment_journal
-- Posts impairment expense and reduces the carrying asset by asset type.
-- =============================================================================

CREATE OR REPLACE FUNCTION post_impairment_journal(p_assessment_id UUID)
RETURNS JSONB AS $$
DECLARE
  a impairment_assessments%ROWTYPE;
  actor profiles%ROWTYPE;
  journal_id UUID;
  credit_account TEXT;
  credit_account_name TEXT;
  impairment_amount NUMERIC;
BEGIN
  SELECT * INTO a FROM impairment_assessments WHERE id = p_assessment_id;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impairment assessment not found');
  END IF;

  IF a.posted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impairment assessment already posted');
  END IF;

  SELECT * INTO actor FROM profiles WHERE user_id = auth.uid();
  IF actor.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  impairment_amount := a.impairment_loss;
  IF impairment_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No impairment loss to post');
  END IF;

  credit_account := CASE a.asset_type
    WHEN 'receivable' THEN '1112'
    WHEN 'inventory' THEN '1141'
    WHEN 'fixed_asset' THEN '1211'
    ELSE '1112'
  END;

  credit_account_name := CASE a.asset_type
    WHEN 'receivable' THEN 'Input VAT Receivable'
    WHEN 'inventory' THEN 'Inventory Write-down'
    WHEN 'fixed_asset' THEN 'Accumulated Depreciation'
    ELSE 'Input VAT Receivable'
  END;

  INSERT INTO journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    posted_by, created_by
  ) VALUES (
    CURRENT_DATE,
    'Impairment loss posting for assessment ' || a.id,
    'IMPAIR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(a.id::text, 1, 8),
    'impairment', p_assessment_id,
    actor.id, actor.id
  ) RETURNING id INTO journal_id;

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id, client_id
  ) VALUES (
    journal_id, '6800', 'Impairment Loss Expense',
    impairment_amount, 0,
    'Impairment expense for assessment ' || a.id,
    a.project_id, NULL, a.invoice_id
  );

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id, client_id
  ) VALUES (
    journal_id, credit_account, credit_account_name,
    0, impairment_amount,
    'Impairment reduction for assessment ' || a.id,
    a.project_id, NULL, a.invoice_id
  );

  UPDATE impairment_assessments
  SET posted = TRUE,
      posted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_assessment_id;

  INSERT INTO audit_log (
    table_name, record_id, action, actor_id, details
  ) VALUES (
    'impairment_assessments', p_assessment_id, 'IMPAIRMENT_POSTED', actor.id,
    jsonb_build_object(
      'asset_type', a.asset_type,
      'impairment_amount', impairment_amount,
      'journal_entry_id', journal_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'assessment_id', p_assessment_id,
    'journal_entry_id', journal_id,
    'amount_posted', impairment_amount
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_impairment_journal(UUID) TO authenticated;

-- =============================================================================
-- FUNCTION: check_asset_impairment_indicators
-- Returns common impairment indicators for fixed assets.
-- =============================================================================

CREATE OR REPLACE FUNCTION check_asset_impairment_indicators(p_asset_id UUID)
RETURNS JSONB AS $$
DECLARE
  asset_rec assets%ROWTYPE;
  project_status TEXT;
  market_decline BOOLEAN := FALSE;
  utilization_low BOOLEAN := FALSE;
  project_cancelled BOOLEAN := FALSE;
  carrying_exceeds_market BOOLEAN := FALSE;
BEGIN
  SELECT * INTO asset_rec FROM assets WHERE id = p_asset_id;
  IF asset_rec.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asset not found');
  END IF;

  IF asset_rec.project_id IS NOT NULL THEN
    SELECT status INTO project_status FROM projects WHERE id = asset_rec.project_id;
  END IF;

  market_decline := asset_rec.net_book_value < asset_rec.cost * 0.75;
  utilization_low := asset_rec.is_disposed OR asset_rec.project_id IS NULL;
  project_cancelled := project_status = 'cancelled';
  carrying_exceeds_market := asset_rec.net_book_value > asset_rec.cost * 0.95;

  RETURN jsonb_build_object(
    'asset_id', asset_rec.id,
    'market_decline', market_decline,
    'utilization_low', utilization_low,
    'project_cancelled', project_cancelled,
    'carrying_exceeds_market', carrying_exceeds_market,
    'indicators_found', market_decline OR utilization_low OR project_cancelled OR carrying_exceeds_market
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_asset_impairment_indicators(UUID) TO authenticated;

-- =============================================================================
-- FUNCTION: reverse_impairment_assessment
-- Reverses impairment entries and adjusts the assessment recoverable amount.
-- =============================================================================

CREATE OR REPLACE FUNCTION reverse_impairment_assessment(p_assessment_id UUID, p_reversal_amount NUMERIC)
RETURNS JSONB AS $$
DECLARE
  a impairment_assessments%ROWTYPE;
  actor profiles%ROWTYPE;
  journal_id UUID;
  credit_account TEXT;
  credit_account_name TEXT;
  reversal_amount NUMERIC;
BEGIN
  SELECT * INTO a FROM impairment_assessments WHERE id = p_assessment_id;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impairment assessment not found');
  END IF;

  SELECT * INTO actor FROM profiles WHERE user_id = auth.uid();
  IF actor.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  reversal_amount := ROUND(COALESCE(p_reversal_amount, 0), 2);
  IF reversal_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reversal amount must be positive');
  END IF;
  IF reversal_amount > a.impairment_loss THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reversal amount exceeds impairment loss');
  END IF;

  credit_account := CASE a.asset_type
    WHEN 'receivable' THEN '1112'
    WHEN 'inventory' THEN '1141'
    WHEN 'fixed_asset' THEN '1211'
    ELSE '1112'
  END;

  credit_account_name := CASE a.asset_type
    WHEN 'receivable' THEN 'Input VAT Receivable'
    WHEN 'inventory' THEN 'Inventory Write-down'
    WHEN 'fixed_asset' THEN 'Accumulated Depreciation'
    ELSE 'Input VAT Receivable'
  END;

  INSERT INTO journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    posted_by, created_by
  ) VALUES (
    CURRENT_DATE,
    'Impairment reversal for assessment ' || a.id,
    'IMPAIR-REV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(a.id::text, 1, 8),
    'impairment_reversal', p_assessment_id,
    actor.id, actor.id
  ) RETURNING id INTO journal_id;

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id, client_id
  ) VALUES (
    journal_id, credit_account, credit_account_name,
    reversal_amount, 0,
    'Impairment reversal debit for assessment ' || a.id,
    a.project_id, NULL, a.invoice_id
  );

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id, client_id
  ) VALUES (
    journal_id, '6800', 'Impairment Loss Expense',
    0, reversal_amount,
    'Impairment reversal credit for assessment ' || a.id,
    a.project_id, NULL, a.invoice_id
  );

  UPDATE impairment_assessments
  SET recoverable_amount = recoverable_amount + reversal_amount,
      updated_at = NOW(),
      posted = (GREATEST(0, carrying_amount - (recoverable_amount + reversal_amount)) > 0)
  WHERE id = p_assessment_id;

  INSERT INTO audit_log (
    table_name, record_id, action, actor_id, details
  ) VALUES (
    'impairment_assessments', p_assessment_id, 'IMPAIRMENT_REVERSED', actor.id,
    jsonb_build_object(
      'reversal_amount', reversal_amount,
      'journal_entry_id', journal_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'assessment_id', p_assessment_id,
    'journal_entry_id', journal_id,
    'reversal_amount', reversal_amount
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reverse_impairment_assessment(UUID, NUMERIC) TO authenticated;

-- =============================================================================
-- RLS policies
-- =============================================================================

ALTER TABLE impairment_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_aging ENABLE ROW LEVEL SECURITY;

CREATE POLICY impairment_assessments_admin_select ON impairment_assessments FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY impairment_assessments_pm_select ON impairment_assessments FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY impairment_assessments_admin_insert ON impairment_assessments FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY receivable_aging_admin_select ON receivable_aging FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY receivable_aging_pm_select ON receivable_aging FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY receivable_aging_admin_insert ON receivable_aging FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));
