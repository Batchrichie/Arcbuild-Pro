-- =============================================================================
-- ARCBUILD PRO — Migration 010: Multi-Currency Module (Module 2.6)
-- Phase 2, Module 2.6
--
-- CONSOLIDATION DECISION:
-- In this environment, only exchange_rates table exists (created in Migration 004).
-- fx_rates was never created — no consolidation needed.
-- exchange_rates is the canonical FX rates table with 18.6 precision.
--
-- Implements:
--   • get_fx_rate() function — returns rate for currency on date, with fallback
--   • Updates compute_invoice_taxes() to auto-fetch FX rates using get_fx_rate()
--   • RLS policy for exchange_rates (accountant-only writes)
--
-- Safe to re-run: uses CREATE OR REPLACE and DROP POLICY IF EXISTS.
-- =============================================================================


-- =============================================================================
-- STEP 1: CREATE get_fx_rate() FUNCTION
-- Returns the correct FX rate for a given currency on a given date.
-- Falls back to the most recent available rate if exact date has no entry.
-- Returns 1.0 for GHS (base currency).
-- =============================================================================

CREATE OR REPLACE FUNCTION get_fx_rate(
  currency_code_param TEXT,
  rate_date_param DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
  rate NUMERIC;
BEGIN
  -- GHS is the base currency; always return 1.0
  IF currency_code_param = 'GHS' THEN
    RETURN 1.0;
  END IF;

  -- Look for the rate on the given date or the most recent date before it
  SELECT rate_to_ghs INTO rate
  FROM exchange_rates
  WHERE currency_code = currency_code_param
    AND rate_date <= rate_date_param
  ORDER BY rate_date DESC
  LIMIT 1;

  -- If no rate found, raise an exception
  IF rate IS NULL THEN
    RAISE EXCEPTION 'No FX rate found for % on or before %',
      currency_code_param, rate_date_param;
  END IF;

  RETURN rate;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users (read-only via RLS)
GRANT EXECUTE ON FUNCTION get_fx_rate(TEXT, DATE) TO authenticated;


-- =============================================================================
-- STEP 2: UPDATE compute_invoice_taxes() FUNCTION
-- Auto-fetch FX rate using get_fx_rate() if not manually set.
-- Called when line items change or invoice is saved.
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_invoice_taxes(invoice_uuid UUID)
RETURNS VOID AS $$
DECLARE
    inv invoices%rowtype;
    client clients%rowtype;
    subtotal_val NUMERIC;
    vat NUMERIC := 0;
    nhil NUMERIC := 0;
    getfund NUMERIC := 0;
    gross NUMERIC;
    wht NUMERIC := 0;
    receipt NUMERIC;
    fx NUMERIC;
    threshold_ghs NUMERIC;
BEGIN
    -- Fetch the invoice and associated client
    SELECT * INTO inv FROM invoices WHERE id = invoice_uuid;
    IF inv.id IS NULL THEN
        RAISE EXCEPTION 'Invoice % not found', invoice_uuid;
    END IF;

    SELECT * INTO client FROM clients WHERE id = inv.client_id;

    -- Sum line items in invoice currency
    SELECT COALESCE(SUM(line_total), 0) INTO subtotal_val
    FROM invoice_line_items
    WHERE invoice_id = invoice_uuid;

    -- Auto-fetch FX rate if currency is not GHS and rate not manually set
    IF inv.currency::text != 'GHS' AND (inv.fx_rate_to_ghs IS NULL OR inv.fx_rate_to_ghs = 1.0) THEN
        fx := get_fx_rate(inv.currency::text, CURRENT_DATE);
        UPDATE invoices SET
            fx_rate_to_ghs = fx,
            fx_rate_date = CURRENT_DATE
        WHERE id = invoice_uuid;
    ELSE
        fx := COALESCE(inv.fx_rate_to_ghs, 1.0);
    END IF;

    -- Compute taxes based on client tax profile
    IF client.applies_vat THEN
        vat := subtotal_val * 0.15;
    END IF;

    IF client.applies_nhil THEN
        nhil := subtotal_val * 0.025;
    END IF;

    IF client.applies_getfund THEN
        getfund := subtotal_val * 0.025;
    END IF;

    gross := subtotal_val + vat + nhil + getfund;

    -- Compute WHT if client subject to withholding tax
    IF client.applies_wht THEN
        wht := subtotal_val * client.wht_rate;
    END IF;

    receipt := gross - wht;

    -- Get approval threshold from system_config
    SELECT value::NUMERIC INTO threshold_ghs
    FROM system_config
    WHERE key = 'invoice_approval_threshold_ghs';

    -- Update invoice with computed values
    UPDATE invoices SET
        subtotal = subtotal_val,
        vat_amount = vat,
        nhil_amount = nhil,
        getfund_amount = getfund,
        gross_total = gross,
        wht_amount = wht,
        expected_receipt = receipt,
        subtotal_ghs = subtotal_val * fx,
        vat_amount_ghs = vat * fx,
        nhil_amount_ghs = nhil * fx,
        getfund_amount_ghs = getfund * fx,
        gross_total_ghs = gross * fx,
        wht_amount_ghs = wht * fx,
        expected_receipt_ghs = receipt * fx,
        requires_approval = (gross * fx) >= COALESCE(threshold_ghs, 100000),
        approval_threshold_at_creation = COALESCE(threshold_ghs, 100000),
        updated_at = NOW()
    WHERE id = invoice_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- STEP 3: RLS POLICY FOR exchange_rates
-- Accountants can insert and update rates; all roles can select.
-- =============================================================================

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Accountant manages FX rates" ON exchange_rates;
DROP POLICY IF EXISTS "All roles view FX rates" ON exchange_rates;

-- Accountants can insert and update rates
CREATE POLICY "Accountant manages FX rates"
  ON exchange_rates FOR ALL
  USING (get_user_role() = 'accountant')
  WITH CHECK (get_user_role() = 'accountant');

-- All authenticated roles can view rates
CREATE POLICY "All roles view FX rates"
  ON exchange_rates FOR SELECT
  USING (TRUE);


-- =============================================================================
-- END OF MIGRATION 010
-- =============================================================================
-- Changes:
--   • Functions: added get_fx_rate(), updated compute_invoice_taxes()
--   • RLS: enabled on exchange_rates with accountant-write policy
--   • No consolidation needed: exchange_rates is canonical
-- =============================================================================
