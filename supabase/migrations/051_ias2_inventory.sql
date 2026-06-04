-- =============================================================================
-- ARCBUILD PRO — Migration 051: IAS 2 Inventories
-- Module 5.2: Inventory costing, weighted average cost, NRV testing, and movement schedule.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  quantity NUMERIC(18,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  nrv NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(18,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  write_down_amount NUMERIC(18,2) GENERATED ALWAYS AS (
    GREATEST(quantity * unit_cost - nrv, 0)
  ) STORED,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_project_id ON inventory_items(project_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'consumption', 'adjustment')),
  quantity NUMERIC(18,2) NOT NULL,
  unit_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(18,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  project_cost_id UUID REFERENCES project_costs(id) ON DELETE SET NULL,
  reference TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_project_cost_id ON inventory_movements(project_cost_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(movement_date);

INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code)
VALUES
  ('6801', 'Inventory Write-down Expense', 'expense', '6800')
ON CONFLICT (account_code) DO NOTHING;

CREATE OR REPLACE FUNCTION update_weighted_average_cost(
  p_item_id UUID,
  p_new_qty NUMERIC,
  p_new_cost NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  item inventory_items%ROWTYPE;
  new_total_qty NUMERIC;
  new_average_cost NUMERIC;
BEGIN
  SELECT * INTO item FROM inventory_items WHERE id = p_item_id;
  IF item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory item not found');
  END IF;

  IF p_new_qty <= 0 OR p_new_cost < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'New quantity and cost must be valid');
  END IF;

  new_total_qty := item.quantity + p_new_qty;
  IF new_total_qty <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resulting quantity must be greater than zero');
  END IF;

  IF item.quantity = 0 THEN
    new_average_cost := ROUND(p_new_cost, 2);
  ELSE
    new_average_cost := ROUND(
      ((item.quantity * item.unit_cost) + (p_new_qty * p_new_cost)) / new_total_qty,
      2
    );
  END IF;

  UPDATE inventory_items
  SET quantity = new_total_qty,
      unit_cost = new_average_cost,
      updated_at = NOW()
  WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'inventory_item_id', p_item_id,
    'quantity', new_total_qty,
    'unit_cost', new_average_cost
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_weighted_average_cost(UUID, NUMERIC, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION run_nrv_test(
  p_item_id UUID,
  p_nrv NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  item inventory_items%ROWTYPE;
  journal_id UUID;
  write_down_amount NUMERIC;
  description TEXT;
BEGIN
  SELECT * INTO item FROM inventory_items WHERE id = p_item_id;
  IF item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory item not found');
  END IF;

  IF p_nrv < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NRV must be non-negative');
  END IF;

  write_down_amount := GREATEST(item.quantity * item.unit_cost - p_nrv, 0);

  UPDATE inventory_items
  SET nrv = p_nrv,
      updated_at = NOW()
  WHERE id = p_item_id;

  IF write_down_amount > 0 THEN
    description := 'Inventory NRV write-down — ' || item.item_name;

    INSERT INTO journal_entries (
      entry_date, description, reference,
      source_type, source_id,
      created_by, is_posted
    ) VALUES (
      CURRENT_DATE,
      description,
      'NRV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_item_id::text, 1, 8),
      'inventory_nrv_test', p_item_id,
      (SELECT id FROM profiles WHERE user_id = auth.uid()),
      TRUE
    ) RETURNING id INTO journal_id;

    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id
    ) VALUES (
      journal_id, '6801', 'Inventory Write-down Expense',
      write_down_amount, 0, description, item.project_id
    );

    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description, project_id
    ) VALUES (
      journal_id, '1141', 'Inventory Write-down',
      0, write_down_amount, description, item.project_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'inventory_item_id', p_item_id,
    'nrv', p_nrv,
    'write_down_amount', write_down_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION run_nrv_test(UUID, NUMERIC) TO authenticated;

CREATE OR REPLACE VIEW inventory_movement_schedule_view AS
WITH monthly AS (
  SELECT
    inventory_item_id,
    date_trunc('month', movement_date)::DATE AS month_start,
    SUM(CASE WHEN movement_type = 'purchase' THEN quantity ELSE 0 END) AS purchases_qty,
    SUM(CASE WHEN movement_type = 'purchase' THEN total_cost ELSE 0 END) AS purchases_value,
    SUM(CASE WHEN movement_type = 'consumption' THEN quantity ELSE 0 END) AS consumption_qty,
    SUM(CASE WHEN movement_type = 'consumption' THEN total_cost ELSE 0 END) AS consumption_value
  FROM inventory_movements
  GROUP BY inventory_item_id, month_start
),
running AS (
  SELECT
    m.inventory_item_id,
    m.month_start,
    m.purchases_qty,
    m.purchases_value,
    m.consumption_qty,
    m.consumption_value,
    SUM(m.purchases_qty - m.consumption_qty) OVER (
      PARTITION BY m.inventory_item_id ORDER BY m.month_start
    ) AS closing_quantity,
    SUM(m.purchases_value - m.consumption_value) OVER (
      PARTITION BY m.inventory_item_id ORDER BY m.month_start
    ) AS closing_value
  FROM monthly m
)
SELECT
  r.inventory_item_id,
  i.item_name,
  EXTRACT(YEAR FROM r.month_start)::INT AS year,
  EXTRACT(MONTH FROM r.month_start)::INT AS month,
  COALESCE(LAG(r.closing_quantity) OVER (PARTITION BY r.inventory_item_id ORDER BY r.month_start), 0) AS opening_quantity,
  COALESCE(LAG(r.closing_value) OVER (PARTITION BY r.inventory_item_id ORDER BY r.month_start), 0) AS opening_value,
  r.closing_quantity AS closing_quantity,
  r.closing_value AS closing_value,
  r.purchases_qty,
  r.purchases_value,
  r.consumption_qty,
  r.consumption_value
FROM running r
JOIN inventory_items i ON i.id = r.inventory_item_id;

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_items_admin_select ON inventory_items;
CREATE POLICY inventory_items_admin_select ON inventory_items FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

DROP POLICY IF EXISTS inventory_items_pm_select ON inventory_items;
CREATE POLICY inventory_items_pm_select ON inventory_items FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS inventory_items_admin_insert ON inventory_items;
CREATE POLICY inventory_items_admin_insert ON inventory_items FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

DROP POLICY IF EXISTS inventory_movements_admin_select ON inventory_movements;
CREATE POLICY inventory_movements_admin_select ON inventory_movements FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));

DROP POLICY IF EXISTS inventory_movements_pm_select ON inventory_movements;
CREATE POLICY inventory_movements_pm_select ON inventory_movements FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'project_manager'
    AND inventory_item_id IN (
      SELECT id FROM inventory_items WHERE project_id IN (
        SELECT project_id FROM project_assignments
        WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS inventory_movements_admin_insert ON inventory_movements;
CREATE POLICY inventory_movements_admin_insert ON inventory_movements FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant'));
