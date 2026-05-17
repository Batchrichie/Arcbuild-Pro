-- Tax Management Centre infrastructure for ARCBUILD PRO
-- Migration 023: tax calendar, filings, alerts, and tax functions

-- Tax calendar: tracks all GRA filing obligations and deadlines
create table tax_calendar (
  id uuid primary key default uuid_generate_v4(),
  tax_type text not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  status text not null default 'upcoming',
  filed_date date,
  filed_by uuid references profiles(id),
  gra_reference text,
  amount_due numeric(18,2),
  amount_paid numeric(18,2),
  notes text,
  created_at timestamptz default now(),
  constraint chk_tax_type check (
    tax_type in ('VAT', 'NHIL', 'GetFUND', 'PAYE', 'SSNIT', 'WHT', 'CIT')
  ),
  constraint chk_tax_status check (
    status in ('upcoming', 'due', 'overdue', 'filed', 'paid')
  ),
  unique(tax_type, period_start)
);

-- Tax filings: permanent record of every return submitted
create table tax_filings (
  id uuid primary key default uuid_generate_v4(),
  tax_calendar_id uuid references tax_calendar(id),
  tax_type text not null,
  period_start date not null,
  period_end date not null,
  gross_amount numeric(18,2),
  input_tax numeric(18,2) default 0,
  output_tax numeric(18,2),
  net_tax_due numeric(18,2),
  amount_paid numeric(18,2),
  gra_reference text,
  filed_by uuid references profiles(id),
  filed_at timestamptz default now(),
  notes text
);

-- Alert log: tracks all system alerts sent
create table alert_log (
  id uuid primary key default uuid_generate_v4(),
  alert_type text not null,
  recipient_role text,
  recipient_email text,
  subject text,
  message text,
  related_table text,
  related_id uuid,
  sent_at timestamptz default now(),
  delivery_status text default 'pending'
);

-- Enable row level security for new tables
alter table tax_calendar enable row level security;
alter table tax_filings enable row level security;
alter table alert_log enable row level security;

create policy "tax_calendar_access"
  on tax_calendar for all
  using (
    (select role from profiles where user_id = auth.uid())
    in ('ceo', 'accountant', 'director')
  );

create policy "tax_filings_access"
  on tax_filings for all
  using (
    (select role from profiles where user_id = auth.uid())
    in ('ceo', 'accountant', 'director')
  );

create policy "alert_log_read"
  on alert_log for select
  using (
    (select role from profiles where user_id = auth.uid())
    in ('ceo', 'accountant', 'director')
  );

-- Function to populate the next 12 months of tax obligations
create or replace function populate_tax_calendar(months_ahead integer default 12)
returns integer as $$
declare
  current_month date;
  inserted_count integer := 0;
  tax_types text[] := array['VAT', 'NHIL', 'GetFUND', 'PAYE', 'SSNIT'];
  t text;
begin
  current_month := date_trunc('month', current_date);

  for i in 0..months_ahead loop
    foreach t in array tax_types loop
      insert into tax_calendar (
        tax_type, period_start, period_end, due_date, status
      ) values (
        t,
        current_month + (i || ' months')::interval,
        (current_month + ((i+1) || ' months')::interval - interval '1 day')::date,
        (current_month + ((i+1) || ' months')::interval + interval '29 days')::date,
        case
          when current_month + (i || ' months')::interval < date_trunc('month', current_date)
            then 'overdue'
          when current_month + (i || ' months')::interval = date_trunc('month', current_date)
            then 'due'
          else 'upcoming'
        end
      )
      on conflict (tax_type, period_start) do nothing;

      if found then inserted_count := inserted_count + 1; end if;
    end loop;
  end loop;

  return inserted_count;
end;
$$ language plpgsql security definer;

-- Compute VAT return figures from the general ledger
create or replace function compute_vat_return(
  period_start_param date,
  period_end_param date
)
returns jsonb as $$
declare
  output_vat numeric;
  input_vat numeric;
  net_vat numeric;
  nhil_amount numeric;
  getfund_amount numeric;
begin
  select coalesce(sum(credit_amount) - sum(debit_amount), 0)
  into output_vat
  from ledger_entries le
  join journal_entries je on je.id = le.journal_entry_id
  where le.account_code = '2102'
    and je.entry_date between period_start_param and period_end_param;

  select coalesce(sum(debit_amount) - sum(credit_amount), 0)
  into input_vat
  from ledger_entries le
  join journal_entries je on je.id = le.journal_entry_id
  where le.account_code = '1112'
    and je.entry_date between period_start_param and period_end_param;

  select coalesce(sum(credit_amount) - sum(debit_amount), 0)
  into nhil_amount
  from ledger_entries le
  join journal_entries je on je.id = le.journal_entry_id
  where le.account_code = '2103'
    and je.entry_date between period_start_param and period_end_param;

  select coalesce(sum(credit_amount) - sum(debit_amount), 0)
  into getfund_amount
  from ledger_entries le
  join journal_entries je on je.id = le.journal_entry_id
  where le.account_code = '2104'
    and je.entry_date between period_start_param and period_end_param;

  net_vat := output_vat - input_vat;

  return jsonb_build_object(
    'period_start', period_start_param,
    'period_end', period_end_param,
    'output_vat', output_vat,
    'input_vat', input_vat,
    'net_vat_due', net_vat,
    'nhil_due', nhil_amount,
    'getfund_due', getfund_amount,
    'total_due', net_vat + nhil_amount + getfund_amount
  );
end;
$$ language plpgsql stable security definer;

-- Mark a tax obligation as filed and create a filing record
create or replace function mark_tax_filed(
  tax_calendar_id_param uuid,
  gra_reference_param text,
  amount_paid_param numeric,
  actor_uuid uuid,
  notes_param text default null
)
returns jsonb as $$
declare
  cal tax_calendar%rowtype;
  actor profiles%rowtype;
  filing_id uuid;
  computed jsonb;
begin
  select * into cal from tax_calendar where id = tax_calendar_id_param;
  select * into actor from profiles where user_id = actor_uuid;

  if cal.id is null then
    return jsonb_build_object('success', false, 'error', 'Tax calendar entry not found');
  end if;

  if cal.status = 'filed' or cal.status = 'paid' then
    return jsonb_build_object('success', false, 'error', 'Already filed');
  end if;

  if cal.tax_type in ('VAT', 'NHIL', 'GetFUND') then
    computed := compute_vat_return(cal.period_start, cal.period_end);
  end if;

  insert into tax_filings (
    tax_calendar_id, tax_type,
    period_start, period_end,
    output_tax, input_tax, net_tax_due,
    amount_paid, gra_reference,
    filed_by, notes
  ) values (
    tax_calendar_id_param, cal.tax_type,
    cal.period_start, cal.period_end,
    (computed->>'output_vat')::numeric,
    (computed->>'input_vat')::numeric,
    (computed->>'net_vat_due')::numeric,
    amount_paid_param,
    gra_reference_param,
    actor.id,
    notes_param
  ) returning id into filing_id;

  update tax_calendar set
    status = 'filed',
    filed_date = current_date,
    filed_by = actor.id,
    gra_reference = gra_reference_param,
    amount_paid = amount_paid_param
  where id = tax_calendar_id_param;

  insert into audit_log (
    table_name, record_id, action, actor_id, details
  ) values (
    'tax_filings', filing_id, 'TAX_FILED', actor.id,
    jsonb_build_object(
      'tax_type', cal.tax_type,
      'period', cal.period_start,
      'gra_reference', gra_reference_param,
      'amount_paid', amount_paid_param
    )
  );

  return jsonb_build_object(
    'success', true,
    'filing_id', filing_id,
    'tax_type', cal.tax_type,
    'amount_paid', amount_paid_param
  );

exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer;

-- Populate tax calendar immediately after migration
select populate_tax_calendar(12);
