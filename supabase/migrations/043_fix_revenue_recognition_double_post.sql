-- =============================================================================
-- Migration 043: Fix double-posting in revenue recognition journal
-- Corrects the revenue recognition function to write directly to ledger_entries
-- and removes duplicate ledger entries created by the broken journal_lines mirror.
-- =============================================================================

-- Update the revenue recognition function to write only one set of ledger entries.
CREATE OR REPLACE FUNCTION post_revenue_recognition_journal(
  p_project_id UUID,
  p_pct_complete NUMERIC,
  p_contract_value NUMERIC,
  p_prior_recognised NUMERIC,
  p_cost_to_date NUMERIC,
  p_period_label TEXT,
  p_recognised_by UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_cumulative_rev NUMERIC := p_contract_value * (p_pct_complete / 100);
  v_period_rev NUMERIC := v_cumulative_rev - p_prior_recognised;
  v_invoiced_to_date NUMERIC := 0;
  v_contract_asset NUMERIC := 0;
  v_advance_billing NUMERIC := 0;
  v_journal_id UUID;
BEGIN
  -- Calculate invoiced to date (in GHS)
  SELECT COALESCE(SUM(gross_total_ghs), 0) INTO v_invoiced_to_date
    FROM invoices WHERE project_id = p_project_id AND status != 'voided';

  v_contract_asset := GREATEST(v_cumulative_rev - v_invoiced_to_date, 0);
  v_advance_billing := GREATEST(v_invoiced_to_date - v_cumulative_rev, 0);

  -- Insert journal header
  INSERT INTO journal_entries (source_type, source_id, is_posted, created_at)
  VALUES ('revenue_recognition', p_project_id, TRUE, NOW())
  RETURNING id INTO v_journal_id;

  -- Credit revenue (4600)
  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount, description, project_id, currency, created_at
  ) VALUES (
    v_journal_id,
    '4600',
    (SELECT account_name FROM chart_of_accounts WHERE account_code = '4600'),
    0,
    v_period_rev,
    'Revenue recognised for project ' || p_project_id,
    p_project_id,
    'GHS',
    NOW()
  );

  -- Debit either contract asset or advance billings
  IF v_contract_asset > 0 THEN
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id, currency, created_at
    ) VALUES (
      v_journal_id,
      '1400',
      (SELECT account_name FROM chart_of_accounts WHERE account_code = '1400'),
      v_period_rev,
      0,
      'Revenue recognised against contract asset for project ' || p_project_id,
      p_project_id,
      'GHS',
      NOW()
    );
  ELSIF v_advance_billing > 0 THEN
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id, currency, created_at
    ) VALUES (
      v_journal_id,
      '2300',
      (SELECT account_name FROM chart_of_accounts WHERE account_code = '2300'),
      v_period_rev,
      0,
      'Revenue recognised against advance billings for project ' || p_project_id,
      p_project_id,
      'GHS',
      NOW()
    );
  ELSE
    -- default to contract asset if neither positive (safe fallback)
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id, currency, created_at
    ) VALUES (
      v_journal_id,
      '1400',
      (SELECT account_name FROM chart_of_accounts WHERE account_code = '1400'),
      v_period_rev,
      0,
      'Revenue recognised against contract asset for project ' || p_project_id,
      p_project_id,
      'GHS',
      NOW()
    );
  END IF;

  -- Insert revenue_recognition record
  INSERT INTO revenue_recognition (
    project_id, recognition_date, period_label, pct_complete, contract_value,
    cumulative_revenue, prior_recognised, period_revenue, cost_to_date, gross_profit,
    journal_entry_id, completion_method, recognised_by, notes, created_at
  ) VALUES (
    p_project_id, CURRENT_DATE, p_period_label, p_pct_complete, p_contract_value,
    v_cumulative_rev, p_prior_recognised, v_period_rev, p_cost_to_date, NULL,
    v_journal_id, NULL, p_recognised_by, NULL, NOW()
  );

  -- Update project summary
  UPDATE projects SET
    pct_complete = p_pct_complete,
    revenue_to_recognise = v_cumulative_rev,
    revenue_recognised = v_cumulative_rev,
    actual_cost_to_date = p_cost_to_date,
    last_recognition_date = CURRENT_DATE
  WHERE id = p_project_id;

  RETURN v_journal_id;
END;
$$;

-- Remove duplicate ledger_entries created by the prior broken function.
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY journal_entry_id, account_code, debit_amount, credit_amount, created_at
           ORDER BY id
         ) AS rn
  FROM ledger_entries
)
DELETE FROM ledger_entries
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
