-- =============================================================================
-- ARCBUILD PRO — Migration 021: Employee Portal RLS (Module 4.5)
-- Employees need payroll run periods for payslips and project-scoped HR messages.
-- =============================================================================

-- Payroll runs: employee may view runs that include their payslip
DROP POLICY IF EXISTS payroll_runs_employee_select ON payroll_runs;

CREATE POLICY payroll_runs_employee_select ON payroll_runs
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'employee'
    AND id IN (
      SELECT payroll_run_id FROM payroll_lines
      WHERE employee_id = get_user_employee_id()
    )
  );

-- Project assignments: employee sees own assignments (for HR messages routing)
DROP POLICY IF EXISTS project_assignments_employee_select ON project_assignments;

CREATE POLICY project_assignments_employee_select ON project_assignments
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'employee'
    AND profile_id = get_user_profile_id()
  );

-- Messages: employee can read/post on assigned projects
DROP POLICY IF EXISTS messages_employee_select ON messages;
DROP POLICY IF EXISTS messages_employee_insert ON messages;

CREATE POLICY messages_employee_select ON messages
  FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'employee'
    AND (
      sender_id = get_user_profile_id()
      OR project_id IN (
        SELECT project_id FROM project_assignments
        WHERE profile_id = get_user_profile_id()
      )
    )
  );

CREATE POLICY messages_employee_insert ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() = 'employee'
    AND sender_id = get_user_profile_id()
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = get_user_profile_id()
    )
  );
