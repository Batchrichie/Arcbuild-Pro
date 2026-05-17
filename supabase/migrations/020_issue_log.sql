-- =============================================================================
-- ARCBUILD PRO — Migration 020: Issue Log & PM Documents (Module 4.3)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- issue_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  issue_type text NOT NULL DEFAULT 'issue',
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  raised_by uuid REFERENCES profiles(id),
  assigned_to uuid REFERENCES profiles(id),
  due_date date,
  resolved_date date,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT chk_issue_type CHECK (
    issue_type IN ('issue', 'risk', 'observation')
  ),
  CONSTRAINT chk_issue_severity CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT chk_issue_status CHECK (
    status IN ('open', 'in_progress', 'resolved', 'closed')
  )
);

CREATE INDEX IF NOT EXISTS idx_issue_log_project_id ON issue_log(project_id);
CREATE INDEX IF NOT EXISTS idx_issue_log_status ON issue_log(status);

ALTER TABLE issue_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Issue log access" ON issue_log;

CREATE POLICY "Issue log access"
  ON issue_log FOR ALL
  TO authenticated
  USING (
    get_user_role() IN ('ceo', 'accountant', 'project_manager')
    OR project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = get_user_profile_id()
    )
  )
  WITH CHECK (
    get_user_role() IN ('ceo', 'accountant', 'project_manager')
    OR project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = get_user_profile_id()
    )
  );

-- -----------------------------------------------------------------------------
-- documents — PM site photos & daily reports
-- -----------------------------------------------------------------------------
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS content jsonb,
  ADD COLUMN IF NOT EXISTS document_date date;

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);

-- -----------------------------------------------------------------------------
-- Supabase Storage: site-photos bucket
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-photos', 'site-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "PM site photos upload" ON storage.objects;
DROP POLICY IF EXISTS "Site photos public read" ON storage.objects;

CREATE POLICY "Site photos public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'site-photos');

CREATE POLICY "PM site photos upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-photos'
    AND get_user_role() IN ('project_manager', 'ceo', 'accountant')
  );

CREATE POLICY "PM site photos update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-photos')
  WITH CHECK (bucket_id = 'site-photos');

GRANT SELECT ON issue_log TO authenticated;
GRANT INSERT, UPDATE, DELETE ON issue_log TO authenticated;
