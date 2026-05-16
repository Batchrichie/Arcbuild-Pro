-- =============================================================================
-- ARCBUILD PRO — Migration 005: Fix Invoice Engine Schema and RLS
-- Corrects broken Migration 004 behavior in environments where Migration 004
-- was applied before the invoice engine changes were repaired.
-- =============================================================================

-- Ensure invoices use the normalized division FK.
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id) ON DELETE RESTRICT;

UPDATE invoices
SET division_id = p.division_id
FROM projects p
WHERE invoices.project_id = p.id
  AND invoices.division_id IS NULL;

-- Remove legacy text division column if it still exists.
ALTER TABLE invoices
    DROP COLUMN IF EXISTS division;

-- Fix indexes for the normalized division field.
DROP INDEX IF EXISTS idx_invoices_division;
CREATE INDEX IF NOT EXISTS idx_invoices_division_id ON invoices(division_id);

-- Recreate correctly functioning RLS policies for invoices and invoice line items.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CEO and accountant full invoice access" ON invoices;
DROP POLICY IF EXISTS "PM views own project invoices" ON invoices;
DROP POLICY IF EXISTS "Client views own invoices" ON invoices;
DROP POLICY IF EXISTS "CEO and accountant full line item access" ON invoice_line_items;
DROP POLICY IF EXISTS "PM views own project line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Client views own line items" ON invoice_line_items;

CREATE POLICY "CEO and accountant full invoice access"
    ON invoices FOR ALL
    USING (
        get_user_role() IN ('ceo', 'accountant')
    )
    WITH CHECK (
        get_user_role() IN ('ceo', 'accountant')
    );

CREATE POLICY "PM views own project invoices"
    ON invoices FOR SELECT
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY "Client views own invoices"
    ON invoices FOR SELECT
    USING (
        get_user_role() = 'client'
        AND client_id = get_user_client_id()
    );

CREATE POLICY "CEO and accountant full line item access"
    ON invoice_line_items FOR ALL
    USING (
        get_user_role() IN ('ceo', 'accountant')
    )
    WITH CHECK (
        get_user_role() IN ('ceo', 'accountant')
    );

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

CREATE POLICY "Client views own line items"
    ON invoice_line_items FOR SELECT
    USING (
        invoice_id IN (
            SELECT id FROM invoices
            WHERE client_id = get_user_client_id()
        )
    );

-- Verify the invoice engine fix with a schema inspection if desired.
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'invoices' AND column_name IN ('division_id', 'division');
-- =============================================================================
