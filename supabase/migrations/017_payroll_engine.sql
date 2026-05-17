-- =============================================================================
-- ARCBUILD PRO — Migration 017: Payroll Engine
-- Module 3.4: PAYE tax bands, payroll line processing, journal posting
--
-- Creates three functions:
--   1. compute_paye() — GRA PAYE tax calculation with current tax bands
--   2. process_employee_payroll() — Processes single employee payroll line
--   3. post_payroll_journal() — Posts payroll to general ledger
--
-- Safe to re-run: uses CREATE OR REPLACE FUNCTION
-- =============================================================================


-- =============================================================================
-- FUNCTION 1: compute_paye
-- Computes PAYE using GRA Personal Income Tax Bands (annual)
--
-- Args:
--   annual_taxable_income: Annual taxable income in GHS
--
-- Returns: Annual PAYE tax amount
--
-- GRA Tax Bands (2024/2025):
--   Band 1: First GHS 4,380 @ 0%
--   Band 2: Next GHS 1,320 @ 5%
--   Band 3: Next GHS 1,560 @ 10%
--   Band 4: Next GHS 38,000 @ 17.5%
--   Band 5: Next GHS 192,000 @ 25%
--   Band 6: Above GHS 240,000 @ 30%
-- =============================================================================

create or replace function compute_paye(annual_taxable_income numeric)
returns numeric as $$
declare
  tax numeric := 0;
  remaining numeric;
begin
  remaining := annual_taxable_income;

  -- Band 1: 0%
  if remaining <= 4380 then
    return 0;
  end if;
  remaining := remaining - 4380;

  -- Band 2: 5%
  if remaining <= 1320 then
    return round(remaining * 0.05, 2);
  end if;
  tax := tax + (1320 * 0.05);
  remaining := remaining - 1320;

  -- Band 3: 10%
  if remaining <= 1560 then
    return round(tax + (remaining * 0.10), 2);
  end if;
  tax := tax + (1560 * 0.10);
  remaining := remaining - 1560;

  -- Band 4: 17.5%
  if remaining <= 38000 then
    return round(tax + (remaining * 0.175), 2);
  end if;
  tax := tax + (38000 * 0.175);
  remaining := remaining - 38000;

  -- Band 5: 25%
  if remaining <= 192000 then
    return round(tax + (remaining * 0.25), 2);
  end if;
  tax := tax + (192000 * 0.25);
  remaining := remaining - 192000;

  -- Band 6: 30%
  tax := tax + (remaining * 0.30);

  return round(tax, 2);
end;
$$ language plpgsql immutable;

grant execute on function compute_paye(numeric) to authenticated;


-- =============================================================================
-- FUNCTION 2: process_employee_payroll
-- Processes single employee payroll line for a given payroll run
--
-- Args:
--   payroll_run_id_param: UUID of payroll run
--   employee_id_param: UUID of employee
--   overtime_hours_param: Hours worked at overtime rate (optional)
--   overtime_rate_param: Hourly overtime rate (optional)
--   bonus_amount_param: One-time bonus (optional)
--   other_deductions_param: Non-loan deductions (optional)
--   deduction_notes_param: Notes on deductions (optional)
--
-- Returns: JSONB with success status and computed payroll amounts
--
-- Notes:
--   - Basic and allowances are pro-rated to period length
--   - SSNIT: 5.5% employee, 13% employer (on basic only, unless exempt)
--   - PAYE: Computed on taxable income, annualized for band lookup, then de-annualized
--   - Loan deductions: Sum of all active staff loans with outstanding balance
-- =============================================================================

create or replace function process_employee_payroll(
  payroll_run_id_param uuid,
  employee_id_param uuid,
  overtime_hours_param numeric default 0,
  overtime_rate_param numeric default 0,
  bonus_amount_param numeric default 0,
  other_deductions_param numeric default 0,
  deduction_notes_param text default null
)
returns jsonb as $$
declare
  emp employees%rowtype;
  run payroll_runs%rowtype;
  basic numeric;
  allowances numeric;
  overtime_amt numeric;
  gross_pay numeric;
  ssnit_employee numeric;
  ssnit_employer numeric;
  taxable_income_annual numeric;
  paye_annual numeric;
  paye_monthly numeric;
  loan_deduction numeric := 0;
  net_pay numeric;
  period_days integer;
  period_months numeric;
  line_id uuid;
begin
  select * into emp from employees where id = employee_id_param;
  select * into run from payroll_runs where id = payroll_run_id_param;

  if emp.id is null then
    return jsonb_build_object('success', false, 'error', 'Employee not found');
  end if;

  if run.id is null then
    return jsonb_build_object('success', false, 'error', 'Payroll run not found');
  end if;

  -- Compute period factor for custom pay periods
  period_days := run.period_end - run.period_start + 1;
  period_months := period_days::numeric / 30.44;

  -- Basic and allowances pro-rated to period
  basic := emp.basic_salary * period_months;
  allowances := emp.monthly_allowances * period_months;
  overtime_amt := overtime_hours_param * overtime_rate_param;

  gross_pay := basic + allowances + overtime_amt + bonus_amount_param;

  -- SSNIT: 5.5% employee, 13% employer (on basic only, not allowances)
  if not emp.is_ssnit_exempt then
    ssnit_employee := round(basic * 0.055, 2);
    ssnit_employer := round(basic * 0.13, 2);
  else
    ssnit_employee := 0;
    ssnit_employer := 0;
  end if;

  -- PAYE on taxable income (gross minus SSNIT employee contribution)
  -- Annualise for band computation, then de-annualise
  if not emp.is_paye_exempt then
    taxable_income_annual := (gross_pay - ssnit_employee) / period_months * 12;
    paye_annual := compute_paye(taxable_income_annual);
    paye_monthly := round(paye_annual / 12 * period_months, 2);
  else
    paye_monthly := 0;
  end if;

  -- Staff loan deductions
  select coalesce(sum(monthly_deduction), 0) into loan_deduction
  from staff_loans
  where employee_id = employee_id_param
    and status = 'active'
    and outstanding_balance > 0;

  -- Net pay
  net_pay := gross_pay - ssnit_employee - paye_monthly
    - loan_deduction - other_deductions_param;

  -- Insert payroll line
  insert into payroll_lines (
    payroll_run_id, employee_id,
    basic_salary, allowances, gross_pay,
    overtime_hours, overtime_rate, overtime_amount,
    bonus_amount, taxable_income,
    paye, ssnit_employee, ssnit_employer,
    loan_deduction, other_deductions, deduction_notes,
    net_pay, project_id
  ) values (
    payroll_run_id_param, employee_id_param,
    basic, allowances, gross_pay,
    overtime_hours_param, overtime_rate_param, overtime_amt,
    bonus_amount_param, gross_pay - ssnit_employee,
    paye_monthly, ssnit_employee, ssnit_employer,
    loan_deduction, other_deductions_param, deduction_notes_param,
    net_pay, emp.division_id
  ) returning id into line_id;

  return jsonb_build_object(
    'success', true,
    'payroll_line_id', line_id,
    'gross_pay', gross_pay,
    'paye', paye_monthly,
    'ssnit_employee', ssnit_employee,
    'ssnit_employer', ssnit_employer,
    'loan_deduction', loan_deduction,
    'net_pay', net_pay
  );

exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer;

grant execute on function process_employee_payroll(uuid, uuid, numeric, numeric, numeric, numeric, text) to authenticated;


-- =============================================================================
-- FUNCTION 3: post_payroll_journal
-- Posts payroll totals to general ledger as journal entries
--
-- Args:
--   payroll_run_id_param: UUID of payroll run to post
--   actor_uuid: UUID of user posting (for audit trail)
--
-- Returns: JSONB with success status and journal entry ID
--
-- Journal Structure:
--   DEBIT: Salaries and Wages (6101) — gross pay
--   DEBIT: SSNIT Employer Contribution (6102)
--   CREDIT: PAYE Payable (2105) — for GRA remittance
--   CREDIT: SSNIT Payable (2106) — employee + employer
--   CREDIT: Cash — GHS (1101) — net pay
--   CREDIT: Staff Advances (1130) — loan repayments (if any)
-- =============================================================================

create or replace function post_payroll_journal(
  payroll_run_id_param uuid,
  actor_uuid uuid
)
returns jsonb as $$
declare
  run payroll_runs%rowtype;
  actor profiles%rowtype;
  journal_id uuid;
  totals record;
  total_dr numeric;
  total_cr numeric;
begin
  select * into run from payroll_runs where id = payroll_run_id_param;
  select * into actor from profiles where user_id = actor_uuid;

  if run.id is null then
    return jsonb_build_object('success', false, 'error', 'Payroll run not found');
  end if;

  if exists (
    select 1 from journal_entries
    where source_type = 'payroll' and source_id = payroll_run_id_param
  ) then
    return jsonb_build_object('success', false,
      'error', 'Payroll journal already posted');
  end if;

  -- Aggregate payroll totals
  select
    sum(gross_pay)       as total_gross,
    sum(basic_salary)    as total_basic,
    sum(paye)            as total_paye,
    sum(ssnit_employee)  as total_ssnit_emp,
    sum(ssnit_employer)  as total_ssnit_er,
    sum(loan_deduction)  as total_loans,
    sum(net_pay)         as total_net
  into totals
  from payroll_lines
  where payroll_run_id = payroll_run_id_param;

  -- Create journal header
  insert into journal_entries (
    entry_date, description, reference,
    source_type, source_id,
    posted_by, created_by
  ) values (
    run.period_end,
    'Payroll — ' || to_char(run.period_start, 'DD Mon YYYY')
      || ' to ' || to_char(run.period_end, 'DD Mon YYYY'),
    'PR-' || to_char(run.period_end, 'YYYYMM'),
    'payroll', payroll_run_id_param,
    actor.id, actor.id
  ) returning id into journal_id;

  -- DEBIT: Salaries and Wages (6101) — gross pay
  insert into ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount, description
  ) values (
    journal_id, '6101', 'Salaries and Wages',
    totals.total_gross, 0,
    'Gross payroll for period'
  );

  -- DEBIT: SSNIT Employer Contribution (6102)
  insert into ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount, description
  ) values (
    journal_id, '6102', 'SSNIT — Employer Contribution',
    totals.total_ssnit_er, 0,
    'Employer SSNIT 13%'
  );

  -- CREDIT: PAYE Payable (2105)
  insert into ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount, description
  ) values (
    journal_id, '2105', 'PAYE Payable',
    0, totals.total_paye,
    'PAYE withheld for GRA remittance'
  );

  -- CREDIT: SSNIT Payable (2106) — employee + employer combined
  insert into ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount, description
  ) values (
    journal_id, '2106', 'SSNIT Payable',
    0, totals.total_ssnit_emp + totals.total_ssnit_er,
    'SSNIT payable to SSNIT (employee 5.5% + employer 13%)'
  );

  -- CREDIT: Net Pay (Cash/Bank — 1101 GHS)
  insert into ledger_entries (
    journal_entry_id, account_code, account_name,
    debit_amount, credit_amount, description
  ) values (
    journal_id, '1101', 'Cash — GHS',
    0, totals.total_net,
    'Net salaries paid'
  );

  -- CREDIT: Staff Loans Payable reduction (1130) — loan deductions
  if totals.total_loans > 0 then
    insert into ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description
    ) values (
      journal_id, '1130', 'Staff Advances',
      0, totals.total_loans,
      'Loan repayments deducted from payroll'
    );
  end if;

  -- Validate balance
  select sum(debit_amount), sum(credit_amount)
  into total_dr, total_cr
  from ledger_entries where journal_entry_id = journal_id;

  if abs(total_dr - total_cr) >= 0.01 then
    raise exception 'Payroll journal does not balance. DR: %, CR: %',
      total_dr, total_cr;
  end if;

  -- Update payroll run totals and journal link
  update payroll_runs set
    total_gross_pay     = totals.total_gross,
    total_paye          = totals.total_paye,
    total_ssnit_employee = totals.total_ssnit_emp,
    total_ssnit_employer = totals.total_ssnit_er,
    total_net_pay       = totals.total_net,
    journal_entry_id    = journal_id,
    status              = 'posted'
  where id = payroll_run_id_param;

  -- Audit
  insert into audit_log (
    table_name, record_id, action, actor_id, details
  ) values (
    'payroll_runs', payroll_run_id_param, 'PAYROLL_POSTED', actor.id,
    jsonb_build_object(
      'journal_entry_id', journal_id,
      'total_gross', totals.total_gross,
      'total_paye', totals.total_paye,
      'total_net', totals.total_net
    )
  );

  return jsonb_build_object(
    'success', true,
    'journal_entry_id', journal_id,
    'total_gross', totals.total_gross,
    'total_net', totals.total_net
  );

exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer;

grant execute on function post_payroll_journal(uuid, uuid) to authenticated;


-- =============================================================================
-- VERIFICATION: After applying this migration, run:
--
-- select proname
-- from pg_proc
-- where proname in (
--   'compute_paye',
--   'process_employee_payroll',
--   'post_payroll_journal'
-- )
-- order by proname;
--
-- Expected: THREE rows (all functions present)
--
-- And test PAYE with known value:
-- select compute_paye(36000) as annual_paye;
-- Expected: ~5251.50
-- =============================================================================
