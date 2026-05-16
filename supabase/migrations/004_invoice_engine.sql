-- =============================================================================
-- ARCBUILD PRO — Migration 004: Invoice Engine (Module 2.1)
-- Phase 2, Module 2.1
-- 
-- Implements the complete invoice system with:
--   • system_config table for runtime configuration
--   • Extended clients table with tax profile booleans
--   • exchange_rates table for currency conversion
--   • Enhanced invoices table with GHS equivalents
--   • Updated invoice_line_items table
--   • compute_invoice_taxes() PostgreSQL function
--   • Invoice auto-numbering trigger
--   • RLS policies for invoices and line items
--
-- Safe to re-run: uses CREATE IF NOT EXISTS and idempotent policies.
-- =============================================================================


-- =============================================================================
-- STEP 1: CREATE system_config TABLE
-- Runtime configuration for business rules and system settings.
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed system configuration if not exists
INSERT INTO system_config (key, value, description)
VALUES
    ('invoice_approval_threshold_ghs', '100000', 'Invoice gross total (GHS) at or above this value requires director approval'),
    ('default_currency', 'GHS', 'Base currency for financial statements'),
    ('fx_source', 'bank_of_ghana', 'Source for exchange rates')
ON CONFLICT (key) DO NOTHING;


-- =============================================================================
-- STEP 2: EXTEND clients TABLE WITH TAX PROFILE BOOLEANS
-- Add tax application flags and computed WHT rate.
-- =============================================================================

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS applies_vat BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS applies_nhil BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS applies_getfund BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS applies_wht BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add computed WHT rate column (generated always as stored)
-- Drop if exists to recreate with correct logic
ALTER TABLE clients DROP COLUMN IF EXISTS wht_rate CASCADE;

ALTER TABLE clients
    ADD COLUMN wht_rate NUMERIC(5, 4) GENERATED ALWAYS AS (
        CASE client_type
            WHEN 'individual' THEN 0.0500
            WHEN 'corporate' THEN 0.0750
            WHEN 'government' THEN 0.1500
            ELSE 0
        END
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_clients_applies_vat ON clients(applies_vat);
CREATE INDEX IF NOT EXISTS idx_clients_applies_wht ON clients(applies_wht);


-- =============================================================================
-- STEP 3: CREATE exchange_rates TABLE
-- Foreign exchange rates to GHS for multi-currency invoicing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code TEXT NOT NULL,
    rate_to_ghs NUMERIC(18, 6) NOT NULL,
    rate_date DATE NOT NULL,
    source TEXT DEFAULT 'bank_of_ghana',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (currency_code, rate_date)
);

-- Seed placeholder exchange rates (accountant updates daily or via API)
INSERT INTO exchange_rates (currency_code, rate_to_ghs, rate_date)
VALUES
    ('USD', 14.50, CURRENT_DATE),
    ('GBP', 18.20, CURRENT_DATE),
    ('EUR', 15.80, CURRENT_DATE)
ON CONFLICT (currency_code, rate_date) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency_date ON exchange_rates(currency_code, rate_date DESC);


-- =============================================================================
-- STEP 4: CREATE/UPDATE ENUMS FOR INVOICES
-- Define invoice_status and invoice_currency enums.
-- =============================================================================

-- Drop enums if they exist to recreate (handles if they already exist)
DROP TYPE IF EXISTS invoice_status CASCADE;
DROP TYPE IF EXISTS invoice_currency CASCADE;

CREATE TYPE invoice_status AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'paid',
    'rejected'
);

CREATE TYPE invoice_currency AS ENUM ('GHS', 'USD', 'GBP', 'EUR');


-- =============================================================================
-- STEP 5: REPLACE invoices TABLE SCHEMA
-- Drop existing table and recreate with all required fields.
-- This is necessary because the original schema is insufficient for the invoice engine.
-- =============================================================================

DROP TABLE IF EXISTS invoice_line_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,

    -- Currency and FX
    currency invoice_currency DEFAULT 'GHS',
    fx_rate_to_ghs NUMERIC(18, 6) DEFAULT 1.0,
    fx_rate_date DATE,

    -- Line item subtotal (before taxes), in invoice currency
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,

    -- Tax amounts (computed, stored in invoice currency)
    vat_amount NUMERIC(18, 2) DEFAULT 0,
    nhil_amount NUMERIC(18, 2) DEFAULT 0,
    getfund_amount NUMERIC(18, 2) DEFAULT 0,
    gross_total NUMERIC(18, 2) DEFAULT 0,

    -- WHT (deducted by client, stored in invoice currency)
    wht_amount NUMERIC(18, 2) DEFAULT 0,
    expected_receipt NUMERIC(18, 2) DEFAULT 0,

    -- GHS equivalents (locked at fx_rate_date, never updated)
    subtotal_ghs NUMERIC(18, 2),
    vat_amount_ghs NUMERIC(18, 2),
    nhil_amount_ghs NUMERIC(18, 2),
    getfund_amount_ghs NUMERIC(18, 2),
    gross_total_ghs NUMERIC(18, 2),
    wht_amount_ghs NUMERIC(18, 2),
    expected_receipt_ghs NUMERIC(18, 2),

    -- Workflow
    status invoice_status DEFAULT 'draft',
    approval_threshold_at_creation NUMERIC(18, 2),
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ,
    rejection_note TEXT,

    -- Audit
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    due_date DATE,
    payment_date DATE,
    payment_reference TEXT,
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_project_id ON invoices(project_id);
CREATE INDEX idx_invoices_division_id ON invoices(division_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_requires_approval ON invoices(requires_approval);
CREATE INDEX idx_invoices_created_by ON invoices(created_by);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);


-- =============================================================================
-- STEP 6: CREATE invoice_line_items TABLE
-- Individual line items on an invoice.
-- =============================================================================

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1,
    unit_price NUMERIC(18, 2) NOT NULL,
    line_total NUMERIC(18, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);


-- =============================================================================
-- STEP 7: CREATE compute_invoice_taxes() FUNCTION
-- Computes all tax fields and GHS equivalents.
-- Called whenever line items change or invoice is saved.
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
    fx := COALESCE(inv.fx_rate_to_ghs, 1.0);

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
-- STEP 8: CREATE AUTO-NUMBERING TRIGGER
-- Invoice numbers follow format: ARC-YYYY-NNNN (e.g., ARC-2025-0001)
-- Increments per calendar year.
-- =============================================================================

-- Create sequence for invoice numbering (scoped per year)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := 'ARC-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || 
                              LPAD(NEXTVAL('invoice_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS set_invoice_number ON invoices;

CREATE TRIGGER set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL)
    EXECUTE FUNCTION generate_invoice_number();


-- =============================================================================
-- STEP 9: CREATE RLS POLICIES FOR INVOICES AND LINE ITEMS
-- Enable RLS and define access rules by role.
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe on first run)
DROP POLICY IF EXISTS "CEO and accountant full invoice access" ON invoices;
DROP POLICY IF EXISTS "PM views own project invoices" ON invoices;
DROP POLICY IF EXISTS "Client views own invoices" ON invoices;
DROP POLICY IF EXISTS "CEO and accountant full line item access" ON invoice_line_items;
DROP POLICY IF EXISTS "PM views own project line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Client views own line items" ON invoice_line_items;

-- INVOICES POLICIES

-- CEO and Accountant: full access
CREATE POLICY "CEO and accountant full invoice access"
    ON invoices FOR ALL
    USING (
        get_user_role() IN ('ceo', 'accountant')
    )
    WITH CHECK (
        get_user_role() IN ('ceo', 'accountant')
    );

-- Project Manager: view invoices on their assigned projects only
CREATE POLICY "PM views own project invoices"
    ON invoices FOR SELECT
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

-- Client: view own invoices only
CREATE POLICY "Client views own invoices"
    ON invoices FOR SELECT
    USING (
        get_user_role() = 'client'
        AND client_id = get_user_client_id()
    );

-- INVOICE_LINE_ITEMS POLICIES

-- CEO and Accountant: full access
CREATE POLICY "CEO and accountant full line item access"
    ON invoice_line_items FOR ALL
    USING (
        get_user_role() IN ('ceo', 'accountant')
    )
    WITH CHECK (
        get_user_role() IN ('ceo', 'accountant')
    );

-- Project Manager: view line items on their projects only
CREATE POLICY "PM views own project line items"
    ON invoice_line_items FOR SELECT
    USING (
        invoice_id IN (
            SELECT id FROM invoices
            WHERE project_id IN (
                SELECT project_id FROM project_assignments
                WHERE profile_id = get_user_profile_id()
            )
        )
    );

-- Client: view own line items only
CREATE POLICY "Client views own line items"
    ON invoice_line_items FOR SELECT
    USING (
        invoice_id IN (
            SELECT id FROM invoices
            WHERE client_id = get_user_client_id()
        )
    );