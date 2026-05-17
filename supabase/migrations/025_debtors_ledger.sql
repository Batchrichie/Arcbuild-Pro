-- =============================================================================
-- Migration 025: Debtors Ledger and Client Balance Summary
-- Creates views to support the Debtors Ledger UI and aged receivables summary.
-- Run this file in the Supabase SQL editor or via psql.
-- =============================================================================

-- NOTE: The `invoices` table in this database uses `created_at` rather than
-- `entry_date`, so the view uses `created_at::date` as the transaction date.

create or replace view public.debtors_ledger as
select
  c.id                          as client_id,
  c.name                        as client_name,
  c.client_type,
  c.email,
  i.id                          as invoice_id,
  i.invoice_number,
  i.created_at::date            as transaction_date,
  i.due_date,
  i.division_id,
  d.name                        as division_name,
  i.status                      as invoice_status,
  i.gross_total_ghs             as invoiced_amount,
  i.wht_amount_ghs              as wht_deducted,
  i.expected_receipt_ghs        as net_receivable,
  case
    when i.status = 'paid' then coalesce(i.expected_receipt_ghs,0)
    else 0
  end                           as amount_received,
  case
    when i.status != 'paid' and i.status in ('sent', 'approved')
      then coalesce(i.expected_receipt_ghs,0)
    else 0
  end                           as amount_outstanding,
  case
    when i.status in ('sent', 'approved') and i.due_date < current_date
      then (current_date - i.due_date)::int
    else 0
  end                           as days_overdue,
  i.payment_date,
  i.fx_gain_loss_ghs,
  p.id                          as project_id,
  p.name                        as project_name
from public.invoices i
join public.clients c on c.id = i.client_id
left join public.divisions d on d.id = i.division_id
left join public.projects p on p.id = i.project_id
where i.status not in ('draft', 'rejected')
order by c.name, i.created_at;

-- Client balance summary view (aged receivables)
create or replace view public.client_balance_summary as
select
  client_id,
  client_name,
  client_type,
  email,
  count(invoice_id)                     as total_invoices,
  sum(invoiced_amount)                  as total_invoiced_ghs,
  sum(amount_received)                  as total_received_ghs,
  sum(amount_outstanding)               as total_outstanding_ghs,
  sum(wht_deducted)                     as total_wht_deducted_ghs,
  -- Ageing buckets
  sum(case when days_overdue = 0 then amount_outstanding else 0 end)
                                        as current_ghs,
  sum(case when days_overdue between 1 and 30 then amount_outstanding else 0 end)
                                        as overdue_1_30_ghs,
  sum(case when days_overdue between 31 and 60 then amount_outstanding else 0 end)
                                        as overdue_31_60_ghs,
  sum(case when days_overdue between 61 and 90 then amount_outstanding else 0 end)
                                        as overdue_61_90_ghs,
  sum(case when days_overdue > 90 then amount_outstanding else 0 end)
                                        as overdue_90_plus_ghs,
  max(case when invoice_status in ('sent','approved')
    then due_date else null end)        as oldest_due_date
from public.debtors_ledger
group by client_id, client_name, client_type, email
order by total_outstanding_ghs desc;

grant select on public.debtors_ledger to authenticated;
grant select on public.client_balance_summary to authenticated;
