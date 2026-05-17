-- =============================================================================
-- ARCBUILD PRO — Migration 015: Milestone Billing
-- Module 3.3: Milestone completion triggers invoice queue
--
-- Creates three database objects:
--   1. complete_milestone() — Marks milestone complete, computes billing & retention
--   2. link_milestone_invoice() — Links completed milestone to invoice, updates status
--   3. milestone_invoice_queue view — Shows completed milestones awaiting invoicing
--
-- Safe to re-run: uses CREATE OR REPLACE FUNCTION
-- =============================================================================


-- =============================================================================
-- FUNCTION 1: complete_milestone
-- Marks a milestone as complete and computes billing amounts
--
-- Args:
--   milestone_id_param: UUID of the milestone to complete
--   completed_by_param: UUID of user marking it complete (PM)
--   completion_notes: Optional notes on completion
--
-- Returns: JSONB with success status, billing_amount, retention_held, net_billing
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
  -- Use override billing_amount if set, otherwise calculate from percentage
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

  -- Record retention in retention_ledger
  IF retention_amount_val > 0 THEN
    INSERT INTO retention_ledger (
      contract_id, project_id, client_id,
      retention_amount, transaction_type,
      transaction_date, notes, created_by
    ) VALUES (
      contract.id, proj.id, proj.client_id,
      retention_amount_val, 'held',
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


-- =============================================================================
-- FUNCTION 2: link_milestone_invoice
-- Links a completed milestone to an invoice and updates milestone status to invoiced
--
-- Args:
--   milestone_id_param: UUID of the completed milestone
--   invoice_id_param: UUID of the newly created invoice
--   actor_uuid: UUID of user (accountant) linking them
--
-- Returns: JSONB with success status, milestone_id, invoice_id
-- =============================================================================

CREATE OR REPLACE FUNCTION link_milestone_invoice(
  milestone_id_param uuid,
  invoice_id_param uuid,
  actor_uuid uuid
)
RETURNS jsonb AS $$
DECLARE
  actor profiles%ROWTYPE;
BEGIN
  SELECT * INTO actor FROM profiles WHERE user_id = actor_uuid;

  UPDATE milestones SET
    invoice_id = invoice_id_param,
    status = 'invoiced'
  WHERE id = milestone_id_param
    AND status = 'completed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Milestone not found or not in completed status');
  END IF;

  -- Log to audit trail
  INSERT INTO audit_log (
    table_name, record_id, action, actor_id, details
  ) VALUES (
    'milestones', milestone_id_param, 'MILESTONE_INVOICED', actor.id,
    jsonb_build_object('invoice_id', invoice_id_param)
  );

  RETURN jsonb_build_object(
    'success', true,
    'milestone_id', milestone_id_param,
    'invoice_id', invoice_id_param,
    'status', 'invoiced'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION link_milestone_invoice(uuid, uuid, uuid) TO authenticated;


-- =============================================================================
-- VIEW: milestone_invoice_queue
-- Shows completed milestones that have not yet been invoiced
-- Used by Accountant to create invoices from milestones
-- =============================================================================

CREATE OR REPLACE VIEW milestone_invoice_queue AS
SELECT
  m.id                    AS milestone_id,
  m.title                 AS milestone_title,
  m.description           AS milestone_description,
  m.completed_date,
  m.billing_amount,
  (m.billing_amount * COALESCE(c.retention_percentage, 0) / 100)
    AS retention_amount,
  (m.billing_amount - (m.billing_amount * COALESCE(c.retention_percentage, 0) / 100))
    AS net_billing,
  m.percentage_complete,
  p.id                    AS project_id,
  p.name                  AS project_name,
  p.division_id,
  d.name                  AS division_name,
  p.client_id,
  cl.name                 AS client_name,
  c.value                 AS contract_value,
  c.retention_percentage,
  c.id                    AS contract_id
FROM milestones m
JOIN projects p ON p.id = m.project_id
JOIN clients cl ON cl.id = p.client_id
LEFT JOIN divisions d ON d.id = p.division_id
LEFT JOIN contracts c ON c.project_id = p.id
WHERE m.status = 'completed'
  AND m.invoice_id IS NULL
ORDER BY m.completed_date ASC;

GRANT SELECT ON milestone_invoice_queue TO authenticated;

COMMENT ON VIEW milestone_invoice_queue IS
  'Queue of completed milestones awaiting invoice creation by Accountant. Shows billing amounts with retention calculations.';


-- =============================================================================
-- VERIFICATION QUERIES (run after migration applied):
--
-- select proname from pg_proc
-- where proname in ('complete_milestone', 'link_milestone_invoice')
-- order by proname;
--
-- Expected: TWO rows (both functions present)
--
-- select table_name, table_type
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name = 'milestone_invoice_queue';
--
-- Expected: ONE row with table_type = 'VIEW'
-- =============================================================================
