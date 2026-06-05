# IFRS/IAS Compliance Implementation — Copilot Instructions
> Paste each section below directly into GitHub Copilot Chat, in phase order.
> Each prompt is self-contained and references the existing codebase structure.

---

## PHASE 1 — Critical (implement first)

---

### Prompt 1 of 3 — IFRS 16: Leases

```
You are working on a Supabase/PostgreSQL construction management system called Arcbuild Pro.
The codebase has migrations in /supabase/migrations/ and JS services in /src/services/.

PROBLEM: Equipment leases are currently expensed immediately to GL account 5104 (Equipment Hire)
via project_costs with cost_type = 'Equipment Hire'. This violates IFRS 16 which requires
capitalization as a Right-of-Use (ROU) asset with a matching lease liability.

TASK: Implement IFRS 16 lease accounting. Do the following:

1. Create migration file: supabase/migrations/040_ifrs16_leases.sql
   Create these tables:
   
   leases (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid REFERENCES projects(id),
     asset_description text NOT NULL,          -- e.g. "CAT 320 Excavator"
     lease_commencement_date date NOT NULL,
     lease_term_months int NOT NULL,
     monthly_payment numeric(15,2) NOT NULL,
     discount_rate numeric(5,4) NOT NULL,      -- e.g. 0.1200 for 12%
     rou_asset_value numeric(15,2),            -- computed: PV of lease payments
     lease_liability_opening numeric(15,2),    -- same as rou_asset_value at start
     status text DEFAULT 'active' CHECK (status IN ('active','modified','terminated')),
     created_at timestamptz DEFAULT now()
   );

   lease_schedules (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     lease_id uuid REFERENCES leases(id) ON DELETE CASCADE,
     period_number int NOT NULL,               -- 1 to lease_term_months
     period_date date NOT NULL,
     opening_liability numeric(15,2),
     interest_expense numeric(15,2),           -- opening_liability * monthly_rate
     lease_payment numeric(15,2),
     closing_liability numeric(15,2),          -- opening + interest - payment
     rou_depreciation numeric(15,2),           -- rou_asset_value / lease_term_months
     posted boolean DEFAULT false
   );

2. Create a Postgres function: calculate_lease_schedule(p_lease_id uuid)
   - Computes PV of lease payments: PV = payment * [(1 - (1+r)^-n) / r]
     where r = discount_rate/12 (monthly rate), n = lease_term_months
   - Updates leases.rou_asset_value and leases.lease_liability_opening with the PV
   - Inserts one row per period into lease_schedules
   - Returns the full schedule

3. Create a Postgres function: post_lease_journal_entry(p_lease_id uuid, p_period int)
   - On lease commencement (period 1): 
       DR 1230 (Right-of-Use Assets) = rou_asset_value
       CR 2400 (Lease Liability) = lease_liability_opening
   - Each period:
       DR 6402 (ROU Depreciation Expense) = rou_depreciation
       CR 1231 (Accumulated ROU Depreciation) = rou_depreciation
       DR 2400 (Lease Liability) = closing adjustment
       DR 6501 (Interest Expense – Lease) = interest_expense
       CR 2100 (Accounts Payable / Cash) = lease_payment
   - Marks lease_schedules.posted = true for that period
   - Add GL accounts 1230, 1231, 2400, 6402, 6501 to the chart_of_accounts table if not present

4. Create /src/services/leaseService.js with:
   - createLease(leaseData) — inserts into leases, calls calculate_lease_schedule
   - postMonthlyLeaseEntries(month, year) — posts all unposted schedule rows for that period
   - getLeaseSchedule(leaseId) — returns full amortization schedule
   - getLeaseRollForward(projectId) — returns ROU asset and liability balances

5. Add a check in the existing project_costs insert path: if cost_type = 'Equipment Hire'
   and the duration suggests a lease (e.g. notes contain 'monthly' or amount > threshold),
   log a console.warn prompting the user to use createLease() instead.

Use the existing journal_entries table schema from migration 001_initial_schema.sql for all
GL postings. Match the pattern used in post_depreciation_journal() in migration 019_asset_depreciation.sql.
```

---

### Prompt 2 of 3 — IAS 36: Impairment of Assets

```
You are working on a Supabase/PostgreSQL construction management system called Arcbuild Pro.
The codebase has migrations in /supabase/migrations/ and JS services in /src/services/.

PROBLEM: There is zero impairment testing. Receivables (GL 1110), inventory (GL 1140),
fixed assets (GL 1210), and intangibles (GL 1220) have no recoverable amount assessment.

TASK: Implement IAS 36 impairment framework. Do the following:

1. Create migration: supabase/migrations/041_ias36_impairment.sql

   impairment_assessments (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     assessment_date date NOT NULL,
     asset_type text NOT NULL CHECK (asset_type IN ('receivable','inventory','fixed_asset','intangible')),
     asset_id uuid,                            -- FK to assets.id for fixed_asset/intangible
     gl_account text,                          -- e.g. '1110' for receivables
     carrying_amount numeric(15,2) NOT NULL,
     recoverable_amount numeric(15,2),         -- null until assessed
     impairment_loss numeric(15,2) GENERATED ALWAYS AS (
       GREATEST(0, carrying_amount - COALESCE(recoverable_amount, carrying_amount))
     ) STORED,
     basis text,                               -- 'aging','nrv','value_in_use','fair_value'
     notes text,
     posted boolean DEFAULT false,
     created_by uuid REFERENCES auth.users(id),
     created_at timestamptz DEFAULT now()
   );

   receivable_aging (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     run_date date NOT NULL,
     invoice_id uuid REFERENCES invoices(id),
     customer_id uuid,
     invoice_date date,
     due_date date,
     outstanding_amount numeric(15,2),
     days_overdue int GENERATED ALWAYS AS (
       GREATEST(0, CURRENT_DATE - due_date)
     ) STORED,
     aging_bucket text GENERATED ALWAYS AS (
       CASE
         WHEN CURRENT_DATE <= due_date THEN 'current'
         WHEN CURRENT_DATE - due_date <= 30 THEN '1-30 days'
         WHEN CURRENT_DATE - due_date <= 60 THEN '31-60 days'
         WHEN CURRENT_DATE - due_date <= 90 THEN '61-90 days'
         ELSE 'over 90 days'
       END
     ) STORED,
     provision_rate numeric(5,4),              -- e.g. 0.05 for 5%
     provision_amount numeric(15,2)            -- outstanding_amount * provision_rate
   );

2. Create Postgres function: run_receivables_aging(p_run_date date)
   - Queries all unpaid/partially-paid invoices
   - Applies default provision rates: current=0%, 1-30=2%, 31-60=5%, 61-90=15%, >90=50%
   - Inserts into receivable_aging
   - Creates one impairment_assessment row per aging bucket with basis='aging'
   - Returns summary by bucket

3. Create Postgres function: post_impairment_journal(p_assessment_id uuid)
   - If impairment_loss > 0:
       DR 6800 (Impairment Loss) = impairment_loss
       CR 1112 (Allowance for Doubtful Debts) for receivables
       CR 1141 (Inventory Obsolescence Reserve) for inventory  
       CR 1211 (Accumulated Depreciation / Impairment) for fixed assets
   - Marks assessment.posted = true
   - Add GL accounts 6800, 1112, 1141 to chart_of_accounts if not present

4. Create Postgres function: check_asset_impairment_indicators(p_asset_id uuid)
   - Returns a JSON object flagging:
     { market_decline: bool, utilization_low: bool, project_cancelled: bool, 
       carrying_exceeds_market: bool, indicators_found: bool }
   - market_decline: true if asset category has had disposal losses > 20% in last 12 months
   - utilization_low: true if asset has no project_id assignments in 6+ months
   - project_cancelled: true if linked project status = 'cancelled'

5. Create /src/services/impairmentService.js with:
   - runMonthlyImpairmentReview(month, year) — triggers aging + asset indicator checks
   - postImpairmentLoss(assessmentId) — calls post_impairment_journal
   - getImpairmentSummary() — returns all unposted assessments grouped by asset_type
   - reverseImpairment(assessmentId, reversalAmount) — partial/full reversal per IAS 36 para 117

Use the existing journal_entries table and GL posting pattern from migration 019_asset_depreciation.sql.
```

---

### Prompt 3 of 3 — IFRS 15: Performance Obligations & Variable Consideration

```
You are working on a Supabase/PostgreSQL construction management system called Arcbuild Pro.
The codebase has migrations in /supabase/migrations/ and JS services in /src/services/.
Migration 032_phase_c_revenue_recognition.sql and the revenue_recognition table already exist.

PROBLEM: The current IFRS 15 implementation treats each contract as a single performance
obligation and does not handle variable consideration (discounts, penalties, bonuses) or
contract modifications.

TASK: Extend the existing IFRS 15 implementation. Do the following:

1. Create migration: supabase/migrations/042_ifrs15_extensions.sql

   performance_obligations (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
     description text NOT NULL,               -- e.g. "Design phase", "Construction", "Handover"
     standalone_selling_price numeric(15,2) NOT NULL,
     allocated_transaction_price numeric(15,2), -- computed via SSP allocation
     satisfaction_method text DEFAULT 'over_time' 
       CHECK (satisfaction_method IN ('over_time','point_in_time')),
     pct_complete numeric(5,2) DEFAULT 0,
     status text DEFAULT 'pending' 
       CHECK (status IN ('pending','in_progress','completed')),
     completion_evidence text,               -- milestone_id or description
     created_at timestamptz DEFAULT now()
   );

   variable_consideration (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid REFERENCES projects(id),
     type text NOT NULL CHECK (type IN ('bonus','penalty','discount','volume_rebate','claim')),
     description text,
     estimated_amount numeric(15,2) NOT NULL, -- positive = revenue add, negative = reduction
     constraint_applied boolean DEFAULT true, -- IFRS 15 para 56: constrain if significant reversal likely
     probability numeric(5,4),               -- expected value method: 0.00 to 1.00
     recognised_amount numeric(15,2) GENERATED ALWAYS AS (
       CASE WHEN constraint_applied THEN 0 
            ELSE estimated_amount * COALESCE(probability, 1) END
     ) STORED,
     effective_date date,
     created_at timestamptz DEFAULT now()
   );

   contract_modifications (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid REFERENCES projects(id),
     modification_date date NOT NULL,
     description text NOT NULL,
     original_contract_value numeric(15,2),
     modified_contract_value numeric(15,2),
     price_change numeric(15,2) GENERATED ALWAYS AS (
       modified_contract_value - original_contract_value
     ) STORED,
     accounting_treatment text CHECK (
       accounting_treatment IN (
         'separate_contract',      -- new distinct PO at standalone price
         'prospective',            -- remaining POs re-allocated going forward
         'cumulative_catch_up'     -- restate cumulative revenue in current period
       )
     ),
     approved_by text,
     journal_posted boolean DEFAULT false,
     created_at timestamptz DEFAULT now()
   );

2. Create Postgres function: allocate_transaction_price(p_project_id uuid)
   - Sums standalone_selling_price across all performance_obligations for the project
   - Adds recognised_amount from variable_consideration (where constraint_applied = false)
   - Allocates contract_value proportionally:
     allocated = (ssp / total_ssp) * adjusted_transaction_price
   - Updates performance_obligations.allocated_transaction_price for each row
   - Returns allocation table

3. Update existing function post_revenue_recognition_journal() to:
   - Call allocate_transaction_price() first if performance_obligations rows exist for the project
   - If no performance_obligations exist (legacy), fall back to current single-obligation logic
   - Compute revenue per PO: recognised = allocated_transaction_price * (pct_complete / 100)
   - Sum across all POs for total period revenue

4. Create Postgres function: record_contract_modification(p_modification_id uuid)
   - For 'cumulative_catch_up': recalculate all prior revenue_recognition rows and post
     a catch-up journal DR/CR to account 4600 (Contract Revenue Recognised)
   - For 'prospective': update projects.contract_value, re-run allocate_transaction_price()
   - For 'separate_contract': create a new performance_obligation row

5. Create /src/services/performanceObligationService.js with:
   - addPerformanceObligation(projectId, data)
   - updatePOCompletion(poId, pctComplete)
   - addVariableConsideration(projectId, data)
   - recordModification(modificationData)
   - getRevenueAllocationSummary(projectId) — shows per-PO revenue recognised vs. total

Match the existing migration style and use the existing journal_entries and revenue_recognition tables.
```

---

## PHASE 2 — Important (implement after Phase 1)

---

### Prompt 4 of 5 — IAS 16: Revaluation model & component depreciation

```
You are working on a Supabase/PostgreSQL construction management system called Arcbuild Pro.

PROBLEM: The assets table supports only the cost model. IAS 16 also allows the revaluation
model. Reducing-balance depreciation is defined but not computed. There is no component
depreciation or asset roll-forward report.

TASK:

1. Create migration: supabase/migrations/043_ias16_extensions.sql

   Add to assets table:
   - measurement_model text DEFAULT 'cost' CHECK (measurement_model IN ('cost','revaluation'))
   - last_revaluation_date date
   - revalued_amount numeric(15,2)
   - revaluation_surplus numeric(15,2) DEFAULT 0  -- cumulative, goes to equity GL 3300

   asset_components (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     parent_asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
     component_name text NOT NULL,             -- e.g. "Engine", "Frame", "Interior fit-out"
     cost numeric(15,2) NOT NULL,
     useful_life_years numeric(5,2) NOT NULL,
     depreciation_method text DEFAULT 'straight_line',
     accumulated_depreciation numeric(15,2) DEFAULT 0,
     is_disposed boolean DEFAULT false
   );

   asset_revaluations (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     asset_id uuid REFERENCES assets(id),
     revaluation_date date NOT NULL,
     carrying_amount_before numeric(15,2),
     fair_value numeric(15,2),
     surplus_or_deficit numeric(15,2),         -- positive=surplus (equity), negative=P&L
     valuer_name text,
     posted boolean DEFAULT false,
     created_at timestamptz DEFAULT now()
   );

2. Fix the reducing-balance depreciation computation in the existing post_depreciation_journal()
   function (migration 019_asset_depreciation.sql):
   - Currently only straight_line is computed
   - Add: IF depreciation_method = 'reducing_balance' THEN
       monthly_dep = (net_book_value * (1 / useful_life_years)) / 12
     where net_book_value = cost - accumulated_depreciation

3. Create function: post_revaluation_journal(p_revaluation_id uuid)
   - If fair_value > carrying_amount (surplus):
       DR 1210 (PP&E) = increase in gross value
       CR 3300 (Revaluation Surplus – Equity) = surplus
   - If fair_value < carrying_amount (deficit):
       First reverse any existing revaluation_surplus for this asset
       DR 6700 (Revaluation Deficit / Loss) = remainder
       CR 1210 (PP&E) = decrease
   - Resets accumulated depreciation to zero on revaluation date (gross-up method)

4. Modify post_depreciation_journal() to also iterate asset_components and post
   depreciation per component using the same journal pattern as the parent asset.

5. Create view: asset_roll_forward_view
   SELECT asset_id, financial_year,
     opening_cost, additions, disposals_cost, closing_cost,
     opening_accum_dep, depreciation_charge, disposals_accum_dep, closing_accum_dep,
     closing_nbv
   FROM ... (join assets, journal_entries filtered by GL 1210, 1211, and fiscal year)

6. Update /src/services/assetService.js (or create if missing):
   - revalueAsset(assetId, fairValue, valuationDate, valuerName)
   - addAssetComponent(assetId, componentData)
   - getAssetRollForward(financialYear)
```

---

### Prompt 5 of 5 — IAS 37: Provisions & IAS 2: Inventories

```
You are working on a Supabase/PostgreSQL construction management system called Arcbuild Pro.

PROBLEM A (IAS 37): There is no general provisions framework. Retention is tracked but not
modelled as a formal provision. No warranty, legal dispute, or onerous contract provisions exist.

PROBLEM B (IAS 2): GL account 1140 exists but there is no costing method, no inventory
movement schedule, and no lower-of-cost-or-NRV testing.

TASK — Part A: IAS 37 Provisions

1. Create migration: supabase/migrations/044_ias37_provisions.sql

   provisions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid REFERENCES projects(id),
     provision_type text NOT NULL CHECK (provision_type IN (
       'warranty','legal_dispute','onerous_contract',
       'employee_leave','restructuring','environmental','other'
     )),
     description text NOT NULL,
     opening_balance numeric(15,2) DEFAULT 0,
     additions numeric(15,2) DEFAULT 0,
     utilised numeric(15,2) DEFAULT 0,
     released numeric(15,2) DEFAULT 0,
     closing_balance numeric(15,2) GENERATED ALWAYS AS (
       opening_balance + additions - utilised - released
     ) STORED,
     gl_account text DEFAULT '2500',          -- Provisions (non-current) or 2501 current
     basis text NOT NULL,                     -- narrative: how was the amount estimated?
     review_date date,
     created_by uuid REFERENCES auth.users(id),
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now()
   );

2. Create function: post_provision_journal(p_provision_id uuid, p_movement_type text, p_amount numeric)
   - movement_type IN ('addition','utilisation','release')
   - addition:    DR 6900 (Provision Expense) / CR 2500 (Provisions)
   - utilisation: DR 2500 (Provisions) / CR 2100 (Accounts Payable or Cash)
   - release:     DR 2500 (Provisions) / CR 4700 (Provision Release – Other Income)

3. Migrate existing retention logic: create a companion provision row in provisions table
   for each project with provision_type = 'warranty' or keep as contract liability — 
   add a comment in the code distinguishing IAS 37 provisions from IFRS 15 contract liabilities.

TASK — Part B: IAS 2 Inventories

4. Add to migration 044 (or create 045_ias2_inventory.sql):

   inventory_items (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid REFERENCES projects(id),
     material_description text NOT NULL,
     unit_of_measure text NOT NULL,           -- m3, kg, bags, litres, each
     quantity_on_hand numeric(12,3) DEFAULT 0,
     costing_method text DEFAULT 'weighted_average' 
       CHECK (costing_method IN ('fifo','weighted_average','specific_identification')),
     unit_cost numeric(15,4),                 -- weighted avg or last purchase cost
     total_cost numeric(15,2) GENERATED ALWAYS AS (quantity_on_hand * unit_cost) STORED,
     net_realisable_value numeric(15,2),      -- updated at period end
     write_down_amount numeric(15,2) GENERATED ALWAYS AS (
       GREATEST(0, (quantity_on_hand * unit_cost) - COALESCE(net_realisable_value, quantity_on_hand * unit_cost))
     ) STORED,
     last_counted_date date,
     created_at timestamptz DEFAULT now()
   );

   inventory_movements (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     inventory_item_id uuid REFERENCES inventory_items(id),
     movement_type text NOT NULL CHECK (movement_type IN ('purchase','consumption','adjustment','write_off','return')),
     movement_date date NOT NULL,
     quantity numeric(12,3) NOT NULL,
     unit_cost numeric(15,4),
     total_value numeric(15,2),
     project_cost_id uuid REFERENCES project_costs(id),  -- link to existing cost record
     reference text,
     created_at timestamptz DEFAULT now()
   );

5. Create function: update_weighted_average_cost(p_item_id uuid, p_new_qty numeric, p_new_cost numeric)
   - Recalculates unit_cost = (current total_cost + new purchase value) / (current qty + new qty)
   - Updates inventory_items.unit_cost and quantity_on_hand

6. Create function: run_nrv_test(p_item_id uuid, p_nrv numeric)
   - Updates inventory_items.net_realisable_value
   - If write_down_amount > 0:
       DR 6801 (Inventory Write-down Expense) / CR 1141 (Inventory Obsolescence Reserve)
   - Returns write_down_amount

7. Create view: inventory_movement_schedule_view
   SELECT item_id, period, 
     opening_qty, opening_value,
     purchases_qty, purchases_value,
     consumption_qty, consumption_value,
     closing_qty, closing_value
   -- grouped by inventory_item_id and calendar month

8. Create /src/services/inventoryService.js with:
   - receiveMaterial(itemData, movementData)    -- purchase receipt
   - consumeMaterial(itemId, qty, projectCostId) -- consumption on project
   - runPeriodEndNRVTest(projectId)             -- prompts user to input NRVs
   - getInventoryMovementSchedule(month, year)
   - getInventoryValuation()                    -- closing stock at lower of cost or NRV
```

---

## Notes for Copilot

- All migrations must be idempotent: use `IF NOT EXISTS` for table creation and `DO $$ BEGIN ... EXCEPTION WHEN duplicate_column THEN NULL; END $$` for ALTER TABLE ADD COLUMN.
- All new GL accounts must be inserted into `chart_of_accounts` with `INSERT ... ON CONFLICT DO NOTHING`.
- Follow the existing journal posting pattern: every GL entry goes to `journal_entries` with `(debit_account, credit_account, amount, reference, project_id, posted_at)`.
- All Postgres functions should use `LANGUAGE plpgsql` and include `SECURITY DEFINER` where they modify financial records.
- JS services should follow the existing pattern in the codebase (async/await, Supabase client, error handling with try/catch returning `{ data, error }`).
