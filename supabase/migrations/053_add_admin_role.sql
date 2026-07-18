-- =============================================================================
-- ARCBUILD PRO — Migration 053: Add missing admin role
--
-- Adds the new admin portal role to the roles lookup table.
-- =============================================================================

INSERT INTO roles (name, description)
SELECT 'admin', 'Admin — delegated system management and configuration access'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'admin'
);
