-- =============================================================================
-- ARCBUILD PRO — Migration 022: Client Portal RLS hardening (Module 4.6)
-- Auth linkage: profiles.client_id → clients.id (get_user_client_id())
-- clients.auth_user_id also exists for direct auth.users link (migration 004).
-- =============================================================================

-- Clients: hide draft/pending invoices at the database layer
DROP POLICY IF EXISTS invoices_client_select ON invoices;

CREATE POLICY invoices_client_select ON invoices
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'client'
    AND client_id = get_user_client_id()
    AND status::text IN ('approved', 'sent', 'paid')
  );

-- Documents: site photos & daily reports via project_id or related project
DROP POLICY IF EXISTS documents_client_select ON documents;

CREATE POLICY documents_client_select ON documents
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'client'
    AND (
      (
        project_id IS NOT NULL
        AND project_id IN (
          SELECT id FROM projects WHERE client_id = get_user_client_id()
        )
      )
      OR (
        related_type = 'project'
        AND related_id IN (
          SELECT id FROM projects WHERE client_id = get_user_client_id()
        )
      )
    )
  );

-- Division names on project cards
DROP POLICY IF EXISTS divisions_client_select ON divisions;

CREATE POLICY divisions_client_select ON divisions
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'client'
    AND id IN (
      SELECT division_id FROM projects WHERE client_id = get_user_client_id()
    )
  );
