-- =============================================================================
-- ARCBUILD PRO — Migration 055: Cleanup stale duplicate RLS policies
--
-- Removes legacy policies that now overlap or conflict with newer RLS rules.
-- This migration is deliberately conservative: it only drops stale policy names
-- and leaves the current intended policies intact.
-- =============================================================================

-- Invoice client visibility cleanup
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Client views own invoices" ON invoices;

-- Remove dead/leftover journal_entries policy
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journal_entries_accountant_ceo ON journal_entries;

-- Remove duplicate client row policy name
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clients_client_select ON clients;

-- Retire legacy chart_of_accounts policy names that duplicate newer granular rules
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coa_accountant ON chart_of_accounts;
DROP POLICY IF EXISTS coa_ceo_read ON chart_of_accounts;
