-- =============================================================================
-- ARCBUILD PRO — Migration 019: Asset Register and Depreciation
-- Module 3.6: Straight-line depreciation, monthly journal posting, asset register view
--
-- Creates:
--   1. compute_asset_depreciation() — NBV and depreciation metrics for one asset
--   2. post_depreciation_journal() — Monthly batch depreciation journal
--   3. dispose_asset() — Asset disposal with gain/loss journal
--   4. asset_register — Read-only register view
--
-- Safe to re-run: uses CREATE OR REPLACE
-- =============================================================================


-- Disposal gain/loss accounts (if not already present)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code)
VALUES
  ('4503', 'Gain on Asset Disposal', 'revenue', '4500'),
  ('6701', 'Loss on Asset Disposal', 'expense', '6700')
ON CONFLICT (account_code) DO NOTHING;


-- =============================================================================
-- FUNCTION 1: compute_asset_depreciation
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_asset_depreciation(
  asset_id_param UUID,
  depreciation_date_param DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  asset assets%ROWTYPE;
  monthly_depreciation NUMERIC;
  months_elapsed NUMERIC;
  total_depreciation_to_date NUMERIC;
  current_nbv NUMERIC;
BEGIN
  SELECT * INTO asset FROM assets WHERE id = asset_id_param;

  IF asset.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asset not found');
  END IF;

  IF asset.is_disposed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asset is disposed');
  END IF;

  IF asset.useful_life_years IS NULL OR asset.useful_life_years <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid useful life');
  END IF;

  monthly_depreciation := ROUND(
    asset.cost / (asset.useful_life_years * 12), 2
  );

  months_elapsed := ROUND(
    EXTRACT(YEAR FROM AGE(depreciation_date_param, asset.acquisition_date)) * 12
    + EXTRACT(MONTH FROM AGE(depreciation_date_param, asset.acquisition_date)),
    2
  );

  total_depreciation_to_date := LEAST(
    monthly_depreciation * months_elapsed,
    asset.cost
  );

  current_nbv := asset.cost - total_depreciation_to_date;

  RETURN jsonb_build_object(
    'success', true,
    'asset_id', asset_id_param,
    'asset_name', asset.asset_name,
    'cost', asset.cost,
    'monthly_depreciation', monthly_depreciation,
    'months_elapsed', months_elapsed,
    'accumulated_depreciation', total_depreciation_to_date,
    'net_book_value', current_nbv,
    'fully_depreciated', current_nbv <= 0
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION compute_asset_depreciation(UUID, DATE) TO authenticated;


-- =============================================================================
-- FUNCTION 2: post_depreciation_journal
-- =============================================================================

CREATE OR REPLACE FUNCTION post_depreciation_journal(
  depreciation_month_start DATE,
  actor_uuid UUID
)
RETURNS JSONB AS $$
DECLARE
  actor profiles%ROWTYPE;
  journal_id UUID;
  asset_rec assets%ROWTYPE;
  component_rec RECORD;
  monthly_dep NUMERIC;
  component_dep NUMERIC;
  total_depreciation NUMERIC := 0;
  asset_count INTEGER := 0;
  period_label TEXT;
  total_dr NUMERIC;
  total_cr NUMERIC;
BEGIN
  SELECT * INTO actor FROM profiles WHERE user_id = actor_uuid;

  IF actor.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  period_label := TO_CHAR(depreciation_month_start, 'Month YYYY');

  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE source_type = 'depreciation'
      AND entry_date >= depreciation_month_start
      AND entry_date < depreciation_month_start + INTERVAL '1 month'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Depreciation already posted for ' || period_label
    );
  END IF;

  INSERT INTO journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    posted_by, created_by
  ) VALUES (
    (depreciation_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    'Monthly Depreciation — ' || period_label,
    'DEP-' || TO_CHAR(depreciation_month_start, 'YYYYMM'),
    'depreciation', NULL,
    actor.id, actor.id
  ) RETURNING id INTO journal_id;

  FOR asset_rec IN
    SELECT * FROM assets
    WHERE is_disposed = FALSE
      AND accumulated_depreciation < cost
      AND acquisition_date <= (depreciation_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE
  LOOP
    IF asset_rec.depreciation_method = 'reducing_balance' THEN
      monthly_dep := ROUND(
        (asset_rec.cost - asset_rec.accumulated_depreciation)
          * (1.0 / asset_rec.useful_life_years) / 12,
        2
      );
    ELSE
      monthly_dep := ROUND(
        asset_rec.cost / (asset_rec.useful_life_years * 12), 2
      );
    END IF;

    monthly_dep := LEAST(
      monthly_dep,
      asset_rec.cost - asset_rec.accumulated_depreciation
    );

    IF monthly_dep <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount,
      description, project_id, division_id
    ) VALUES (
      journal_id,
      COALESCE(asset_rec.depreciation_account, '6401'),
      'Depreciation — Plant & Equipment',
      monthly_dep, 0,
      asset_rec.asset_name || ' — ' || period_label,
      asset_rec.project_id, asset_rec.division_id
    );

    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount,
      description, project_id, division_id
    ) VALUES (
      journal_id, '1211', 'Accumulated Depreciation',
      0, monthly_dep,
      asset_rec.asset_name || ' — ' || period_label,
      asset_rec.project_id, asset_rec.division_id
    );

    UPDATE assets SET
      accumulated_depreciation = accumulated_depreciation + monthly_dep,
      net_book_value = cost - (accumulated_depreciation + monthly_dep)
    WHERE id = asset_rec.id;

    total_depreciation := total_depreciation + monthly_dep;
    asset_count := asset_count + 1;

    FOR component_rec IN
      EXECUTE 'SELECT id, parent_asset_id, component_name, cost, useful_life_years, depreciation_method, accumulated_depreciation, is_disposed
               FROM asset_components
               WHERE parent_asset_id = ' || quote_literal(asset_rec.id) || '
                 AND is_disposed = FALSE
                 AND accumulated_depreciation < cost'
    LOOP
      IF component_rec.depreciation_method = 'reducing_balance' THEN
        component_dep := ROUND(
          (component_rec.cost - component_rec.accumulated_depreciation)
            * (1.0 / component_rec.useful_life_years) / 12,
          2
        );
      ELSE
        component_dep := ROUND(
          component_rec.cost / (component_rec.useful_life_years * 12), 2
        );
      END IF;

      component_dep := LEAST(
        component_dep,
        component_rec.cost - component_rec.accumulated_depreciation
      );

      IF component_dep <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount,
        description, project_id, division_id
      ) VALUES (
        journal_id,
        COALESCE(asset_rec.depreciation_account, '6401'),
        'Depreciation — Plant & Equipment',
        component_dep, 0,
        asset_rec.asset_name || ' / ' || component_rec.component_name || ' — ' || period_label,
        asset_rec.project_id, asset_rec.division_id
      );

      INSERT INTO ledger_entries (
        journal_entry_id, account_code, account_name,
        debit_amount, credit_amount,
        description, project_id, division_id
      ) VALUES (
        journal_id, '1211', 'Accumulated Depreciation',
        0, component_dep,
        asset_rec.asset_name || ' / ' || component_rec.component_name || ' — ' || period_label,
        asset_rec.project_id, asset_rec.division_id
      );

      UPDATE asset_components SET
        accumulated_depreciation = accumulated_depreciation + component_dep
      WHERE id = component_rec.id;

      total_depreciation := total_depreciation + component_dep;
    END LOOP;
  END LOOP;

  UPDATE journal_entries SET source_id = journal_id WHERE id = journal_id;

  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO total_dr, total_cr
  FROM ledger_entries
  WHERE journal_entry_id = journal_id;

  IF asset_count > 0 AND ABS(total_dr - total_cr) >= 0.01 THEN
    RAISE EXCEPTION 'Depreciation journal does not balance. DR: %, CR: %', total_dr, total_cr;
  END IF;

  INSERT INTO audit_log (
    table_name, record_id, action, actor_id, details
  ) VALUES (
    'journal_entries', journal_id, 'DEPRECIATION_POSTED', actor.id,
    jsonb_build_object(
      'period', period_label,
      'assets_depreciated', asset_count,
      'total_depreciation', total_depreciation
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'journal_entry_id', journal_id,
    'period', period_label,
    'assets_depreciated', asset_count,
    'total_depreciation_posted', total_depreciation
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_depreciation_journal(DATE, UUID) TO authenticated;


-- =============================================================================
-- FUNCTION 3: dispose_asset
-- Posts disposal journal: DR accum dep, DR cash (proceeds), CR asset cost, gain/loss plug
-- =============================================================================

CREATE OR REPLACE FUNCTION dispose_asset(
  asset_id_param UUID,
  disposal_date_param DATE,
  disposal_proceeds_param NUMERIC,
  actor_uuid UUID
)
RETURNS JSONB AS $$
DECLARE
  asset assets%ROWTYPE;
  actor profiles%ROWTYPE;
  journal_id UUID;
  nbv NUMERIC;
  gain_loss NUMERIC;
BEGIN
  SELECT * INTO asset FROM assets WHERE id = asset_id_param;
  SELECT * INTO actor FROM profiles WHERE user_id = actor_uuid;

  IF asset.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asset not found');
  END IF;

  IF actor.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF asset.is_disposed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asset already disposed');
  END IF;

  nbv := asset.cost - asset.accumulated_depreciation;
  gain_loss := disposal_proceeds_param - nbv;

  INSERT INTO journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    posted_by, created_by
  ) VALUES (
    disposal_date_param,
    'Asset Disposal — ' || asset.asset_name,
    'DISP-' || asset.asset_code,
    'asset_disposal', asset_id_param,
    actor.id, actor.id
  ) RETURNING id INTO journal_id;

  IF asset.accumulated_depreciation > 0 THEN
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount,
      description, project_id, division_id
    ) VALUES (
      journal_id, '1211', 'Accumulated Depreciation',
      asset.accumulated_depreciation, 0,
      'Remove accumulated depreciation — ' || asset.asset_name,
      asset.project_id, asset.division_id
    );
  END IF;

  IF disposal_proceeds_param > 0 THEN
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount,
      description, project_id, division_id
    ) VALUES (
      journal_id, '1101', 'Cash — GHS',
      disposal_proceeds_param, 0,
      'Disposal proceeds — ' || asset.asset_name,
      asset.project_id, asset.division_id
    );
  END IF;

  INSERT INTO ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount,
    description, project_id, division_id
  ) VALUES (
    journal_id, '1210', 'Property, Plant & Equipment',
    0, asset.cost,
    'Remove asset cost — ' || asset.asset_name,
    asset.project_id, asset.division_id
  );

  IF gain_loss > 0.01 THEN
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount,
      description, project_id, division_id
    ) VALUES (
      journal_id, '4503', 'Gain on Asset Disposal',
      0, gain_loss,
      'Gain on disposal — ' || asset.asset_name,
      asset.project_id, asset.division_id
    );
  ELSIF gain_loss < -0.01 THEN
    INSERT INTO ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount,
      description, project_id, division_id
    ) VALUES (
      journal_id, '6701', 'Loss on Asset Disposal',
      ABS(gain_loss), 0,
      'Loss on disposal — ' || asset.asset_name,
      asset.project_id, asset.division_id
    );
  END IF;

  UPDATE assets SET
    is_disposed = TRUE,
    disposal_date = disposal_date_param,
    disposal_proceeds = disposal_proceeds_param,
    disposal_journal_id = journal_id,
    net_book_value = 0
  WHERE id = asset_id_param;

  UPDATE journal_entries SET source_id = journal_id WHERE id = journal_id;

  INSERT INTO audit_log (
    table_name, record_id, action, actor_id, details
  ) VALUES (
    'assets', asset_id_param, 'ASSET_DISPOSED', actor.id,
    jsonb_build_object(
      'journal_entry_id', journal_id,
      'disposal_proceeds', disposal_proceeds_param,
      'net_book_value', nbv,
      'gain_loss', gain_loss
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'journal_entry_id', journal_id,
    'net_book_value', nbv,
    'gain_loss', gain_loss
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION dispose_asset(UUID, DATE, NUMERIC, UUID) TO authenticated;


-- =============================================================================
-- VIEW: asset_register
-- =============================================================================

CREATE OR REPLACE VIEW asset_register AS
SELECT
  a.id,
  a.asset_code,
  a.asset_name,
  a.category,
  a.cost,
  a.acquisition_date,
  a.useful_life_years,
  a.depreciation_method,
  a.accumulated_depreciation,
  a.net_book_value,
  a.is_disposed,
  a.disposal_date,
  a.disposal_proceeds,
  a.project_id,
  a.division_id,
  p.name AS project_name,
  d.name AS division_name,
  ROUND(
    (a.accumulated_depreciation / NULLIF(a.cost, 0)) * 100, 1
  ) AS depreciation_pct,
  ROUND(
    a.cost / NULLIF(a.useful_life_years * 12, 0), 2
  ) AS monthly_depreciation_charge,
  CASE
    WHEN a.is_disposed THEN 'Disposed'
    WHEN a.net_book_value <= 0 THEN 'Fully Depreciated'
    WHEN a.accumulated_depreciation = 0 THEN 'New'
    ELSE 'Active'
  END AS asset_status
FROM assets a
LEFT JOIN projects p ON p.id = a.project_id
LEFT JOIN divisions d ON d.id = a.division_id
ORDER BY a.asset_code;

GRANT SELECT ON asset_register TO authenticated;


-- =============================================================================
-- VERIFICATION (Step 4): After applying in Supabase SQL editor, run:
--
-- select proname from pg_proc
-- where proname in (
--   'compute_asset_depreciation',
--   'post_depreciation_journal',
--   'dispose_asset'
-- )
-- order by proname;
--
-- select table_name, table_type
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name = 'asset_register';
--
-- Expected: 3 function rows + 1 VIEW row
-- =============================================================================
