-- =============================================================================
-- ARCBUILD PRO — Migration 006: Invoice Approval Workflow
-- Phase 2, Module 2.2
--
-- Adds the invoice status state machine, payment recording logic,
-- and audit protection for status change events.
-- =============================================================================

-- Ensure the invoice table has the payment FX gain/loss column.
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS fx_gain_loss_ghs NUMERIC(18, 2) DEFAULT 0;


-- =============================================================================
-- STEP 1: transition_invoice_status() function
-- Authoritative status transition logic for invoices.
-- =============================================================================

CREATE OR REPLACE FUNCTION transition_invoice_status(
    invoice_uuid UUID,
    new_status invoice_status,
    acting_user_id UUID,
    rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    inv invoices%ROWTYPE;
    actor_role TEXT;
    actor_profile_id UUID;
    result JSONB;
BEGIN
    SELECT * INTO inv FROM invoices WHERE id = invoice_uuid;
    IF inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    SELECT role, id INTO actor_role, actor_profile_id
    FROM profiles
    WHERE user_id = acting_user_id
    LIMIT 1;

    IF actor_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Actor profile not found');
    END IF;

    IF NOT (
        (inv.status = 'draft' AND new_status = 'pending_approval'
            AND inv.requires_approval = TRUE
            AND actor_role = 'accountant')
        OR
        (inv.status = 'draft' AND new_status = 'approved'
            AND inv.requires_approval = FALSE
            AND actor_role = 'accountant')
        OR
        (inv.status = 'pending_approval' AND new_status = 'approved'
            AND actor_role IN ('ceo', 'director'))
        OR
        (inv.status = 'pending_approval' AND new_status = 'rejected'
            AND actor_role IN ('ceo', 'director')
            AND rejection_reason IS NOT NULL)
        OR
        (inv.status = 'rejected' AND new_status = 'draft'
            AND actor_role = 'accountant')
        OR
        (inv.status = 'approved' AND new_status = 'sent'
            AND actor_role IN ('accountant', 'system'))
        OR
        (inv.status = 'sent' AND new_status = 'paid'
            AND actor_role = 'accountant')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Transition from %s to %s is not permitted for role %s',
                inv.status, new_status, actor_role)
        );
    END IF;

    UPDATE invoices SET
        status = new_status,
        approved_by = CASE WHEN new_status = 'approved' THEN acting_user_id ELSE approved_by END,
        approved_at = CASE WHEN new_status = 'approved' THEN NOW() ELSE approved_at END,
        rejected_by = CASE WHEN new_status = 'rejected' THEN acting_user_id ELSE rejected_by END,
        rejected_at = CASE WHEN new_status = 'rejected' THEN NOW() ELSE rejected_at END,
        rejection_note = CASE
            WHEN new_status = 'rejected' THEN rejection_reason
            WHEN new_status = 'draft' THEN NULL
            ELSE rejection_note
        END,
        updated_at = NOW()
    WHERE id = invoice_uuid;

    INSERT INTO audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_value,
        new_value,
        created_at
    ) VALUES (
        actor_profile_id,
        'UPDATE',
        'invoices',
        invoice_uuid,
        jsonb_build_object(
            'from_status', inv.status,
            'to_status', new_status,
            'rejection_note', inv.rejection_note
        ),
        jsonb_build_object(
            'from_status', inv.status,
            'to_status', new_status,
            'rejection_note', CASE WHEN new_status = 'rejected' THEN rejection_reason ELSE NULL END
        ),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'new_status', new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- STEP 2: audit_log RLS enforcement
-- Ensure audit log remains readable only by finance leadership.
-- =============================================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_ceo_select ON audit_log;
DROP POLICY IF EXISTS audit_log_accountant_select ON audit_log;
DROP POLICY IF EXISTS audit_log_ceo_insert ON audit_log;
DROP POLICY IF EXISTS audit_log_accountant_insert ON audit_log;

CREATE POLICY audit_log_ceo_select ON audit_log
    FOR SELECT
    USING (get_user_role() = 'ceo');

CREATE POLICY audit_log_accountant_select ON audit_log
    FOR SELECT
    USING (get_user_role() = 'accountant');

CREATE POLICY audit_log_ceo_insert ON audit_log
    FOR INSERT
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY audit_log_accountant_insert ON audit_log
    FOR INSERT
    WITH CHECK (get_user_role() = 'accountant');


-- =============================================================================
-- STEP 3: record_invoice_payment() function
-- Records payment details and transitions the invoice to paid.
-- =============================================================================

CREATE OR REPLACE FUNCTION record_invoice_payment(
    invoice_uuid UUID,
    payment_date_val DATE,
    payment_reference_val TEXT,
    amount_received_ghs NUMERIC,
    acting_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    inv invoices%ROWTYPE;
    result JSONB;
    fx_gain_loss NUMERIC;
BEGIN
    SELECT * INTO inv FROM invoices WHERE id = invoice_uuid;
    IF inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF inv.status != 'sent' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice must be in SENT status to record payment');
    END IF;

    fx_gain_loss := amount_received_ghs - COALESCE(inv.expected_receipt_ghs, 0);

    UPDATE invoices SET
        payment_date = payment_date_val,
        payment_reference = payment_reference_val,
        fx_gain_loss_ghs = fx_gain_loss,
        updated_at = NOW()
    WHERE id = invoice_uuid;

    result := transition_invoice_status(invoice_uuid, 'paid', acting_user_id);
    IF NOT COALESCE((result->>'success')::BOOLEAN, FALSE) THEN
        RETURN result;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'fx_gain_loss_ghs', fx_gain_loss
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- END OF MIGRATION 005
-- =============================================================================
-- Verify after running:
--   SELECT * FROM pg_proc WHERE proname IN ('transition_invoice_status', 'record_invoice_payment');
--   SELECT * FROM audit_log LIMIT 5;
-- =============================================================================
