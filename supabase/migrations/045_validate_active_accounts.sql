-- =============================================================================
-- Migration 045: Validate active accounts for posting
-- Adds active-account validation for manual journals and automated posting paths.
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_active_accounts(account_codes TEXT[])
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM chart_of_accounts
    WHERE account_code = ANY(account_codes)
      AND is_active = false
  ) THEN
    RAISE EXCEPTION 'Cannot post to inactive account';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_manual_journal(
  description_param TEXT,
  entry_date_param DATE,
  reference_param TEXT,
  lines_param JSONB,
  actor_uuid UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_journal_id UUID;
  v_row JSONB;
  v_project_uuid UUID;
BEGIN
  -- basic validation
  IF lines_param IS NULL OR jsonb_array_length(lines_param) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No lines provided.');
  END IF;

  SELECT COALESCE(SUM((NULLIF(x->> 'debit_amount',''))::numeric),0)
    INTO v_total_debit
    FROM jsonb_array_elements(lines_param) AS x;

  SELECT COALESCE(SUM((NULLIF(x->> 'credit_amount',''))::numeric),0)
    INTO v_total_credit
    FROM jsonb_array_elements(lines_param) AS x;

  IF v_total_debit IS NULL THEN v_total_debit := 0; END IF;
  IF v_total_credit IS NULL THEN v_total_credit := 0; END IF;

  IF v_total_debit <> v_total_credit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Journal is not balanced.');
  END IF;

  PERFORM validate_active_accounts(ARRAY(
    SELECT DISTINCT TRIM(NULLIF(x->> 'account_code',''))
    FROM jsonb_array_elements(lines_param) AS x
    WHERE COALESCE(NULLIF(x->> 'account_code',''),'') <> ''
  ));

  BEGIN
    -- create header
    INSERT INTO journal_entries(entry_date, description, reference, created_by, is_posted)
    VALUES (COALESCE(entry_date_param, CURRENT_DATE), COALESCE(description_param,''), reference_param, actor_uuid, true)
    RETURNING id INTO v_journal_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to create journal header: ' || SQLERRM);
  END;

  -- insert lines
  FOR v_row IN SELECT * FROM jsonb_array_elements(lines_param)
  LOOP
    BEGIN
      v_project_uuid := NULL;
      IF (v_row->> 'project_id') IS NOT NULL AND (v_row->> 'project_id') <> '' THEN
        BEGIN
          v_project_uuid := (v_row->> 'project_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_project_uuid := NULL;
        END;
      END IF;

      INSERT INTO journal_lines(journal_entry_id, account_code, debit, credit, project_id, description)
      VALUES (
        v_journal_id,
        NULLIF(v_row->> 'account_code',''),
        COALESCE(NULLIF(v_row->> 'debit_amount','')::numeric,0),
        COALESCE(NULLIF(v_row->> 'credit_amount','')::numeric,0),
        v_project_uuid,
        NULLIF(v_row->> 'line_description','')
      );
    EXCEPTION WHEN OTHERS THEN
      DELETE FROM journal_lines WHERE journal_entry_id = v_journal_id;
      DELETE FROM journal_entries WHERE id = v_journal_id;
      RETURN jsonb_build_object('success', false, 'error', 'Failed to insert journal line: ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'journal_entry_id', v_journal_id, 'total_debit', v_total_debit, 'total_credit', v_total_credit);
END;
$$;

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
  v_cumulative_rev NUMERIC := 0;
  v_period_rev NUMERIC := 0;
  v_invoiced_to_date NUMERIC := 0;
  v_contract_asset NUMERIC := 0;
  v_advance_billing NUMERIC := 0;
  v_journal_id UUID;
  v_project_contract_value NUMERIC := p_contract_value;
  v_has_performance_obligations BOOLEAN := FALSE;
BEGIN
  PERFORM validate_active_accounts(ARRAY['4600','1400','2300']);

  SELECT COALESCE(SUM(gross_total_ghs), 0) INTO v_invoiced_to_date
    FROM invoices WHERE project_id = p_project_id AND status != 'voided';

  SELECT EXISTS(
    SELECT 1 FROM performance_obligations WHERE project_id = p_project_id
  ) INTO v_has_performance_obligations;

  IF v_has_performance_obligations THEN
    PERFORM allocate_transaction_price(p_project_id);

    SELECT COALESCE(SUM(allocated_transaction_price * (pct_complete / 100)), 0)
      INTO v_cumulative_rev
    FROM performance_obligations
    WHERE project_id = p_project_id;

    SELECT contract_value INTO v_project_contract_value
      FROM projects WHERE id = p_project_id;

    v_period_rev := v_cumulative_rev - p_prior_recognised;
  ELSE
    v_cumulative_rev := p_contract_value * (p_pct_complete / 100);
    v_period_rev := v_cumulative_rev - p_prior_recognised;
  END IF;

  v_contract_asset := GREATEST(v_cumulative_rev - v_invoiced_to_date, 0);
  v_advance_billing := GREATEST(v_invoiced_to_date - v_cumulative_rev, 0);

  INSERT INTO journal_entries (source_type, source_id, is_posted, created_at)
  VALUES ('revenue_recognition', p_project_id, TRUE, NOW())
  RETURNING id INTO v_journal_id;

  IF v_period_rev >= 0 THEN
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
  ELSE
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id, currency, created_at
    ) VALUES (
      v_journal_id,
      '4600',
      (SELECT account_name FROM chart_of_accounts WHERE account_code = '4600'),
      ABS(v_period_rev),
      0,
      'Revenue reversal for project ' || p_project_id,
      p_project_id,
      'GHS',
      NOW()
    );
  END IF;

  IF v_contract_asset > 0 THEN
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id, currency, created_at
    ) VALUES (
      v_journal_id,
      '1400',
      (SELECT account_name FROM chart_of_accounts WHERE account_code = '1400'),
      CASE WHEN v_period_rev >= 0 THEN v_period_rev ELSE 0 END,
      CASE WHEN v_period_rev < 0 THEN ABS(v_period_rev) ELSE 0 END,
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
      CASE WHEN v_period_rev >= 0 THEN v_period_rev ELSE 0 END,
      CASE WHEN v_period_rev < 0 THEN ABS(v_period_rev) ELSE 0 END,
      'Revenue recognised against advance billings for project ' || p_project_id,
      p_project_id,
      'GHS',
      NOW()
    );
  ELSE
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id, currency, created_at
    ) VALUES (
      v_journal_id,
      '1400',
      (SELECT account_name FROM chart_of_accounts WHERE account_code = '1400'),
      CASE WHEN v_period_rev >= 0 THEN v_period_rev ELSE 0 END,
      CASE WHEN v_period_rev < 0 THEN ABS(v_period_rev) ELSE 0 END,
      'Revenue recognised against contract asset for project ' || p_project_id,
      p_project_id,
      'GHS',
      NOW()
    );
  END IF;

  INSERT INTO revenue_recognition (
    project_id, recognition_date, period_label, pct_complete, contract_value,
    cumulative_revenue, prior_recognised, period_revenue, cost_to_date, gross_profit,
    journal_entry_id, completion_method, recognised_by, notes, created_at
  ) VALUES (
    p_project_id, CURRENT_DATE, p_period_label, p_pct_complete, v_project_contract_value,
    v_cumulative_rev, p_prior_recognised, v_period_rev, p_cost_to_date, NULL,
    v_journal_id, NULL, p_recognised_by, NULL, NOW()
  );

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

CREATE OR REPLACE FUNCTION complete_milestone(
  milestone_id_param uuid,
  completed_by_param uuid,
  completion_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  ms milestones%ROWTYPE;
  proj projects%ROWTYPE;
  contract contracts%ROWTYPE;
  actor profiles%ROWTYPE;
  billing_amount_val numeric;
  retention_amount_val numeric;
  balance_amount_val numeric;
  net_billing numeric;
BEGIN
  PERFORM validate_active_accounts(ARRAY['2109']);

  SELECT * INTO ms FROM milestones WHERE id = milestone_id_param;
  IF ms.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Milestone not found');
  END IF;

  IF ms.status IN ('completed', 'invoiced') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Milestone already ' || ms.status);
  END IF;

  SELECT * INTO proj FROM projects WHERE id = ms.project_id;
  SELECT * INTO contract FROM contracts WHERE project_id = ms.project_id;
  SELECT * INTO actor FROM profiles WHERE user_id = completed_by_param;

  IF proj.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  billing_amount_val := COALESCE(
    ms.billing_amount,
    (ms.percentage_complete / 100) * COALESCE(contract.value, 0)
  );

  retention_amount_val := billing_amount_val *
    (COALESCE(contract.retention_percentage, 0) / 100);

  net_billing := billing_amount_val - retention_amount_val;

  UPDATE milestones SET
    status = 'completed',
    completed_date = CURRENT_DATE,
    billing_amount = billing_amount_val
  WHERE id = milestone_id_param;

  SELECT COALESCE(SUM(withheld_amount), 0)
    INTO balance_amount_val
    FROM retention_ledger
    WHERE contract_id = contract.id
      AND retention_type = 'client';

  balance_amount_val := balance_amount_val + retention_amount_val;

  IF retention_amount_val > 0 THEN
    INSERT INTO retention_ledger (
      contract_id, project_id, client_id,
      withheld_amount, retention_type, status, balance_amount,
      transaction_date, notes, created_by
    ) VALUES (
      contract.id, proj.id, proj.client_id,
      retention_amount_val, 'client', 'withheld', balance_amount_val,
      CURRENT_DATE,
      'Retention on milestone: ' || ms.title,
      actor.id
    );
  END IF;

  INSERT INTO audit_log (
    table_name, record_id, action, actor_id, details
  ) VALUES (
    'milestones', milestone_id_param, 'MILESTONE_COMPLETED', actor.id,
    jsonb_build_object(
      'project_id', proj.id,
      'billing_amount', billing_amount_val,
      'retention_amount', retention_amount_val,
      'net_billing', net_billing,
      'completion_notes', completion_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'milestone_id', milestone_id_param,
    'billing_amount', billing_amount_val,
    'retention_held', retention_amount_val,
    'net_billing', net_billing,
    'status', 'completed'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_milestone(uuid, uuid, text) TO authenticated;
