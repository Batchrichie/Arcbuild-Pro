-- =============================================================================
-- ARCBUILD PRO — Migration 016: Fix Milestone Status Constraint
-- Module 3.3: Fix constraint conflict blocking 'invoiced' status
--
-- CRITICAL FIX: Two conflicting check constraints exist on milestones.status
-- - Phase 1 (migration 001): milestones_status_check excludes 'invoiced'
--   values ('pending', 'in_progress', 'completed')
-- - Phase 3 (migration 011): chk_milestone_status includes all four values
--   ('pending', 'in_progress', 'completed', 'invoiced')
--
-- The Phase 1 constraint blocks link_milestone_invoice() from setting status='invoiced'
--
-- Solution: Drop the Phase 1 constraint. Keep migration 011 constraint.
-- Both constraints must be on the same column, but only one can be active.
--
-- Safe to re-run: uses DROP IF EXISTS
-- =============================================================================

-- Remove the conflicting Phase 1 constraint
ALTER TABLE milestones
  DROP CONSTRAINT IF EXISTS milestones_status_check;

-- Confirm migration 011 constraint remains
-- Values: 'pending', 'in_progress', 'completed', 'invoiced'
-- This allows all valid milestone statuses including the 'invoiced' state
-- set by link_milestone_invoice()
COMMENT ON CONSTRAINT chk_milestone_status ON milestones IS
  'Milestone status must be one of: pending, in_progress, completed, invoiced. Set to invoiced when linked to invoice by accountant.';

-- =============================================================================
-- VERIFICATION: After applying this migration, run:
-- select constraint_name, check_clause
-- from information_schema.check_constraints
-- where constraint_schema = 'public'
--   and (constraint_name like '%milestone_status%'
--        or constraint_name like '%milestone%status%');
--
-- Expected result: exactly ONE row — chk_milestone_status only
-- Check clause should include all four values: pending, in_progress, completed, invoiced
-- =============================================================================
