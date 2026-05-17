-- =============================================================================
-- ARCBUILD PRO — Migration 018: Subcontractor Management
-- Module 3.5: Payment certificates, WHT deduction, payment history views
--
-- Creates:
--   1. issue_payment_certificate() — Issues cert, posts cost + WHT ledger lines
--   2. subcontractor_payment_history — Payment certificate history per sub
--   3. wht_certificate_summary — Annual WHT summary for GRA reporting
--
-- Safe to re-run: uses CREATE OR REPLACE
-- =============================================================================


-- =============================================================================
-- FUNCTION: issue_payment_certificate
-- =============================================================================

create or replace function issue_payment_certificate(
  subcontractor_id_param uuid,
  project_id_param uuid,
  description_param text,
  gross_amount_param numeric,
  currency_param text,
  payment_date_param date,
  actor_uuid uuid
)
returns jsonb as $$
declare
  sub subcontractors%rowtype;
  proj projects%rowtype;
  actor profiles%rowtype;
  fx_rate_val numeric := 1.0;
  gross_ghs numeric;
  wht_amount numeric := 0;
  net_payable numeric;
  cost_result jsonb;
  cert_number text;
begin
  select * into sub from subcontractors where id = subcontractor_id_param;
  select * into proj from projects where id = project_id_param;
  select * into actor from profiles where user_id = actor_uuid;

  if sub.id is null then
    return jsonb_build_object('success', false, 'error', 'Subcontractor not found');
  end if;

  if proj.id is null then
    return jsonb_build_object('success', false, 'error', 'Project not found');
  end if;

  -- Get FX rate
  if currency_param != 'GHS' then
    fx_rate_val := get_fx_rate(currency_param, payment_date_param);
  end if;
  gross_ghs := gross_amount_param * fx_rate_val;

  -- Compute WHT if applicable
  if sub.applies_wht then
    wht_amount := round(gross_ghs * sub.wht_rate, 2);
  end if;

  net_payable := gross_ghs - wht_amount;

  -- Generate certificate number
  cert_number := 'PC-' || to_char(payment_date_param, 'YYYYMMDD')
    || '-' || substr(sub.id::text, 1, 4);

  -- Post as project cost (Subcontractors type)
  cost_result := post_project_cost(
    project_id_param,
    'Subcontractors',
    'Payment Certificate ' || cert_number || ': ' || description_param,
    gross_amount_param,
    currency_param,
    payment_date_param,
    actor_uuid,
    subcontractor_id_param,
    null
  );

  if not (cost_result->>'success')::boolean then
    return cost_result;
  end if;

  -- If WHT applies, post additional WHT journal entry
  if wht_amount > 0 then
    insert into ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description,
      project_id, division_id
    )
    values (
      (cost_result->>'journal_entry_id')::uuid,
      '2107', 'Withholding Tax Payable',
      wht_amount, 0,
      'WHT on ' || cert_number || ' @ ' || (sub.wht_rate * 100)::text || '%',
      project_id_param, proj.division_id
    );

    insert into ledger_entries (
      journal_entry_id, account_code, account_name,
      debit_amount, credit_amount, description,
      project_id, division_id
    )
    values (
      (cost_result->>'journal_entry_id')::uuid,
      '2101', 'Accounts Payable',
      0, wht_amount,
      'WHT reduction on ' || cert_number,
      project_id_param, proj.division_id
    );
  end if;

  update subcontractors set
    total_paid_ghs = total_paid_ghs + net_payable,
    total_wht_deducted_ghs = total_wht_deducted_ghs + wht_amount
  where id = subcontractor_id_param;

  return jsonb_build_object(
    'success', true,
    'certificate_number', cert_number,
    'gross_amount_ghs', gross_ghs,
    'wht_deducted', wht_amount,
    'net_payable', net_payable,
    'cost_id', cost_result->'cost_id',
    'journal_entry_id', cost_result->'journal_entry_id'
  );

exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer;

grant execute on function issue_payment_certificate(uuid, uuid, text, numeric, text, date, uuid) to authenticated;


-- =============================================================================
-- VIEW: subcontractor_payment_history
-- =============================================================================

create or replace view subcontractor_payment_history as
select
  s.id                      as subcontractor_id,
  s.name                    as subcontractor_name,
  s.tin,
  s.trade_type,
  s.applies_wht,
  s.wht_rate,
  s.total_paid_ghs,
  s.total_wht_deducted_ghs,
  pc.id                     as cost_id,
  pc.project_id,
  p.name                    as project_name,
  pc.description,
  pc.amount                 as gross_amount,
  pc.currency,
  pc.amount_ghs             as gross_amount_ghs,
  pc.fx_rate,
  pc.date_incurred          as payment_date,
  pc.journal_entry_id,
  je.entry_number
from subcontractors s
left join project_costs pc on pc.subcontractor_id = s.id
left join projects p on p.id = pc.project_id
left join journal_entries je on je.id = pc.journal_entry_id
order by s.name, pc.date_incurred desc;

grant select on subcontractor_payment_history to authenticated;


-- =============================================================================
-- VIEW: wht_certificate_summary
-- =============================================================================

create or replace view wht_certificate_summary as
select
  s.id                        as subcontractor_id,
  s.name                      as subcontractor_name,
  s.tin                       as subcontractor_tin,
  extract(year from pc.date_incurred) as tax_year,
  sum(pc.amount_ghs)          as total_gross_paid_ghs,
  sum(pc.amount_ghs * s.wht_rate) as total_wht_deducted_ghs,
  s.wht_rate,
  count(*)                    as payment_count
from subcontractors s
join project_costs pc on pc.subcontractor_id = s.id
where s.applies_wht = true
group by
  s.id, s.name, s.tin, s.wht_rate,
  extract(year from pc.date_incurred)
order by s.name;

grant select on wht_certificate_summary to authenticated;


-- =============================================================================
-- VERIFICATION (Step 4): After applying in Supabase SQL editor, run:
--
-- select proname from pg_proc
-- where proname = 'issue_payment_certificate';
--
-- select table_name, table_type
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in (
--     'subcontractor_payment_history',
--     'wht_certificate_summary'
--   )
-- order by table_name;
--
-- Expected: 1 function row + 2 VIEW rows
-- =============================================================================
