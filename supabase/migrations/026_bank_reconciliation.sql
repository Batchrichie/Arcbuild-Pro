-- =============================================================================
-- Migration 026: Bank reconciliation module
-- Adds bank account registry, bank statement transaction storage,
-- reconciliation run history, and access policies for accounting users.
-- =============================================================================

-- Bank account registry
create table bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  account_name text not null,
  bank_name text not null,
  account_number text not null,
  currency text not null default 'GHS',
  gl_account_code text references chart_of_accounts(account_code),
  is_active boolean default true,
  opening_balance numeric(18,2) default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  constraint chk_bank_currency check (
    currency in ('GHS', 'USD', 'GBP', 'EUR')
  )
);

-- Bank statement transactions (imported)
create table bank_transactions (
  id uuid primary key default uuid_generate_v4(),
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  transaction_date date not null,
  value_date date,
  description text not null,
  reference text,
  debit_amount numeric(18,2) default 0,
  credit_amount numeric(18,2) default 0,
  balance numeric(18,2),
  match_status text not null default 'unmatched',
  matched_ledger_entry_id uuid references ledger_entries(id),
  matched_journal_entry_id uuid references journal_entries(id),
  matched_by uuid references profiles(id),
  matched_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  constraint chk_match_status check (
    match_status in ('unmatched', 'matched', 'manual_match', 'excluded')
  )
);

-- Reconciliation runs
create table bank_reconciliations (
  id uuid primary key default uuid_generate_v4(),
  bank_account_id uuid not null references bank_accounts(id),
  period_start date not null,
  period_end date not null,
  statement_closing_balance numeric(18,2) not null,
  gl_closing_balance numeric(18,2),
  unmatched_count integer default 0,
  status text not null default 'in_progress',
  completed_by uuid references profiles(id),
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  constraint chk_recon_status check (
    status in ('in_progress', 'completed', 'locked')
  )
);

-- Row level security
alter table bank_accounts enable row level security;
alter table bank_transactions enable row level security;
alter table bank_reconciliations enable row level security;

create policy "bank_accounts_access"
  on bank_accounts for all
  using (
    (select role from profiles where user_id = auth.uid())
    in ('ceo', 'accountant', 'director')
  );

create policy "bank_transactions_access"
  on bank_transactions for all
  using (
    (select role from profiles where user_id = auth.uid())
    in ('ceo', 'accountant', 'director')
  );

create policy "bank_reconciliations_access"
  on bank_reconciliations for all
  using (
    (select role from profiles where user_id = auth.uid())
    in ('ceo', 'accountant', 'director')
  );

-- Seed GHS account linked to GL account 1101.
-- Accountant users can add real accounts through the UI.
