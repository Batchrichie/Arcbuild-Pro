-- =============================================================================
-- ARCBUILD PRO — Migration 040: IFRS 16 Lease Accounting
-- Module 4.1: Right-of-use assets, lease liabilities, monthly lease posting
--
-- Creates lease tables, schedule engine, journal posting functions, and IFRS-friendly chart of accounts.
-- Safe to re-run: uses CREATE OR REPLACE FUNCTION and ON CONFLICT DO NOTHING for seed inserts.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Lease asset and liability accounts for IFRS 16
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code)
VALUES
  ('1230', 'Right-of-Use Assets', 'asset', '1200'),
  ('1231', 'Accumulated Lease Depreciation', 'asset', '1200'),
  ('2400', 'Lease Liability', 'liability', '2200'),
  ('6402', 'Lease Depreciation Expense', 'expense', '6400'),
  ('6501', 'Lease Interest Expense', 'expense', '6500')
ON CONFLICT (account_code) DO NOTHING;

-- =============================================================================
-- Lease tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  lessor_id UUID REFERENCES clients(id),
  lease_term_months INTEGER NOT NULL CHECK (lease_term_months > 0),
  lease_commencement_date DATE NOT NULL,
  payment_amount NUMERIC NOT NULL CHECK (payment_amount >= 0),
  payment_frequency TEXT NOT NULL DEFAULT 'monthly',
  discount_rate NUMERIC NOT NULL CHECK (discount_rate >= 0),
  rou_asset_value NUMERIC,
  lease_liability_opening NUMERIC,
  outstanding_liability NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lease_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL,
  period_date DATE NOT NULL,
  opening_liability NUMERIC NOT NULL,
  interest_expense NUMERIC NOT NULL,
  principal_payment NUMERIC NOT NULL,
  cash_payment NUMERIC NOT NULL,
  closing_liability NUMERIC NOT NULL,
  rou_depreciation NUMERIC NOT NULL,
  posted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lease_id, period_number)
);

-- =============================================================================
-- FUNCTION 1: calculate_lease_schedule
-- Computes ROU asset and lease liability and seeds the payment schedule.
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_lease_schedule(p_lease_id UUID)
RETURNS JSONB AS $$
DECLARE
  l leases%ROWTYPE;
  monthly_rate NUMERIC;
  schedule_payment NUMERIC;
  opening_balance NUMERIC;
  period_opening_balance NUMERIC;
  closing_balance NUMERIC;
  interest_amt NUMERIC;
  principal_amt NUMERIC;
  depreciation_amt NUMERIC;
  period_date DATE;
  payment_count INTEGER;
  row_count INTEGER := 0;
BEGIN
  SELECT * INTO l FROM leases WHERE id = p_lease_id;
  IF l.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease not found');
  END IF;

  IF lower(l.payment_frequency) != 'monthly' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only monthly lease schedules are supported');
  END IF;

  payment_count := l.lease_term_months;
  IF payment_count <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid lease term');
  END IF;

  monthly_rate := l.discount_rate / 12;

  IF monthly_rate = 0 THEN
    schedule_payment := ROUND(l.payment_amount, 2);
    opening_balance := ROUND(l.payment_amount * payment_count, 2);
  ELSE
    opening_balance := ROUND(
      l.payment_amount * (1 - POWER(1 + monthly_rate, -payment_count)) / monthly_rate,
      2
    );
    schedule_payment := ROUND(l.payment_amount, 2);
  END IF;

  depreciation_amt := ROUND(opening_balance / payment_count, 2);

  UPDATE leases
  SET
    rou_asset_value = opening_balance,
    lease_liability_opening = opening_balance,
    outstanding_liability = opening_balance,
    updated_at = NOW()
  WHERE id = p_lease_id;

  DELETE FROM lease_schedules WHERE lease_id = p_lease_id;

  closing_balance := opening_balance;
  FOR row_count IN 1..payment_count LOOP
    period_opening_balance := closing_balance;
    period_date := (l.lease_commencement_date + (row_count - 1) * INTERVAL '1 month')::DATE;

    IF monthly_rate = 0 THEN
      interest_amt := 0;
      principal_amt := schedule_payment;
    ELSE
      interest_amt := ROUND(period_opening_balance * monthly_rate, 2);
      principal_amt := ROUND(schedule_payment - interest_amt, 2);
    END IF;

    IF row_count = payment_count THEN
      principal_amt := period_opening_balance;
      schedule_payment := ROUND(principal_amt + interest_amt, 2);
    END IF;

    closing_balance := ROUND(period_opening_balance + interest_amt - schedule_payment, 2);
    IF row_count = payment_count THEN
      closing_balance := 0;
    END IF;

    INSERT INTO lease_schedules (
      lease_id,
      period_number,
      period_date,
      opening_liability,
      interest_expense,
      principal_payment,
      cash_payment,
      closing_liability,
      rou_depreciation
    ) VALUES (
      p_lease_id,
      row_count,
      period_date,
      period_opening_balance,
      interest_amt,
      principal_amt,
      schedule_payment,
      closing_balance,
      depreciation_amt
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'lease_id', p_lease_id,
    'periods', payment_count,
    'rou_asset_value', opening_balance,
    'lease_liability_opening', opening_balance
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION calculate_lease_schedule(UUID) TO authenticated;

-- =============================================================================
-- FUNCTION 2: post_lease_journal_entry
-- Posts lease commencement and period journal entries for the selected lease schedule.
-- =============================================================================

CREATE OR REPLACE FUNCTION post_lease_journal_entry(
  p_lease_id UUID,
  p_period INTEGER
)
RETURNS JSONB AS $$
DECLARE
  l leases%ROWTYPE;
  s lease_schedules%ROWTYPE;
  proj projects%ROWTYPE;
  actor profiles%ROWTYPE;
  journal_id UUID;
  start_journal_id UUID;
  liability_reduction NUMERIC;
  payment_amount NUMERIC;
  period_label TEXT;
BEGIN
  SELECT * INTO l FROM leases WHERE id = p_lease_id;
  IF l.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease not found');
  END IF;

  SELECT * INTO s FROM lease_schedules WHERE lease_id = p_lease_id AND period_number = p_period;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease schedule period not found');
  END IF;

  IF s.posted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease schedule period already posted');
  END IF;

  SELECT * INTO proj FROM projects WHERE id = l.project_id;
  SELECT * INTO actor FROM profiles WHERE user_id = auth.uid();
  IF actor.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF p_period = 1 THEN
    INSERT INTO journal_entries (
      entry_date, description, reference,
      source_type, source_id,
      posted_by, created_by
    ) VALUES (
      l.lease_commencement_date,
      'Lease commencement for ' || COALESCE(proj.name, 'project'),
      'LEASE-START-' || TO_CHAR(l.lease_commencement_date, 'YYYYMM'),
      'lease', p_lease_id,
      actor.id, actor.id
    ) RETURNING id INTO start_journal_id;

    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount,
      description, project_id, division_id
    ) VALUES (
      start_journal_id, '1230', 'Right-of-Use Asset',
      COALESCE(l.rou_asset_value, 0), 0,
      'Lease commencement asset recognition', l.project_id, proj.division_id
    );

    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount,
      description, project_id, division_id
    ) VALUES (
      start_journal_id, '2400', 'Lease Liability',
      0, COALESCE(l.rou_asset_value, 0),
      'Lease commencement liability recognition', l.project_id, proj.division_id
    );
  END IF;

  payment_amount := s.cash_payment;
  liability_reduction := ROUND(s.principal_payment, 2);
  period_label := 'Lease period ' || p_period || ' for ' || COALESCE(proj.name, 'project');

  INSERT INTO journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    posted_by, created_by
  ) VALUES (
    s.period_date,
    period_label,
    'LEASE-' || TO_CHAR(s.period_date, 'YYYYMM') || '-' || p_period,
    'lease_payment', p_lease_id,
    actor.id, actor.id
  ) RETURNING id INTO journal_id;

  -- Depreciation expense entry
  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id
  ) VALUES (
    journal_id, '6402', 'Lease Depreciation Expense',
    s.rou_depreciation, 0,
    period_label || ' depreciation', l.project_id, proj.division_id
  );

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id
  ) VALUES (
    journal_id, '1231', 'Accumulated Lease Depreciation',
    0, s.rou_depreciation,
    period_label || ' accumulated depreciation', l.project_id, proj.division_id
  );

  -- Interest and lease liability reduction
  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id
  ) VALUES (
    journal_id, '6501', 'Lease Interest Expense',
    s.interest_expense, 0,
    period_label || ' interest', l.project_id, proj.division_id
  );

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id
  ) VALUES (
    journal_id, '2400', 'Lease Liability',
    liability_reduction, 0,
    period_label || ' liability reduction', l.project_id, proj.division_id
  );

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id
  ) VALUES (
    journal_id, '2100', 'Cash',
    0, payment_amount,
    period_label || ' cash payment', l.project_id, proj.division_id
  );

  UPDATE lease_schedules
  SET posted = TRUE,
      updated_at = NOW()
  WHERE id = s.id;

  UPDATE leases
  SET outstanding_liability = s.closing_liability,
      updated_at = NOW()
  WHERE id = p_lease_id;

  RETURN jsonb_build_object(
    'success', true,
    'journal_entry_id', journal_id,
    'lease_id', p_lease_id,
    'period_number', p_period,
    'payment_amount', payment_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_lease_journal_entry(UUID, INTEGER) TO authenticated;

-- =============================================================================
-- Lease RLS policies
-- =============================================================================

ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY leases_admin_select ON leases FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY leases_pm_select ON leases FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY leases_admin_insert ON leases FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY lease_schedules_admin_select ON lease_schedules FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY lease_schedules_pm_select ON lease_schedules FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND lease_id IN (
      SELECT id FROM leases WHERE project_id IN (
        SELECT project_id FROM project_assignments
        WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );
