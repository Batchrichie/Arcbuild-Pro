-- Section C1.1 — Add completion columns to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS completion_method     TEXT DEFAULT 'cost'
      CHECK (completion_method IN ('cost', 'milestone', 'manual')),
  ADD COLUMN IF NOT EXISTS budget_cost           NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost_to_date   NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_complete          NUMERIC(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_to_recognise  NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_recognised    NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_recognition_date DATE,
  ADD COLUMN IF NOT EXISTS recognition_notes     TEXT;

-- Section C1.2 — Create revenue_recognition table
CREATE TABLE IF NOT EXISTS revenue_recognition (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id),
  recognition_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  period_label       TEXT,
  pct_complete       NUMERIC(5,2) NOT NULL,
  contract_value     NUMERIC(15,2) NOT NULL,
  cumulative_revenue NUMERIC(15,2) NOT NULL,
  prior_recognised   NUMERIC(15,2) DEFAULT 0,
  period_revenue     NUMERIC(15,2) NOT NULL,
  cost_to_date       NUMERIC(15,2) DEFAULT 0,
  gross_profit       NUMERIC(15,2),
  journal_entry_id   UUID REFERENCES journal_entries(id),
  completion_method  TEXT,
  recognised_by      UUID REFERENCES profiles(id),
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revrec_project ON revenue_recognition (project_id);
CREATE INDEX IF NOT EXISTS idx_revrec_date    ON revenue_recognition (recognition_date);

-- Section C1.3 — Insert GL account codes
INSERT INTO chart_of_accounts (account_code, account_name, account_type) VALUES
  ('1400', 'Contract Asset (WIP)',          'asset'),
  ('2300', 'Advance Billings / Overbilling','liability'),
  ('4600', 'Contract Revenue Recognised',   'revenue')
ON CONFLICT (account_code) DO NOTHING;

-- Section C1.4 — RLS for revenue_recognition
ALTER TABLE revenue_recognition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS revrec_admin   ON revenue_recognition;
DROP POLICY IF EXISTS revrec_pm_read ON revenue_recognition;

CREATE POLICY revrec_admin ON revenue_recognition
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('ceo', 'accountant')
    )
  );

CREATE POLICY revrec_pm_read ON revenue_recognition FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role = 'project_manager'
    )
  );
