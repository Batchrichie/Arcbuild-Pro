-- =============================================================================
-- ARCBUILD PRO — Migration 014: Cost Tagging Engine
-- Module 3.2: Post costs to projects and general ledger automatically
--
-- Creates three functions:
--   1. get_cost_account_code(cost_type) — Maps cost type to GL account code
--   2. post_project_cost() — Records cost + posts double-entry journal
--   3. check_budget_variance() — Alerts on budget overrun before posting
--
-- Safe to re-run: uses CREATE OR REPLACE FUNCTION
-- =============================================================================


-- =============================================================================
-- FUNCTION 1: get_cost_account_code
-- Maps cost types to their GL expense accounts
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cost_account_code(cost_type_param text)
RETURNS text AS $$
BEGIN
  RETURN CASE cost_type_param
    WHEN 'Materials'      THEN '5101'
    WHEN 'Labour'         THEN '5103'
    WHEN 'Subcontractors' THEN '5102'
    WHEN 'Equipment Hire' THEN '5104'
    WHEN 'Other'          THEN '6203'
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION get_cost_account_code(text) TO authenticated;


-- =============================================================================
-- FUNCTION 2: post_project_cost
-- Records a project cost and posts a double-entry journal entry automatically
--
-- Args:
--   project_id_param: UUID of the project
--   cost_type_param: One of: Materials, Labour, Subcontractors, Equipment Hire, Other
--   description_param: Cost description
--   amount_param: Cost amount in original currency
--   currency_param: Currency code (GHS, USD, GBP, EUR)
--   date_incurred_param: Date cost was incurred
--   posted_by_param: UUID of user posting the cost
--   subcontractor_id_param: Optional UUID of subcontractor (for Subcontractors cost_type)
--   receipt_url_param: Optional URL to receipt document
--
-- Returns: JSONB with success/error status, cost_id, journal_entry_id, amount_ghs
-- =============================================================================

CREATE OR REPLACE FUNCTION post_project_cost(
  project_id_param uuid,
  cost_type_param text,
  description_param text,
  amount_param numeric,
  currency_param text,
  date_incurred_param date,
  posted_by_param uuid,
  subcontractor_id_param uuid DEFAULT NULL,
  receipt_url_param text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  account_code_val text;
  fx_rate_val numeric := 1.0;
  amount_ghs_val numeric;
  proj projects%ROWTYPE;
  actor_profile profiles%ROWTYPE;
  journal_id uuid;
  cost_id uuid;
  credit_account text := '2101';  -- Accounts Payable
BEGIN
  -- Validate cost type and get account code
  account_code_val := get_cost_account_code(cost_type_param);
  IF account_code_val IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid cost type: ' || cost_type_param);
  END IF;

  -- Get project record
  SELECT * INTO proj FROM projects WHERE id = project_id_param;
  IF proj.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  -- Get actor profile (current user)
  SELECT * INTO actor_profile FROM profiles WHERE user_id = posted_by_param;
  IF actor_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Get FX rate if foreign currency
  IF currency_param != 'GHS' THEN
    fx_rate_val := get_fx_rate(currency_param, date_incurred_param);
  END IF;
  amount_ghs_val := amount_param * fx_rate_val;

  -- Post journal entry
  INSERT INTO journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    posted_by, created_by
  ) VALUES (
    date_incurred_param,
    cost_type_param || ' cost — ' || proj.name,
    'PC-' || to_char(date_incurred_param, 'YYYYMMDD'),
    'project_cost', NULL,
    actor_profile.id, actor_profile.id
  ) RETURNING id INTO journal_id;

  -- DEBIT: Cost account (expense)
  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id,
    currency, foreign_amount, fx_rate
  ) VALUES (
    journal_id, account_code_val,
    (SELECT account_name FROM chart_of_accounts WHERE account_code = account_code_val),
    amount_ghs_val, 0,
    description_param, project_id_param, proj.division_id,
    currency_param, amount_param, fx_rate_val
  );

  -- CREDIT: Accounts Payable (liability)
  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id
  ) VALUES (
    journal_id, credit_account, 'Accounts Payable',
    0, amount_ghs_val,
    description_param, project_id_param, proj.division_id
  );

  -- Record in project_costs table
  INSERT INTO project_costs (
    project_id, cost_type, description,
    amount, currency, amount_ghs, fx_rate,
    subcontractor_id, receipt_url,
    date_incurred, posted_by,
    journal_entry_id, account_code,
    supplier_subcontractor
  ) VALUES (
    project_id_param, cost_type_param, description_param,
    amount_param, currency_param, amount_ghs_val, fx_rate_val,
    subcontractor_id_param, receipt_url_param,
    date_incurred_param, actor_profile.id,
    journal_id, account_code_val,
    CASE WHEN subcontractor_id_param IS NOT NULL THEN
      (SELECT name FROM subcontractors WHERE id = subcontractor_id_param)
    ELSE NULL END
  ) RETURNING id INTO cost_id;

  -- Update journal source_id now that we have cost_id
  UPDATE journal_entries SET source_id = cost_id WHERE id = journal_id;

  -- Log to audit trail
  INSERT INTO audit_log (
    table_name, record_id, action, actor_id, details
  ) VALUES (
    'project_costs', cost_id, 'COST_POSTED', actor_profile.id,
    jsonb_build_object(
      'project_id', project_id_param,
      'cost_type', cost_type_param,
      'amount_ghs', amount_ghs_val,
      'account_code', account_code_val,
      'journal_entry_id', journal_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'cost_id', cost_id,
    'journal_entry_id', journal_id,
    'amount_ghs', amount_ghs_val
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_project_cost(uuid, text, text, numeric, text, date, uuid, uuid, text) TO authenticated;


-- =============================================================================
-- FUNCTION 3: check_budget_variance
-- Checks if a cost would push a category over budget and returns warning
--
-- Args:
--   project_id_param: UUID of the project
--   cost_type_param: Cost type (Materials, Labour, etc.)
--   new_amount_ghs: Amount in GHS to be added
--
-- Returns: JSONB with status (no_budget|on_track|at_risk|over_budget),
--          budget amount, spent to date, projected total, variance %
-- =============================================================================

CREATE OR REPLACE FUNCTION check_budget_variance(
  project_id_param uuid,
  cost_type_param text,
  new_amount_ghs numeric
)
RETURNS jsonb AS $$
DECLARE
  budget_amount numeric := 0;
  spent_amount numeric := 0;
  projected_total numeric;
  variance_pct numeric;
BEGIN
  -- Get budgeted amount for this category
  SELECT COALESCE(budgeted_amount, 0) INTO budget_amount
  FROM project_budgets
  WHERE project_id = project_id_param
    AND cost_category = cost_type_param;

  -- Get amount already spent in this category
  SELECT COALESCE(SUM(amount_ghs), 0) INTO spent_amount
  FROM project_costs
  WHERE project_id = project_id_param
    AND cost_type = cost_type_param;

  projected_total := spent_amount + new_amount_ghs;

  -- If no budget set, return warning
  IF budget_amount = 0 THEN
    RETURN jsonb_build_object(
      'status', 'no_budget',
      'message', 'No budget set for ' || cost_type_param
    );
  END IF;

  variance_pct := (projected_total / budget_amount) * 100;

  RETURN jsonb_build_object(
    'status', CASE
      WHEN variance_pct > 100 THEN 'over_budget'
      WHEN variance_pct > 90  THEN 'at_risk'
      ELSE 'on_track'
    END,
    'budget_amount', budget_amount,
    'spent_to_date', spent_amount,
    'this_cost', new_amount_ghs,
    'projected_total', projected_total,
    'variance_pct', ROUND(variance_pct, 2),
    'message', CASE
      WHEN variance_pct > 100 THEN
        cost_type_param || ' will be ' || ROUND(variance_pct - 100, 1) || '% over budget after this entry'
      WHEN variance_pct > 90 THEN
        cost_type_param || ' will reach ' || ROUND(variance_pct, 1) || '% of budget — approaching limit'
      ELSE 'Within budget'
    END
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_budget_variance(uuid, text, numeric) TO authenticated;


-- =============================================================================
-- RLS POLICIES for project_costs table
-- =============================================================================

-- Enable RLS if not already enabled
ALTER TABLE project_costs ENABLE ROW LEVEL SECURITY;

-- CEO, Accountant, Director: Full access to all project costs
DROP POLICY IF EXISTS project_costs_exec_access ON project_costs;
CREATE POLICY project_costs_exec_access ON project_costs
  FOR ALL USING (
    (SELECT role FROM profiles WHERE profiles.user_id = auth.uid()) IN ('ceo', 'accountant', 'director')
  );

-- Project Manager: See costs only for assigned projects
DROP POLICY IF EXISTS project_costs_pm_access ON project_costs;
CREATE POLICY project_costs_pm_access ON project_costs
  FOR ALL USING (
    (SELECT role FROM profiles WHERE profiles.user_id = auth.uid()) = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.project_id = project_costs.project_id
        AND project_assignments.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Employee: See costs only for projects they are assigned to
DROP POLICY IF EXISTS project_costs_employee_access ON project_costs;
CREATE POLICY project_costs_employee_access ON project_costs
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE profiles.user_id = auth.uid()) = 'employee'
    AND EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.project_id = project_costs.project_id
        AND project_assignments.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Client: No access to project costs (confidential)
-- (No policy needed — RLS defaults to deny if no policy matches)


-- =============================================================================
-- VERIFICATION QUERY
-- After migration applied, run:
-- select proname from pg_proc
-- where proname in ('post_project_cost', 'check_budget_variance', 'get_cost_account_code')
-- order by proname;
--
-- Expected: THREE rows (all three functions present)
-- =============================================================================
