-- =============================================================================
-- Migration 039: Record Invoice Payment RPC order fix
-- Ensures Supabase RPC can invoke the payment recording function even when
-- parameter names are reordered by the client.
-- =============================================================================

CREATE OR REPLACE FUNCTION record_invoice_payment_rpc(
    acting_user_id UUID,
    amount_received_ghs NUMERIC,
    invoice_uuid UUID,
    payment_account_code TEXT DEFAULT NULL,
    payment_date_val DATE DEFAULT NULL,
    payment_reference_val TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
    RETURN public.record_invoice_payment(
        invoice_uuid := invoice_uuid,
        payment_date_val := payment_date_val,
        payment_reference_val := payment_reference_val,
        amount_received_ghs := amount_received_ghs,
        payment_account_code := payment_account_code,
        acting_user_id := acting_user_id
    );
END;
$$ LANGUAGE plpgsql;
