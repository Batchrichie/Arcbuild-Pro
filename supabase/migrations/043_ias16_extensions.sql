-- =============================================================================
-- ARCBUILD PRO — Migration 043: IAS 16 Extensions
-- Module 4.4: Revaluation model, component depreciation, and asset roll-forward.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- Extend assets for IAS 16 revaluation model
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE assets ADD COLUMN measurement_model TEXT NOT NULL DEFAULT 'cost';
  ALTER TABLE assets ADD COLUMN last_revaluation_date DATE;
  ALTER TABLE assets ADD COLUMN revalued_amount NUMERIC(18,2);
  ALTER TABLE assets ADD COLUMN revaluation_surplus NUMERIC(18,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assets ADD CONSTRAINT assets_measurement_model_chk CHECK (
    measurement_model IN ('cost', 'revaluation')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Asset component table for component-level depreciation
-- =============================================================================

CREATE TABLE IF NOT EXISTS asset_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  useful_life_years INTEGER NOT NULL DEFAULT 1,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line'
    CHECK (depreciation_method IN ('straight_line', 'reducing_balance')),
  accumulated_depreciation NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_disposed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_components_parent_asset_id ON asset_components(parent_asset_id);

-- =============================================================================
-- Asset revaluations tracker
-- =============================================================================

CREATE TABLE IF NOT EXISTS asset_revaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  revaluation_date DATE NOT NULL,
  carrying_amount_before NUMERIC(18,2) NOT NULL,
  fair_value NUMERIC(18,2) NOT NULL,
  surplus_or_deficit NUMERIC(18,2) GENERATED ALWAYS AS (
    fair_value - carrying_amount_before
  ) STORED,
  valuer_name TEXT,
  posted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_revaluations_asset_id ON asset_revaluations(asset_id);

-- =============================================================================
-- Chart of accounts seeds for IAS 16
-- =============================================================================

INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code)
VALUES
  ('3300', 'Revaluation Surplus – Equity', 'equity', '3000'),
  ('6700', 'Revaluation Deficit / Loss', 'expense', '6000')
ON CONFLICT (account_code) DO NOTHING;

-- =============================================================================
-- RLS policies for IAS 16 asset tables
-- =============================================================================

ALTER TABLE asset_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_revaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_components_admin_select ON asset_components FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY asset_components_pm_select ON asset_components FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND parent_asset_id IN (
      SELECT id FROM assets
      WHERE project_id IN (
        SELECT project_id FROM project_assignments
        WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY asset_components_admin_insert ON asset_components FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY asset_revaluations_admin_select ON asset_revaluations FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY asset_revaluations_pm_select ON asset_revaluations FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND asset_id IN (
      SELECT id FROM assets
      WHERE project_id IN (
        SELECT project_id FROM project_assignments
        WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY asset_revaluations_admin_insert ON asset_revaluations FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

-- =============================================================================
-- FUNCTION: post_revaluation_journal
-- Posts revaluation surplus or deficit and resets accumulated depreciation.
-- =============================================================================

CREATE OR REPLACE FUNCTION post_revaluation_journal(p_revaluation_id UUID)
RETURNS JSONB AS $$
DECLARE
  r asset_revaluations%ROWTYPE;
  a assets%ROWTYPE;
  actor profiles%ROWTYPE;
  journal_id UUID;
  surplus_amount NUMERIC := 0;
  deficit_amount NUMERIC := 0;
  remaining_deficit NUMERIC := 0;
  prior_surplus NUMERIC := 0;
BEGIN
  SELECT * INTO r FROM asset_revaluations WHERE id = p_revaluation_id;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Revaluation record not found');
  END IF;

  IF r.posted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Revaluation already posted');
  END IF;

  SELECT * INTO a FROM assets WHERE id = r.asset_id;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asset not found');
  END IF;

  SELECT * INTO actor FROM profiles WHERE user_id = auth.uid();
  IF actor.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  prior_surplus := COALESCE(a.revaluation_surplus, 0);

  INSERT INTO journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    posted_by, created_by
  ) VALUES (
    r.revaluation_date,
    'Asset Revaluation — ' || a.asset_name,
    'REVAL-' || TO_CHAR(r.revaluation_date, 'YYYYMMDD') || '-' || SUBSTRING(r.id::text, 1, 8),
    'asset_revaluation', p_revaluation_id,
    actor.id, actor.id
  ) RETURNING id INTO journal_id;

  IF r.surplus_or_deficit > 0 THEN
    surplus_amount := r.surplus_or_deficit;

    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id, division_id
    ) VALUES (
      journal_id, '1210', 'Property, Plant & Equipment',
      surplus_amount, 0,
      'Revaluation surplus increase — ' || a.asset_name,
      a.project_id, a.division_id
    );

    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id, division_id
    ) VALUES (
      journal_id, '3300', 'Revaluation Surplus – Equity',
      0, surplus_amount,
      'Revaluation surplus credit — ' || a.asset_name,
      a.project_id, a.division_id
    );
  ELSIF r.surplus_or_deficit < 0 THEN
    deficit_amount := ABS(r.surplus_or_deficit);
    remaining_deficit := deficit_amount;

    IF prior_surplus > 0 THEN
      INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description, project_id, division_id
      ) VALUES (
        journal_id, '3300', 'Revaluation Surplus – Equity',
        LEAST(prior_surplus, remaining_deficit), 0,
        'Reverse prior revaluation surplus for ' || a.asset_name,
        a.project_id, a.division_id
      );

      INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description, project_id, division_id
      ) VALUES (
        journal_id, '1210', 'Property, Plant & Equipment',
        0, LEAST(prior_surplus, remaining_deficit),
        'Revaluation surplus reversal for ' || a.asset_name,
        a.project_id, a.division_id
      );

      remaining_deficit := remaining_deficit - LEAST(prior_surplus, remaining_deficit);
    END IF;

    IF remaining_deficit > 0 THEN
      INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description, project_id, division_id
      ) VALUES (
        journal_id, '6700', 'Revaluation Deficit / Loss',
        remaining_deficit, 0,
        'Revaluation deficit for ' || a.asset_name,
        a.project_id, a.division_id
      );

      INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount, description, project_id, division_id
      ) VALUES (
        journal_id, '1210', 'Property, Plant & Equipment',
        0, remaining_deficit,
        'Revaluation deficit recognition for ' || a.asset_name,
        a.project_id, a.division_id
      );
    END IF;
  END IF;

  UPDATE assets SET
    cost = r.fair_value,
    accumulated_depreciation = 0,
    net_book_value = r.fair_value,
    last_revaluation_date = r.revaluation_date,
    revalued_amount = r.fair_value,
    revaluation_surplus = GREATEST(prior_surplus + r.surplus_or_deficit, 0)
  WHERE id = a.id;

  UPDATE asset_revaluations
  SET posted = TRUE
  WHERE id = p_revaluation_id;

  INSERT INTO audit_log (
    table_name, record_id, action, actor_id, details
  ) VALUES (
    'asset_revaluations', p_revaluation_id, 'REVALUATION_POSTED', actor.id,
    jsonb_build_object(
      'asset_id', a.id,
      'fair_value', r.fair_value,
      'surplus_or_deficit', r.surplus_or_deficit
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'revaluation_id', p_revaluation_id,
    'asset_id', a.id,
    'surplus_or_deficit', r.surplus_or_deficit
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_revaluation_journal(UUID) TO authenticated;

-- =============================================================================
-- Asset roll-forward view
-- =============================================================================

CREATE OR REPLACE VIEW asset_roll_forward_view AS
SELECT
  a.id AS asset_id,
  a.asset_name,
  EXTRACT(YEAR FROM je.entry_date) AS fiscal_year,
  a.cost AS opening_cost,
  COALESCE(SUM(CASE WHEN le.account_code = '1210' AND le.debit_amount > 0 THEN le.debit_amount END), 0) AS additions,
  COALESCE(SUM(CASE WHEN le.account_code = '1210' AND le.credit_amount > 0 THEN le.credit_amount END), 0) AS disposals_cost,
  a.cost + COALESCE(SUM(CASE WHEN le.account_code = '1210' THEN le.debit_amount - le.credit_amount END), 0) AS closing_cost,
  0::numeric AS opening_accum_dep,
  COALESCE(SUM(CASE WHEN le.account_code = '1211' AND le.credit_amount > 0 THEN le.credit_amount END), 0) AS depreciation_charge,
  COALESCE(SUM(CASE WHEN le.account_code = '1211' AND le.debit_amount > 0 THEN le.debit_amount END), 0) AS disposals_accum_dep,
  a.accumulated_depreciation AS closing_accum_dep,
  a.net_book_value AS closing_nbv
FROM assets a
LEFT JOIN ledger_entries le ON le.project_id = a.project_id
  AND le.account_code IN ('1210', '1211')
LEFT JOIN journal_entries je ON je.id = le.journal_entry_id
GROUP BY a.id, a.asset_name, fiscal_year, a.cost, a.accumulated_depreciation, a.net_book_value;
