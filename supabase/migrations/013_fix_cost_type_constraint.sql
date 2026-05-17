-- =============================================================================
-- ARCBUILD PRO — Migration 013: Fix Cost Type Constraint Conflict
-- Module 3.2: Cost Tagging Engine — Prerequisite Fix
--
-- CRITICAL FIX: Two conflicting check constraints exist on project_costs.cost_type
-- - Phase 1 (migration 001): project_costs_cost_type_check uses lowercase
--   values ('material', 'labour', 'subcontractor', 'equipment', 'overhead')
-- - Phase 3 (migration 011): chk_project_cost_type uses proper values
--   ('Materials', 'Labour', 'Subcontractors', 'Equipment Hire', 'Other')
--
-- These constraints are mutually exclusive. No value satisfies both.
-- Result: NO inserts possible on project_costs table.
--
-- Solution: Drop the Phase 1 constraint. Keep migration 011 constraint.
-- Both constraints must be on the same column, but only one can be active.
--
-- Safe to re-run: uses DROP IF EXISTS
-- =============================================================================

-- Remove the conflicting Phase 1 constraint
ALTER TABLE project_costs
  DROP CONSTRAINT IF EXISTS project_costs_cost_type_check;

-- Confirm migration 011 constraint remains
-- Values: 'Materials', 'Labour', 'Subcontractors', 'Equipment Hire', 'Other'
-- These match:
--   • project_budgets.cost_category
--   • get_cost_account_code() function mapping
--   • Cost entry form dropdowns in React
COMMENT ON CONSTRAINT chk_project_cost_type ON project_costs IS
  'Cost type must be one of: Materials, Labour, Subcontractors, Equipment Hire, Other. Matches project_budgets cost categories.';

-- =============================================================================
-- VERIFICATION: After applying this migration, run:
-- select constraint_name, check_clause
-- from information_schema.check_constraints
-- where constraint_schema = 'public'
--   and constraint_name like '%cost_type%';
--
-- Expected result: exactly ONE row — chk_project_cost_type only
-- =============================================================================
