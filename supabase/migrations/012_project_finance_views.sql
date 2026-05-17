-- =============================================================================
-- ARCBUILD PRO — Migration 012: Project Finance Views
-- Module 3.1: Project Finance Dashboard
--
-- Creates project_finance_summary view that aggregates:
--   • Contract value and retention tracking
--   • Invoicing summary (invoiced, received, outstanding)
--   • Cost breakdown by category
--   • Budget vs actual with variance
--   • Profit/margin calculations
--   • Financial completion percentage
--
-- Safe to re-run: uses CREATE OR REPLACE VIEW
-- =============================================================================


-- =============================================================================
-- PROJECT_FINANCE_SUMMARY VIEW
-- Core aggregation layer for Project Finance Dashboard
-- =============================================================================

CREATE OR REPLACE VIEW project_finance_summary AS
SELECT
  p.id                        AS project_id,
  p.name                      AS project_name,
  p.status                    AS project_status,
  d.name                      AS division_name,
  c.id                        AS contract_id,
  c.value                     AS contract_value,
  c.retention_percentage,
  c.retention_amount          AS total_retention_held,
  c.retention_released,
  c.start_date                AS contract_start,
  c.end_date                  AS contract_end,

  -- Invoicing summary
  COALESCE(inv.total_invoiced, 0)       AS total_invoiced_ghs,
  COALESCE(inv.total_received, 0)       AS total_received_ghs,
  COALESCE(inv.total_outstanding, 0)    AS total_outstanding_ghs,
  COALESCE(inv.invoice_count, 0)        AS invoice_count,

  -- Cost summary
  COALESCE(pc.total_costs, 0)           AS total_costs_ghs,
  COALESCE(pc.materials_cost, 0)        AS materials_cost_ghs,
  COALESCE(pc.labour_cost, 0)           AS labour_cost_ghs,
  COALESCE(pc.subcontractor_cost, 0)    AS subcontractor_cost_ghs,
  COALESCE(pc.equipment_cost, 0)        AS equipment_cost_ghs,
  COALESCE(pc.other_cost, 0)            AS other_cost_ghs,

  -- Budget summary
  COALESCE(pb.total_budget, 0)          AS total_budget_ghs,
  COALESCE(pb.materials_budget, 0)      AS materials_budget_ghs,
  COALESCE(pb.labour_budget, 0)         AS labour_budget_ghs,
  COALESCE(pb.subcontractor_budget, 0)  AS subcontractor_budget_ghs,
  COALESCE(pb.equipment_budget, 0)      AS equipment_budget_ghs,
  COALESCE(pb.other_budget, 0)          AS other_budget_ghs,

  -- Computed metrics
  COALESCE(inv.total_invoiced, 0) - COALESCE(pc.total_costs, 0)
    AS gross_profit_ghs,
  CASE
    WHEN COALESCE(inv.total_invoiced, 0) > 0
    THEN ROUND(
      (COALESCE(inv.total_invoiced, 0) - COALESCE(pc.total_costs, 0))
      / inv.total_invoiced * 100, 2)
    ELSE 0
  END AS gross_margin_pct,
  CASE
    WHEN c.value > 0
    THEN ROUND(COALESCE(inv.total_invoiced, 0) / c.value * 100, 2)
    ELSE 0
  END AS financial_completion_pct,
  COALESCE(pb.total_budget, 0) - COALESCE(pc.total_costs, 0)
    AS budget_remaining_ghs,

  p.created_at

FROM projects p
LEFT JOIN divisions d ON d.id = p.division_id
LEFT JOIN contracts c ON c.project_id = p.id

LEFT JOIN (
  SELECT
    project_id,
    SUM(gross_total_ghs)      AS total_invoiced,
    SUM(CASE WHEN status = 'paid' THEN expected_receipt_ghs ELSE 0 END) AS total_received,
    SUM(CASE WHEN status IN ('sent','approved') THEN expected_receipt_ghs ELSE 0 END) AS total_outstanding,
    COUNT(*)                  AS invoice_count
  FROM invoices
  WHERE status != 'draft'
  GROUP BY project_id
) inv ON inv.project_id = p.id

LEFT JOIN (
  SELECT
    project_id,
    SUM(COALESCE(amount_ghs, amount)) AS total_costs,
    SUM(CASE WHEN cost_type = 'Materials' THEN COALESCE(amount_ghs, amount) ELSE 0 END) AS materials_cost,
    SUM(CASE WHEN cost_type = 'Labour' THEN COALESCE(amount_ghs, amount) ELSE 0 END) AS labour_cost,
    SUM(CASE WHEN cost_type = 'Subcontractors' THEN COALESCE(amount_ghs, amount) ELSE 0 END) AS subcontractor_cost,
    SUM(CASE WHEN cost_type = 'Equipment Hire' THEN COALESCE(amount_ghs, amount) ELSE 0 END) AS equipment_cost,
    SUM(CASE WHEN cost_type = 'Other' THEN COALESCE(amount_ghs, amount) ELSE 0 END) AS other_cost
  FROM project_costs
  GROUP BY project_id
) pc ON pc.project_id = p.id

LEFT JOIN (
  SELECT
    project_id,
    SUM(budgeted_amount)      AS total_budget,
    SUM(CASE WHEN cost_category = 'Materials' THEN budgeted_amount ELSE 0 END) AS materials_budget,
    SUM(CASE WHEN cost_category = 'Labour' THEN budgeted_amount ELSE 0 END) AS labour_budget,
    SUM(CASE WHEN cost_category = 'Subcontractors' THEN budgeted_amount ELSE 0 END) AS subcontractor_budget,
    SUM(CASE WHEN cost_category = 'Equipment Hire' THEN budgeted_amount ELSE 0 END) AS equipment_budget,
    SUM(CASE WHEN cost_category = 'Other' THEN budgeted_amount ELSE 0 END) AS other_budget
  FROM project_budgets
  GROUP BY project_id
) pb ON pb.project_id = p.id;

-- Grant select permission to authenticated users
GRANT SELECT ON project_finance_summary TO authenticated;


-- =============================================================================
-- END OF MIGRATION 012
-- =============================================================================
-- View Created:
--   • project_finance_summary: Unified project finance aggregation layer
-- =============================================================================
