-- =============================================================================
-- ARCBUILD PRO — Migration 050: IAS 37 Provisions
-- Module 5.1: Provision accounting for IAS 37 and separation from IFRS 15 retention.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- IAS 37 provisions are distinct from IFRS 15 contract liabilities (retention).
-- Provisions represent legal or constructive obligations, while retention is a
-- contract liability arising from customer contract terms and revenue recognition.

CREATE TABLE IF NOT EXISTS provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  provision_type TEXT NOT NULL CHECK (provision_type IN (
    'warranty', 'legal', 'restructuring', 'site_restoration',
    'environmental', 'litigation', 'other'
  )),
  description TEXT,
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  additions NUMERIC(18,2) NOT NULL DEFAULT 0,
  utilisations NUMERIC(18,2) NOT NULL DEFAULT 0,
  releases NUMERIC(18,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(18,2) GENERATED ALWAYS AS (
    opening_balance + additions - utilisations - releases
  ) STORED,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provisions_project_id ON provisions(project_id);

INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code)
VALUES
  ('6900', 'Provision Expense', 'expense', '6000'),
  ('2500', 'Provisions', 'liability', '2200'),
  ('4700', 'Other Income', 'revenue', '4000')
ON CONFLICT (account_code) DO NOTHING;

ALTER TABLE provisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY provisions_admin_select ON provisions FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE POLICY provisions_pm_select ON provisions FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY provisions_admin_insert ON provisions FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

CREATE OR REPLACE FUNCTION post_provision_journal(
  p_provision_id UUID,
  p_movement_type TEXT,
  p_amount NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  prov provisions%ROWTYPE;
  actor profiles%ROWTYPE;
  journal_id UUID;
  current_balance NUMERIC;
  debit_account_code TEXT;
  debit_account_name TEXT;
  credit_account_code TEXT;
  credit_account_name TEXT;
  movement_description TEXT;
  movement_type_lower TEXT := lower(trim(p_movement_type));
BEGIN
  SELECT * INTO prov FROM provisions WHERE id = p_provision_id;
  IF prov.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Provision not found');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO actor FROM profiles WHERE user_id = auth.uid();
  IF actor.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  current_balance := prov.opening_balance + prov.additions - prov.utilisations - prov.releases;

  IF movement_type_lower = 'addition' THEN
    debit_account_code := '6900';
    debit_account_name := 'Provision Expense';
    credit_account_code := '2500';
    credit_account_name := 'Provisions';
    movement_description := 'Provision addition — ' || prov.provision_type;

    UPDATE provisions
    SET additions = additions + p_amount,
        updated_at = NOW()
    WHERE id = p_provision_id;

  ELSIF movement_type_lower = 'utilisation' THEN
    IF p_amount > current_balance THEN
      RETURN jsonb_build_object('success', false, 'error', 'Provision utilisation exceeds available balance');
    END IF;
    debit_account_code := '2500';
    debit_account_name := 'Provisions';
    credit_account_code := '1101';
    credit_account_name := 'Cash — GHS';
    movement_description := 'Provision utilisation — ' || prov.provision_type;

    UPDATE provisions
    SET utilisations = utilisations + p_amount,
        updated_at = NOW()
    WHERE id = p_provision_id;

  ELSIF movement_type_lower = 'release' THEN
    IF p_amount > current_balance THEN
      RETURN jsonb_build_object('success', false, 'error', 'Provision release exceeds available balance');
    END IF;
    debit_account_code := '2500';
    debit_account_name := 'Provisions';
    credit_account_code := '4700';
    credit_account_name := 'Other Income';
    movement_description := 'Provision release — ' || prov.provision_type;

    UPDATE provisions
    SET releases = releases + p_amount,
        updated_at = NOW()
    WHERE id = p_provision_id;

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid movement type');
  END IF;

  INSERT INTO journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    created_by, is_posted
  ) VALUES (
    CURRENT_DATE,
    movement_description,
    'PROV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_provision_id::text, 1, 8),
    'provision_movement', p_provision_id,
    actor.id, TRUE
  ) RETURNING id INTO journal_id;

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount, description, project_id
  ) VALUES (
    journal_id, debit_account_code, debit_account_name,
    p_amount, 0, movement_description, prov.project_id
  );

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount, description, project_id
  ) VALUES (
    journal_id, credit_account_code, credit_account_name,
    0, p_amount, movement_description, prov.project_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'provision_id', p_provision_id,
    'movement_type', movement_type_lower,
    'amount', p_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_provision_journal(UUID, TEXT, NUMERIC) TO authenticated;
