-- =============================================================================
-- Migration 044: Fix complete_milestone() retention insert
-- Updates the milestone completion function to use the current retention_ledger schema.
-- =============================================================================

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
  -- Get milestone
  SELECT * INTO ms FROM milestones WHERE id = milestone_id_param;
  IF ms.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Milestone not found');
  END IF;

  -- Check if already completed or invoiced
  IF ms.status IN ('completed', 'invoiced') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Milestone already ' || ms.status);
  END IF;

  -- Get project and contract
  SELECT * INTO proj FROM projects WHERE id = ms.project_id;
  SELECT * INTO contract FROM contracts WHERE project_id = ms.project_id;
  SELECT * INTO actor FROM profiles WHERE user_id = completed_by_param;

  IF proj.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;

  -- Compute billing amount from milestone percentage of contract value
  billing_amount_val := COALESCE(
    ms.billing_amount,
    (ms.percentage_complete / 100) * COALESCE(contract.value, 0)
  );

  -- Compute retention to hold on this milestone billing
  retention_amount_val := billing_amount_val *
    (COALESCE(contract.retention_percentage, 0) / 100);

  net_billing := billing_amount_val - retention_amount_val;

  -- Mark milestone complete and store billing amounts
  UPDATE milestones SET
    status = 'completed',
    completed_date = CURRENT_DATE,
    billing_amount = billing_amount_val
  WHERE id = milestone_id_param;

  -- Determine cumulative retention balance for the contract
  SELECT COALESCE(SUM(withheld_amount), 0)
    INTO balance_amount_val
    FROM retention_ledger
    WHERE contract_id = contract.id
      AND retention_type = 'client';

  balance_amount_val := balance_amount_val + retention_amount_val;

  -- Record retention in retention_ledger
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

  -- Log to audit trail
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
