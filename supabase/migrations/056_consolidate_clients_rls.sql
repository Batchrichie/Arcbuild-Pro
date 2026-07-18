-- =============================================================================
-- ARCBUILD PRO — Migration 056: Consolidate redundant clients RLS policies
--
-- Reduce duplicate policy count on clients without changing access behavior.
-- clients_admin already covers all CEO/accountant access for ALL commands.
-- clients_pm_select and clients_self remain as the intended client/PM rules.
-- =============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_ceo_all ON clients;
DROP POLICY IF EXISTS clients_accountant_select ON clients;
DROP POLICY IF EXISTS clients_accountant_insert ON clients;
DROP POLICY IF EXISTS clients_accountant_update ON clients;
DROP POLICY IF EXISTS clients_pm_read ON clients;
