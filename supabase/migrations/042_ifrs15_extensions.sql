-- =============================================================================
-- ARCBUILD PRO — Migration 042: IFRS 15 Extensions
-- Module 4.3: Performance obligations, variable consideration, contract modifications,
-- and revenue allocation for IFRS 15.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- IFRS 15 tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS performance_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  standalone_selling_price NUMERIC(15,2) NOT NULL,
  allocated_transaction_price NUMERIC(15,2),
  satisfaction_method TEXT NOT NULL DEFAULT 'over_time'
    CHECK (satisfaction_method IN ('over_time','point_in_time')),
  pct_complete NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed')),
  completion_evidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_obligations_project_id ON performance_obligations(project_id);

CREATE TABLE IF NOT EXISTS variable_consideration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  type TEXT NOT NULL CHECK (type IN ('bonus','penalty','discount','volume_rebate','claim')),
  description TEXT,
  estimated_amount NUMERIC(15,2) NOT NULL,
  constraint_applied BOOLEAN NOT NULL DEFAULT TRUE,
  probability NUMERIC(5,4),
  recognised_amount NUMERIC(15,2) GENERATED ALWAYS AS (
    CASE
      WHEN constraint_applied THEN 0
      ELSE estimated_amount * COALESCE(probability, 1)
    END
  ) STORED,
  effective_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variable_consideration_project_id ON variable_consideration(project_id);

CREATE TABLE IF NOT EXISTS contract_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  modification_date DATE NOT NULL,
  description TEXT NOT NULL,
  original_contract_value NUMERIC(15,2),
  modified_contract_value NUMERIC(15,2),
  price_change NUMERIC(15,2) GENERATED ALWAYS AS (
    modified_contract_value - original_contract_value
  ) STORED,
  accounting_treatment TEXT NOT NULL CHECK (
    accounting_treatment IN (
      'separate_contract',
      'prospective',
      'cumulative_catch_up'
    )
  ),
  approved_by TEXT,
  journal_posted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_modifications_project_id ON contract_modifications(project_id);

-- =============================================================================
-- IFRS 15 RLS policies
-- =============================================================================

ALTER TABLE performance_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_consideration ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY performance_obligations_admin_select ON performance_obligations FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY performance_obligations_pm_select ON performance_obligations FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY performance_obligations_admin_insert ON performance_obligations FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY variable_consideration_admin_select ON variable_consideration FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY variable_consideration_pm_select ON variable_consideration FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY variable_consideration_admin_insert ON variable_consideration FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY contract_modifications_admin_select ON contract_modifications FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY contract_modifications_pm_select ON contract_modifications FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY contract_modifications_admin_insert ON contract_modifications FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

-- =============================================================================
-- FUNCTION: allocate_transaction_price
-- Allocates contract revenue to performance obligations based on stand-alone selling prices.
-- =============================================================================

CREATE OR REPLACE FUNCTION allocate_transaction_price(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_project_contract_value NUMERIC := 0;
  v_total_ssp NUMERIC := 0;
  v_unconstrained_variable NUMERIC := 0;
  v_adjusted_transaction_price NUMERIC := 0;
  v_po performance_obligations%ROWTYPE;
  v_allocated NUMERIC := 0;
  v_allocations JSONB := '[]'::JSONB;
BEGIN
  SELECT contract_value INTO v_project_contract_value
    FROM projects WHERE id = p_project_id;
  IF v_project_contract_value IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  SELECT COALESCE(SUM(standalone_selling_price), 0) INTO v_total_ssp
    FROM performance_obligations WHERE project_id = p_project_id;

  IF v_total_ssp = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'adjusted_transaction_price', v_project_contract_value,
      'allocations', '[]'::JSONB
    );
  END IF;

  SELECT COALESCE(SUM(recognised_amount), 0) INTO v_unconstrained_variable
    FROM variable_consideration
    WHERE project_id = p_project_id
      AND constraint_applied = FALSE;

  v_adjusted_transaction_price := ROUND(v_project_contract_value + v_unconstrained_variable, 2);

  FOR v_po IN SELECT * FROM performance_obligations WHERE project_id = p_project_id LOOP
    v_allocated := ROUND(
      v_adjusted_transaction_price * (v_po.standalone_selling_price / v_total_ssp),
      2
    );

    UPDATE performance_obligations
    SET allocated_transaction_price = v_allocated
    WHERE id = v_po.id;

    v_allocations := v_allocations || jsonb_build_object(
      'performance_obligation_id', v_po.id,
      'allocated_transaction_price', v_allocated
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'adjusted_transaction_price', v_adjusted_transaction_price,
    'total_ssp', v_total_ssp,
    'allocations', v_allocations
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION allocate_transaction_price(UUID) TO authenticated;

-- =============================================================================
-- FUNCTION: record_contract_modification
-- Handles contract amendments using IFRS 15 treatment rules.
-- =============================================================================

CREATE OR REPLACE FUNCTION record_contract_modification(p_modification_id UUID)
RETURNS JSONB AS $$
DECLARE
  m contract_modifications%ROWTYPE;
  proj projects%ROWTYPE;
  v_old_total NUMERIC := 0;
  v_new_total NUMERIC := 0;
  v_revenue_delta NUMERIC := 0;
  v_journal_id UUID;
  v_row_count INT := 0;
BEGIN
  SELECT * INTO m FROM contract_modifications WHERE id = p_modification_id;
  IF m.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract modification not found');
  END IF;

  SELECT * INTO proj FROM projects WHERE id = m.project_id;
  IF proj.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  IF m.accounting_treatment = 'separate_contract' THEN
    INSERT INTO performance_obligations (
      project_id, description, standalone_selling_price,
      allocated_transaction_price, satisfaction_method,
      pct_complete, status, created_at
    ) VALUES (
      m.project_id,
      'Separate contract: ' || m.description,
      COALESCE(m.modified_contract_value, 0),
      COALESCE(m.modified_contract_value, 0),
      'over_time',
      0,
      'pending',
      NOW()
    );

    PERFORM allocate_transaction_price(m.project_id);

    UPDATE contract_modifications
    SET journal_posted = TRUE
    WHERE id = p_modification_id;

    RETURN jsonb_build_object('success', true, 'treatment', m.accounting_treatment);
  ELSIF m.accounting_treatment = 'prospective' THEN
    UPDATE projects
    SET contract_value = m.modified_contract_value
    WHERE id = m.project_id;

    PERFORM allocate_transaction_price(m.project_id);

    UPDATE contract_modifications
    SET journal_posted = TRUE
    WHERE id = p_modification_id;

    RETURN jsonb_build_object('success', true, 'treatment', m.accounting_treatment);
  ELSIF m.accounting_treatment = 'cumulative_catch_up' THEN
    SELECT COALESCE(MAX(cumulative_revenue), 0) INTO v_old_total
      FROM revenue_recognition
      WHERE project_id = m.project_id;

    UPDATE projects
    SET contract_value = m.modified_contract_value
    WHERE id = m.project_id;

    WITH recalc AS (
      SELECT
        id,
        pct_complete,
        ROUND((pct_complete / 100.0) * m.modified_contract_value, 2) AS new_cumulative,
        LAG(ROUND((pct_complete / 100.0) * m.modified_contract_value, 2), 1, 0) OVER (
          ORDER BY recognition_date, created_at, id
        ) AS new_prior
      FROM revenue_recognition
      WHERE project_id = m.project_id
    )
    UPDATE revenue_recognition r
    SET
      contract_value = m.modified_contract_value,
      cumulative_revenue = recalc.new_cumulative,
      prior_recognised = recalc.new_prior,
      period_revenue = recalc.new_cumulative - recalc.new_prior
    FROM recalc
    WHERE r.id = recalc.id;

    SELECT COALESCE(MAX(cumulative_revenue), 0) INTO v_new_total
      FROM revenue_recognition
      WHERE project_id = m.project_id;

    v_revenue_delta := v_new_total - v_old_total;

    IF v_revenue_delta <> 0 THEN
      INSERT INTO journal_entries (
        entry_date, description, reference,
        source_type, source_id, posted_by, created_by
      ) VALUES (
        CURRENT_DATE,
        'Contract modification catch-up for project ' || m.project_id,
        'MOD-CATCHUP-' || TO_CHAR(m.modification_date, 'YYYYMMDD') || '-' || SUBSTRING(m.id::text, 1, 8),
        'contract_modification', p_modification_id,
        NULL, NULL
      ) RETURNING id INTO v_journal_id;

      IF v_revenue_delta > 0 THEN
        INSERT INTO ledger_entries (
          journal_entry_id, account_code, account_name,
          debit_amount, credit_amount, description, project_id, created_at
        ) VALUES (
          v_journal_id,
          '1400',
          (SELECT account_name FROM chart_of_accounts WHERE account_code = '1400'),
          v_revenue_delta,
          0,
          'Catch-up revenue adjustment for project ' || m.project_id,
          m.project_id,
          NOW()
        );

        INSERT INTO ledger_entries (
          journal_entry_id, account_code, account_name,
          debit_amount, credit_amount, description, project_id, created_at
        ) VALUES (
          v_journal_id,
          '4600',
          (SELECT account_name FROM chart_of_accounts WHERE account_code = '4600'),
          0,
          v_revenue_delta,
          'Contract modification revenue catch-up',
          m.project_id,
          NOW()
        );
      ELSE
        INSERT INTO ledger_entries (
          journal_entry_id, account_code, account_name,
          debit_amount, credit_amount, description, project_id, created_at
        ) VALUES (
          v_journal_id,
          '4600',
          (SELECT account_name FROM chart_of_accounts WHERE account_code = '4600'),
          ABS(v_revenue_delta),
          0,
          'Negative revenue catch-up reversal for project ' || m.project_id,
          m.project_id,
          NOW()
        );

        INSERT INTO ledger_entries (
          journal_entry_id, account_code, account_name,
          debit_amount, credit_amount, description, project_id, created_at
        ) VALUES (
          v_journal_id,
          '1400',
          (SELECT account_name FROM chart_of_accounts WHERE account_code = '1400'),
          0,
          ABS(v_revenue_delta),
          'Contract asset reduction for negative catch-up',
          m.project_id,
          NOW()
        );
      END IF;
    END IF;

    UPDATE projects
    SET
      revenue_to_recognise = v_new_total,
      revenue_recognised = v_new_total
    WHERE id = m.project_id;

    PERFORM allocate_transaction_price(m.project_id);

    UPDATE contract_modifications
    SET journal_posted = TRUE
    WHERE id = p_modification_id;

    RETURN jsonb_build_object(
      'success', true,
      'treatment', m.accounting_treatment,
      'revenue_delta', v_revenue_delta
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unsupported accounting treatment');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_contract_modification(UUID) TO authenticated;
