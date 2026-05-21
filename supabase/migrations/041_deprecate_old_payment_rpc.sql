-- =============================================================================
-- Migration 041: Deprecate old record_invoice_payment RPC
-- This migration renames the legacy payment recording functions so they
-- cannot be invoked by new client code.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'record_invoice_payment'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) =
        'invoice_uuid uuid, payment_date_val date, payment_reference_val text, amount_received_ghs numeric, payment_account_code text, acting_user_id uuid'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.record_invoice_payment(invoice_uuid UUID, payment_date_val DATE, payment_reference_val TEXT, amount_received_ghs NUMERIC, payment_account_code TEXT, acting_user_id UUID) RENAME TO record_invoice_payment_deprecated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'record_invoice_payment_rpc'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) =
        'acting_user_id uuid, amount_received_ghs numeric, invoice_uuid uuid, payment_account_code text, payment_date_val date, payment_reference_val text'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.record_invoice_payment_rpc(acting_user_id UUID, amount_received_ghs NUMERIC, invoice_uuid UUID, payment_account_code TEXT, payment_date_val DATE, payment_reference_val TEXT) RENAME TO record_invoice_payment_rpc_deprecated';
  END IF;
END;
$$ LANGUAGE plpgsql;
