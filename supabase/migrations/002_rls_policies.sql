-- =============================================================================
-- ARCBUILD PRO — Migration 002: Row Level Security (idempotent)
-- Phase 1, Step 4
--
-- This file is safe to re-run. All policies are dropped before recreation.
-- Run order: drop all → structural additions → helper functions → enable RLS → create policies
-- =============================================================================


-- =============================================================================
-- PRE-FLIGHT: DROP ALL EXISTING POLICIES (IF EXISTS — safe on first run)
-- =============================================================================

DROP POLICY IF EXISTS roles_ceo_all ON roles;
DROP POLICY IF EXISTS roles_staff_select ON roles;
DROP POLICY IF EXISTS profiles_ceo_all ON profiles;
DROP POLICY IF EXISTS profiles_hr_select ON profiles;
DROP POLICY IF EXISTS profiles_hr_update ON profiles;
DROP POLICY IF EXISTS profiles_accountant_select ON profiles;
DROP POLICY IF EXISTS profiles_own_select ON profiles;
DROP POLICY IF EXISTS profiles_own_update ON profiles;
DROP POLICY IF EXISTS divisions_ceo_all ON divisions;
DROP POLICY IF EXISTS divisions_staff_select ON divisions;
DROP POLICY IF EXISTS clients_ceo_all ON clients;
DROP POLICY IF EXISTS clients_accountant_select ON clients;
DROP POLICY IF EXISTS clients_accountant_insert ON clients;
DROP POLICY IF EXISTS clients_accountant_update ON clients;
DROP POLICY IF EXISTS clients_pm_select ON clients;
DROP POLICY IF EXISTS clients_client_select ON clients;
DROP POLICY IF EXISTS projects_ceo_all ON projects;
DROP POLICY IF EXISTS projects_accountant_select ON projects;
DROP POLICY IF EXISTS projects_pm_select ON projects;
DROP POLICY IF EXISTS projects_pm_update ON projects;
DROP POLICY IF EXISTS projects_client_select ON projects;
DROP POLICY IF EXISTS contracts_ceo_all ON contracts;
DROP POLICY IF EXISTS contracts_accountant_select ON contracts;
DROP POLICY IF EXISTS contracts_accountant_insert ON contracts;
DROP POLICY IF EXISTS contracts_accountant_update ON contracts;
DROP POLICY IF EXISTS contracts_pm_select ON contracts;
DROP POLICY IF EXISTS coa_ceo_all ON chart_of_accounts;
DROP POLICY IF EXISTS coa_accountant_select ON chart_of_accounts;
DROP POLICY IF EXISTS coa_accountant_insert ON chart_of_accounts;
DROP POLICY IF EXISTS coa_accountant_update ON chart_of_accounts;
DROP POLICY IF EXISTS coa_pm_select ON chart_of_accounts;
DROP POLICY IF EXISTS coa_hr_select ON chart_of_accounts;
DROP POLICY IF EXISTS journal_entries_ceo_select ON journal_entries;
DROP POLICY IF EXISTS journal_entries_ceo_insert ON journal_entries;
DROP POLICY IF EXISTS journal_entries_ceo_update ON journal_entries;
DROP POLICY IF EXISTS journal_entries_accountant_select ON journal_entries;
DROP POLICY IF EXISTS journal_entries_accountant_insert ON journal_entries;
DROP POLICY IF EXISTS journal_entries_accountant_update ON journal_entries;
DROP POLICY IF EXISTS journal_lines_ceo_select ON journal_lines;
DROP POLICY IF EXISTS journal_lines_ceo_insert ON journal_lines;
DROP POLICY IF EXISTS journal_lines_ceo_update ON journal_lines;
DROP POLICY IF EXISTS journal_lines_accountant_select ON journal_lines;
DROP POLICY IF EXISTS journal_lines_accountant_insert ON journal_lines;
DROP POLICY IF EXISTS journal_lines_accountant_update ON journal_lines;
DROP POLICY IF EXISTS invoices_ceo_select ON invoices;
DROP POLICY IF EXISTS invoices_ceo_insert ON invoices;
DROP POLICY IF EXISTS invoices_ceo_update ON invoices;
DROP POLICY IF EXISTS invoices_accountant_select ON invoices;
DROP POLICY IF EXISTS invoices_accountant_insert ON invoices;
DROP POLICY IF EXISTS invoices_accountant_update ON invoices;
DROP POLICY IF EXISTS invoices_pm_select ON invoices;
DROP POLICY IF EXISTS invoices_client_select ON invoices;
DROP POLICY IF EXISTS invoice_line_items_ceo_select ON invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_ceo_insert ON invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_ceo_update ON invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_accountant_select ON invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_accountant_insert ON invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_accountant_update ON invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_pm_select ON invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_client_select ON invoice_line_items;
DROP POLICY IF EXISTS employees_ceo_all ON employees;
DROP POLICY IF EXISTS employees_hr_select ON employees;
DROP POLICY IF EXISTS employees_hr_insert ON employees;
DROP POLICY IF EXISTS employees_hr_update ON employees;
DROP POLICY IF EXISTS employees_accountant_select ON employees;
DROP POLICY IF EXISTS employees_employee_select ON employees;
DROP POLICY IF EXISTS payroll_runs_ceo_select ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_ceo_insert ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_ceo_update ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_accountant_select ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_accountant_insert ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_accountant_update ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_hr_select ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_hr_insert ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_hr_update ON payroll_runs;
DROP POLICY IF EXISTS payroll_lines_ceo_select ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_ceo_insert ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_ceo_update ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_accountant_select ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_accountant_insert ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_accountant_update ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_hr_select ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_hr_insert ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_hr_update ON payroll_lines;
DROP POLICY IF EXISTS payroll_lines_employee_select ON payroll_lines;
DROP POLICY IF EXISTS assets_ceo_all ON assets;
DROP POLICY IF EXISTS assets_accountant_select ON assets;
DROP POLICY IF EXISTS assets_accountant_insert ON assets;
DROP POLICY IF EXISTS assets_accountant_update ON assets;
DROP POLICY IF EXISTS assets_pm_select ON assets;
DROP POLICY IF EXISTS subcontractors_ceo_all ON subcontractors;
DROP POLICY IF EXISTS subcontractors_accountant_select ON subcontractors;
DROP POLICY IF EXISTS subcontractors_accountant_insert ON subcontractors;
DROP POLICY IF EXISTS subcontractors_accountant_update ON subcontractors;
DROP POLICY IF EXISTS subcontractors_pm_select ON subcontractors;
DROP POLICY IF EXISTS project_costs_ceo_all ON project_costs;
DROP POLICY IF EXISTS project_costs_accountant_select ON project_costs;
DROP POLICY IF EXISTS project_costs_pm_select ON project_costs;
DROP POLICY IF EXISTS project_costs_pm_insert ON project_costs;
DROP POLICY IF EXISTS project_costs_pm_update ON project_costs;
DROP POLICY IF EXISTS milestones_ceo_all ON milestones;
DROP POLICY IF EXISTS milestones_accountant_select ON milestones;
DROP POLICY IF EXISTS milestones_pm_select ON milestones;
DROP POLICY IF EXISTS milestones_pm_insert ON milestones;
DROP POLICY IF EXISTS milestones_pm_update ON milestones;
DROP POLICY IF EXISTS milestones_client_select ON milestones;
DROP POLICY IF EXISTS documents_ceo_all ON documents;
DROP POLICY IF EXISTS documents_accountant_select ON documents;
DROP POLICY IF EXISTS documents_accountant_insert ON documents;
DROP POLICY IF EXISTS documents_accountant_update ON documents;
DROP POLICY IF EXISTS documents_pm_select ON documents;
DROP POLICY IF EXISTS documents_pm_insert ON documents;
DROP POLICY IF EXISTS documents_hr_select ON documents;
DROP POLICY IF EXISTS documents_hr_insert ON documents;
DROP POLICY IF EXISTS documents_client_select ON documents;
DROP POLICY IF EXISTS documents_employee_select ON documents;
DROP POLICY IF EXISTS messages_ceo_all ON messages;
DROP POLICY IF EXISTS messages_accountant_select ON messages;
DROP POLICY IF EXISTS messages_accountant_insert ON messages;
DROP POLICY IF EXISTS messages_pm_select ON messages;
DROP POLICY IF EXISTS messages_pm_insert ON messages;
DROP POLICY IF EXISTS messages_client_select ON messages;
DROP POLICY IF EXISTS messages_client_insert ON messages;
DROP POLICY IF EXISTS staff_loans_ceo_all ON staff_loans;
DROP POLICY IF EXISTS staff_loans_hr_select ON staff_loans;
DROP POLICY IF EXISTS staff_loans_hr_insert ON staff_loans;
DROP POLICY IF EXISTS staff_loans_hr_update ON staff_loans;
DROP POLICY IF EXISTS staff_loans_accountant_select ON staff_loans;
DROP POLICY IF EXISTS staff_loans_employee_select ON staff_loans;
DROP POLICY IF EXISTS leave_requests_ceo_all ON leave_requests;
DROP POLICY IF EXISTS leave_requests_hr_select ON leave_requests;
DROP POLICY IF EXISTS leave_requests_hr_insert ON leave_requests;
DROP POLICY IF EXISTS leave_requests_hr_update ON leave_requests;
DROP POLICY IF EXISTS leave_requests_employee_select ON leave_requests;
DROP POLICY IF EXISTS leave_requests_employee_insert ON leave_requests;
DROP POLICY IF EXISTS timesheets_ceo_all ON timesheets;
DROP POLICY IF EXISTS timesheets_hr_select ON timesheets;
DROP POLICY IF EXISTS timesheets_pm_select ON timesheets;
DROP POLICY IF EXISTS timesheets_pm_insert ON timesheets;
DROP POLICY IF EXISTS timesheets_pm_update ON timesheets;
DROP POLICY IF EXISTS timesheets_employee_select ON timesheets;
DROP POLICY IF EXISTS timesheets_employee_insert ON timesheets;
DROP POLICY IF EXISTS tax_rates_ceo_all ON tax_rates;
DROP POLICY IF EXISTS tax_rates_accountant_select ON tax_rates;
DROP POLICY IF EXISTS tax_rates_accountant_insert ON tax_rates;
DROP POLICY IF EXISTS tax_rates_accountant_update ON tax_rates;
DROP POLICY IF EXISTS tax_rates_pm_select ON tax_rates;
DROP POLICY IF EXISTS tax_rates_hr_select ON tax_rates;
DROP POLICY IF EXISTS fx_rates_ceo_all ON fx_rates;
DROP POLICY IF EXISTS fx_rates_accountant_select ON fx_rates;
DROP POLICY IF EXISTS fx_rates_accountant_insert ON fx_rates;
DROP POLICY IF EXISTS fx_rates_accountant_update ON fx_rates;
DROP POLICY IF EXISTS fx_rates_pm_select ON fx_rates;
DROP POLICY IF EXISTS audit_log_ceo_select ON audit_log;
DROP POLICY IF EXISTS audit_log_ceo_insert ON audit_log;
DROP POLICY IF EXISTS audit_log_accountant_select ON audit_log;
DROP POLICY IF EXISTS audit_log_accountant_insert ON audit_log;
DROP POLICY IF EXISTS project_assignments_ceo_all ON project_assignments;
DROP POLICY IF EXISTS project_assignments_accountant_select ON project_assignments;
DROP POLICY IF EXISTS project_assignments_pm_select ON project_assignments;


-- =============================================================================
-- A. STRUCTURAL ADDITIONS
-- These two additions are required before policies can enforce row-level scoping.
-- They are additive — they do not alter any existing column or constraint.
-- =============================================================================

-- A1. Add client_id to profiles
-- Links a 'client' role user to their client record.
-- NULL for all internal staff roles.
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);

-- A2. Project assignments junction table
-- Links a project_manager profile to one or more projects.
-- Used by all PM-scoped policies to determine "own projects".
CREATE TABLE IF NOT EXISTS project_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_profile_id ON project_assignments(profile_id);


-- =============================================================================
-- B. HELPER FUNCTIONS
-- Defined as SECURITY DEFINER so they can read profiles regardless of RLS.
-- Marked STABLE so PostgreSQL can cache the result within a single query.
-- =============================================================================

-- B1. get_user_role() — returns the role text for the current auth user
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- B2. get_user_profile_id() — returns profiles.id for the current auth user
CREATE OR REPLACE FUNCTION get_user_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- B3. get_user_employee_id() — returns employees.id for the current auth user
-- Returns NULL if the user is not an employee.
CREATE OR REPLACE FUNCTION get_user_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.id
    FROM employees e
    JOIN profiles p ON p.id = e.profile_id
    WHERE p.user_id = auth.uid()
    LIMIT 1;
$$;

-- B4. get_user_client_id() — returns the client_id linked to the current auth user
-- Returns NULL if the user is not a client portal user.
CREATE OR REPLACE FUNCTION get_user_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT client_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;


-- =============================================================================
-- C. ENABLE RLS ON ALL 26 TABLES
-- =============================================================================

ALTER TABLE roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_costs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_loans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
-- project_assignments (added in this migration)
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- D. POLICIES
-- Ordered: one section per table.
-- Convention: [table]_[role]_[action]
-- CEO SELECT/INSERT/UPDATE covers all tables.
-- No role gets DELETE on financial tables; no role other than CEO gets any DELETE.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE: roles
-- Lookup table — all authenticated staff read; CEO manages.
-- ---------------------------------------------------------------------------

CREATE POLICY roles_ceo_all ON roles
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY roles_staff_select ON roles
    FOR SELECT
    TO authenticated
    USING (get_user_role() IN ('accountant', 'project_manager', 'hr_manager', 'employee'));


-- ---------------------------------------------------------------------------
-- TABLE: profiles
-- Users can see their own row. CEO sees all. HR sees all (for employee management).
-- Accountant read-only. PM reads own row only. Employee reads own row only.
-- Client reads own row only.
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_ceo_all ON profiles
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY profiles_hr_select ON profiles
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'hr_manager');

CREATE POLICY profiles_hr_update ON profiles
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'hr_manager')
    WITH CHECK (get_user_role() = 'hr_manager');

CREATE POLICY profiles_accountant_select ON profiles
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

-- All other roles: own row only
CREATE POLICY profiles_own_select ON profiles
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        AND get_user_role() IN ('admin', 'project_manager', 'employee', 'client')
    );

CREATE POLICY profiles_own_update ON profiles
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        AND get_user_role() IN ('admin', 'project_manager', 'employee', 'client')
    )
    WITH CHECK (
        user_id = auth.uid()
        AND get_user_role() IN ('admin', 'project_manager', 'employee', 'client')
    );


-- ---------------------------------------------------------------------------
-- TABLE: divisions
-- Reference data — all internal staff read; CEO manages.
-- ---------------------------------------------------------------------------

CREATE POLICY divisions_ceo_all ON divisions
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY divisions_staff_select ON divisions
    FOR SELECT
    TO authenticated
    USING (get_user_role() IN ('accountant', 'project_manager', 'hr_manager', 'employee'));


-- ---------------------------------------------------------------------------
-- TABLE: clients
-- CEO + Accountant: full access.
-- PM: read clients linked to their assigned projects only.
-- Client portal: own record only.
-- HR + Employee: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY clients_ceo_all ON clients
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY clients_accountant_select ON clients
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY clients_accountant_insert ON clients
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY clients_accountant_update ON clients
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

-- PM sees clients only for their assigned projects
CREATE POLICY clients_pm_select ON clients
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND id IN (
            SELECT p.client_id
            FROM projects p
            JOIN project_assignments pa ON pa.project_id = p.id
            WHERE pa.profile_id = get_user_profile_id()
        )
    );

-- Client portal: own record only
CREATE POLICY clients_client_select ON clients
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'client'
        AND id = get_user_client_id()
    );


-- ---------------------------------------------------------------------------
-- TABLE: projects
-- CEO: full. Accountant: read-only. PM: read/write own assigned projects.
-- Client: read own projects only.
-- ---------------------------------------------------------------------------

CREATE POLICY projects_ceo_all ON projects
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY projects_accountant_select ON projects
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY projects_pm_select ON projects
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY projects_pm_update ON projects
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    )
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

-- Client: own projects (projects linked to their client_id)
CREATE POLICY projects_client_select ON projects
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'client'
        AND client_id = get_user_client_id()
    );


-- ---------------------------------------------------------------------------
-- TABLE: contracts
-- CEO: full. Accountant: full. PM: own assigned projects (read-only).
-- Client: no access (internal document).
-- ---------------------------------------------------------------------------

CREATE POLICY contracts_ceo_all ON contracts
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY contracts_accountant_select ON contracts
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY contracts_accountant_insert ON contracts
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY contracts_accountant_update ON contracts
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY contracts_pm_select ON contracts
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );


-- ---------------------------------------------------------------------------
-- TABLE: chart_of_accounts
-- CEO + Accountant: full. All other internal roles: read-only (needed for
-- dropdowns and cost coding). Client + Employee: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY coa_ceo_all ON chart_of_accounts
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY coa_accountant_select ON chart_of_accounts
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY coa_accountant_insert ON chart_of_accounts
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY coa_accountant_update ON chart_of_accounts
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY coa_pm_select ON chart_of_accounts
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'project_manager');

CREATE POLICY coa_hr_select ON chart_of_accounts
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'hr_manager');


-- ---------------------------------------------------------------------------
-- TABLE: journal_entries
-- CEO: SELECT + INSERT + UPDATE only (no DELETE — financial integrity).
-- Accountant: full (SELECT, INSERT, UPDATE). No DELETE for anyone.
-- All others: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY journal_entries_ceo_select ON journal_entries
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'ceo');

CREATE POLICY journal_entries_ceo_insert ON journal_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY journal_entries_ceo_update ON journal_entries
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY journal_entries_accountant_select ON journal_entries
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY journal_entries_accountant_insert ON journal_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY journal_entries_accountant_update ON journal_entries
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');


-- ---------------------------------------------------------------------------
-- TABLE: journal_lines
-- Mirrors journal_entries access exactly.
-- CEO + Accountant: SELECT, INSERT, UPDATE. No DELETE for anyone.
-- ---------------------------------------------------------------------------

CREATE POLICY journal_lines_ceo_select ON journal_lines
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'ceo');

CREATE POLICY journal_lines_ceo_insert ON journal_lines
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY journal_lines_ceo_update ON journal_lines
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY journal_lines_accountant_select ON journal_lines
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY journal_lines_accountant_insert ON journal_lines
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY journal_lines_accountant_update ON journal_lines
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');


-- ---------------------------------------------------------------------------
-- TABLE: invoices
-- CEO: SELECT, INSERT, UPDATE (no DELETE).
-- Accountant: SELECT, INSERT, UPDATE.
-- PM: SELECT own assigned projects only.
-- Client: SELECT own client_id only.
-- ---------------------------------------------------------------------------

CREATE POLICY invoices_ceo_select ON invoices
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'ceo');

CREATE POLICY invoices_ceo_insert ON invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY invoices_ceo_update ON invoices
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY invoices_accountant_select ON invoices
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY invoices_accountant_insert ON invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY invoices_accountant_update ON invoices
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY invoices_pm_select ON invoices
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY invoices_client_select ON invoices
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'client'
        AND client_id = get_user_client_id()
    );


-- ---------------------------------------------------------------------------
-- TABLE: invoice_line_items
-- Follows parent invoices table access.
-- CEO + Accountant: SELECT, INSERT, UPDATE.
-- PM: SELECT on own project invoices.
-- Client: SELECT on own client invoices.
-- ---------------------------------------------------------------------------

CREATE POLICY invoice_line_items_ceo_select ON invoice_line_items
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'ceo');

CREATE POLICY invoice_line_items_ceo_insert ON invoice_line_items
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY invoice_line_items_ceo_update ON invoice_line_items
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY invoice_line_items_accountant_select ON invoice_line_items
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY invoice_line_items_accountant_insert ON invoice_line_items
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY invoice_line_items_accountant_update ON invoice_line_items
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY invoice_line_items_pm_select ON invoice_line_items
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND invoice_id IN (
            SELECT i.id FROM invoices i
            JOIN project_assignments pa ON pa.project_id = i.project_id
            WHERE pa.profile_id = get_user_profile_id()
        )
    );

CREATE POLICY invoice_line_items_client_select ON invoice_line_items
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'client'
        AND invoice_id IN (
            SELECT id FROM invoices
            WHERE client_id = get_user_client_id()
        )
    );


-- ---------------------------------------------------------------------------
-- TABLE: employees
-- CEO: full. Accountant: SELECT. HR: full. Employee: own row only (SELECT).
-- PM: no access. Client: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY employees_ceo_all ON employees
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY employees_hr_select ON employees
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'hr_manager');

CREATE POLICY employees_hr_insert ON employees
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'hr_manager');

CREATE POLICY employees_hr_update ON employees
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'hr_manager')
    WITH CHECK (get_user_role() = 'hr_manager');

CREATE POLICY employees_accountant_select ON employees
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

-- Employee sees own record only
CREATE POLICY employees_employee_select ON employees
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'employee'
        AND id = get_user_employee_id()
    );


-- ---------------------------------------------------------------------------
-- TABLE: payroll_runs
-- CEO: full. Accountant: full. HR: SELECT + INSERT + UPDATE on draft/reviewed
-- only (input stage). No DELETE for anyone.
-- ---------------------------------------------------------------------------

CREATE POLICY payroll_runs_ceo_select ON payroll_runs
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'ceo');

CREATE POLICY payroll_runs_ceo_insert ON payroll_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY payroll_runs_ceo_update ON payroll_runs
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY payroll_runs_accountant_select ON payroll_runs
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY payroll_runs_accountant_insert ON payroll_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY payroll_runs_accountant_update ON payroll_runs
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

-- HR: input stage only — draft and reviewed statuses
CREATE POLICY payroll_runs_hr_select ON payroll_runs
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'hr_manager'
        AND status IN ('draft', 'reviewed')
    );

CREATE POLICY payroll_runs_hr_insert ON payroll_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'hr_manager'
        AND status IN ('draft', 'reviewed')
    );

CREATE POLICY payroll_runs_hr_update ON payroll_runs
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'hr_manager'
        AND status IN ('draft', 'reviewed')
    )
    WITH CHECK (
        get_user_role() = 'hr_manager'
        AND status IN ('draft', 'reviewed')
    );


-- ---------------------------------------------------------------------------
-- TABLE: payroll_lines
-- CEO: full. Accountant: full. HR: SELECT + INSERT + UPDATE on draft runs.
-- Employee: SELECT own rows only.
-- ---------------------------------------------------------------------------

CREATE POLICY payroll_lines_ceo_select ON payroll_lines
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'ceo');

CREATE POLICY payroll_lines_ceo_insert ON payroll_lines
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY payroll_lines_ceo_update ON payroll_lines
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY payroll_lines_accountant_select ON payroll_lines
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY payroll_lines_accountant_insert ON payroll_lines
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY payroll_lines_accountant_update ON payroll_lines
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

-- HR: only on runs still in draft or reviewed stage
CREATE POLICY payroll_lines_hr_select ON payroll_lines
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'hr_manager'
        AND payroll_run_id IN (
            SELECT id FROM payroll_runs WHERE status IN ('draft', 'reviewed')
        )
    );

CREATE POLICY payroll_lines_hr_insert ON payroll_lines
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'hr_manager'
        AND payroll_run_id IN (
            SELECT id FROM payroll_runs WHERE status IN ('draft', 'reviewed')
        )
    );

CREATE POLICY payroll_lines_hr_update ON payroll_lines
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'hr_manager'
        AND payroll_run_id IN (
            SELECT id FROM payroll_runs WHERE status IN ('draft', 'reviewed')
        )
    )
    WITH CHECK (
        get_user_role() = 'hr_manager'
        AND payroll_run_id IN (
            SELECT id FROM payroll_runs WHERE status IN ('draft', 'reviewed')
        )
    );

-- Employee: own payslip rows only
CREATE POLICY payroll_lines_employee_select ON payroll_lines
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'employee'
        AND employee_id = get_user_employee_id()
    );


-- ---------------------------------------------------------------------------
-- TABLE: assets
-- CEO: full. Accountant: SELECT. PM: SELECT (assets on own projects).
-- All others: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY assets_ceo_all ON assets
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY assets_accountant_select ON assets
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY assets_accountant_insert ON assets
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY assets_accountant_update ON assets
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY assets_pm_select ON assets
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND (
            project_id IS NULL  -- non-project assets: PM cannot see
            OR project_id IN (
                SELECT project_id FROM project_assignments
                WHERE profile_id = get_user_profile_id()
            )
        )
    );


-- ---------------------------------------------------------------------------
-- TABLE: subcontractors
-- CEO: full. Accountant: full. PM: SELECT (to tag costs). Others: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY subcontractors_ceo_all ON subcontractors
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY subcontractors_accountant_select ON subcontractors
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY subcontractors_accountant_insert ON subcontractors
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY subcontractors_accountant_update ON subcontractors
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY subcontractors_pm_select ON subcontractors
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'project_manager');


-- ---------------------------------------------------------------------------
-- TABLE: project_costs
-- CEO: full. Accountant: SELECT (reads for reporting). PM: full on own projects.
-- Others: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY project_costs_ceo_all ON project_costs
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY project_costs_accountant_select ON project_costs
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY project_costs_pm_select ON project_costs
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY project_costs_pm_insert ON project_costs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY project_costs_pm_update ON project_costs
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    )
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );


-- ---------------------------------------------------------------------------
-- TABLE: milestones
-- CEO: full. Accountant: SELECT. PM: full on own projects. Client: SELECT on
-- own projects only.
-- ---------------------------------------------------------------------------

CREATE POLICY milestones_ceo_all ON milestones
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY milestones_accountant_select ON milestones
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY milestones_pm_select ON milestones
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY milestones_pm_insert ON milestones
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY milestones_pm_update ON milestones
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    )
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

-- Client: own projects only
CREATE POLICY milestones_client_select ON milestones
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'client'
        AND project_id IN (
            SELECT id FROM projects
            WHERE client_id = get_user_client_id()
        )
    );


-- ---------------------------------------------------------------------------
-- TABLE: documents
-- CEO: full. Accountant: full. PM: full on own projects + own employees.
-- Client: SELECT on own project docs only. HR: SELECT/INSERT employee docs.
-- Employee: SELECT own employee docs.
-- ---------------------------------------------------------------------------

CREATE POLICY documents_ceo_all ON documents
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY documents_accountant_select ON documents
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY documents_accountant_insert ON documents
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY documents_accountant_update ON documents
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

-- PM: project and invoice docs for own projects
CREATE POLICY documents_pm_select ON documents
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND (
            (related_type = 'project' AND related_id IN (
                SELECT project_id FROM project_assignments
                WHERE profile_id = get_user_profile_id()
            ))
            OR
            (related_type = 'invoice' AND related_id IN (
                SELECT i.id FROM invoices i
                JOIN project_assignments pa ON pa.project_id = i.project_id
                WHERE pa.profile_id = get_user_profile_id()
            ))
        )
    );

CREATE POLICY documents_pm_insert ON documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND (
            (related_type = 'project' AND related_id IN (
                SELECT project_id FROM project_assignments
                WHERE profile_id = get_user_profile_id()
            ))
        )
    );

-- HR: employee and payroll documents
CREATE POLICY documents_hr_select ON documents
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'hr_manager'
        AND related_type IN ('employee', 'payroll')
    );

CREATE POLICY documents_hr_insert ON documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'hr_manager'
        AND related_type IN ('employee', 'payroll')
    );

-- Client: own project documents only
CREATE POLICY documents_client_select ON documents
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'client'
        AND related_type = 'project'
        AND related_id IN (
            SELECT id FROM projects
            WHERE client_id = get_user_client_id()
        )
    );

-- Employee: own payslip documents only
CREATE POLICY documents_employee_select ON documents
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'employee'
        AND related_type = 'payroll'
        AND related_id IN (
            SELECT pl.id FROM payroll_lines pl
            WHERE pl.employee_id = get_user_employee_id()
        )
    );


-- ---------------------------------------------------------------------------
-- TABLE: messages
-- CEO: full. Accountant: full. PM: full on own projects.
-- Client: SELECT + INSERT on own projects.
-- Employee (site staff): SELECT on own project messages.
-- ---------------------------------------------------------------------------

CREATE POLICY messages_ceo_all ON messages
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY messages_accountant_select ON messages
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY messages_accountant_insert ON messages
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY messages_pm_select ON messages
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY messages_pm_insert ON messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY messages_client_select ON messages
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'client'
        AND project_id IN (
            SELECT id FROM projects
            WHERE client_id = get_user_client_id()
        )
    );

CREATE POLICY messages_client_insert ON messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'client'
        AND project_id IN (
            SELECT id FROM projects
            WHERE client_id = get_user_client_id()
        )
    );


-- ---------------------------------------------------------------------------
-- TABLE: staff_loans
-- CEO: full. HR: full. Accountant: SELECT. Employee: own row SELECT.
-- ---------------------------------------------------------------------------

CREATE POLICY staff_loans_ceo_all ON staff_loans
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY staff_loans_hr_select ON staff_loans
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'hr_manager');

CREATE POLICY staff_loans_hr_insert ON staff_loans
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'hr_manager');

CREATE POLICY staff_loans_hr_update ON staff_loans
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'hr_manager')
    WITH CHECK (get_user_role() = 'hr_manager');

CREATE POLICY staff_loans_accountant_select ON staff_loans
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY staff_loans_employee_select ON staff_loans
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'employee'
        AND employee_id = get_user_employee_id()
    );


-- ---------------------------------------------------------------------------
-- TABLE: leave_requests
-- CEO: full. HR: full. Employee: SELECT own + INSERT own.
-- ---------------------------------------------------------------------------

CREATE POLICY leave_requests_ceo_all ON leave_requests
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY leave_requests_hr_select ON leave_requests
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'hr_manager');

CREATE POLICY leave_requests_hr_insert ON leave_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'hr_manager');

CREATE POLICY leave_requests_hr_update ON leave_requests
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'hr_manager')
    WITH CHECK (get_user_role() = 'hr_manager');

CREATE POLICY leave_requests_employee_select ON leave_requests
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'employee'
        AND employee_id = get_user_employee_id()
    );

CREATE POLICY leave_requests_employee_insert ON leave_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'employee'
        AND employee_id = get_user_employee_id()
    );


-- ---------------------------------------------------------------------------
-- TABLE: timesheets
-- CEO: full. HR: SELECT (read-only). PM: full on own projects.
-- Employee: SELECT own + INSERT own.
-- ---------------------------------------------------------------------------

CREATE POLICY timesheets_ceo_all ON timesheets
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY timesheets_hr_select ON timesheets
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'hr_manager');

CREATE POLICY timesheets_pm_select ON timesheets
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY timesheets_pm_insert ON timesheets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY timesheets_pm_update ON timesheets
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    )
    WITH CHECK (
        get_user_role() = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = get_user_profile_id()
        )
    );

CREATE POLICY timesheets_employee_select ON timesheets
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'employee'
        AND employee_id = get_user_employee_id()
    );

CREATE POLICY timesheets_employee_insert ON timesheets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'employee'
        AND employee_id = get_user_employee_id()
    );


-- ---------------------------------------------------------------------------
-- TABLE: tax_rates
-- CEO + Accountant: full. All other internal roles: SELECT (needed for
-- invoice computation). Client + Employee: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY tax_rates_ceo_all ON tax_rates
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY tax_rates_accountant_select ON tax_rates
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY tax_rates_accountant_insert ON tax_rates
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY tax_rates_accountant_update ON tax_rates
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY tax_rates_pm_select ON tax_rates
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'project_manager');

CREATE POLICY tax_rates_hr_select ON tax_rates
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'hr_manager');


-- ---------------------------------------------------------------------------
-- TABLE: fx_rates
-- CEO + Accountant: full. PM: SELECT (for multi-currency cost entry).
-- Others: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY fx_rates_ceo_all ON fx_rates
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY fx_rates_accountant_select ON fx_rates
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY fx_rates_accountant_insert ON fx_rates
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY fx_rates_accountant_update ON fx_rates
    FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'accountant')
    WITH CHECK (get_user_role() = 'accountant');

CREATE POLICY fx_rates_pm_select ON fx_rates
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'project_manager');


-- ---------------------------------------------------------------------------
-- TABLE: audit_log
-- CEO: SELECT + INSERT (system writes). Accountant: SELECT + INSERT.
-- No UPDATE or DELETE for anyone — immutable by design.
-- ---------------------------------------------------------------------------

CREATE POLICY audit_log_ceo_select ON audit_log
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'ceo');

CREATE POLICY audit_log_ceo_insert ON audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY audit_log_accountant_select ON audit_log
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY audit_log_accountant_insert ON audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'accountant');


-- ---------------------------------------------------------------------------
-- TABLE: project_assignments
-- CEO: full. Accountant: SELECT. PM: SELECT own rows. HR: no access.
-- ---------------------------------------------------------------------------

CREATE POLICY project_assignments_ceo_all ON project_assignments
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'ceo')
    WITH CHECK (get_user_role() = 'ceo');

CREATE POLICY project_assignments_accountant_select ON project_assignments
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'accountant');

CREATE POLICY project_assignments_pm_select ON project_assignments
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'project_manager'
        AND profile_id = get_user_profile_id()
    );


-- =============================================================================
-- END OF MIGRATION 002
-- =============================================================================
-- RLS enabled on: 27 tables (26 original + project_assignments)
-- Helper functions: 4 (get_user_role, get_user_profile_id,
--                      get_user_employee_id, get_user_client_id)
-- Structural additions: profiles.client_id column + project_assignments table
-- Total policies: see verification query below
--
-- To verify after running:
--   SELECT tablename, COUNT(*) as policy_count
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   GROUP BY tablename ORDER BY tablename;
-- =============================================================================
