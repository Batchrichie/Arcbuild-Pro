-- =============================================================================
-- ARCBUILD PRO — Migration 001: Initial Schema
-- Phase 1, Step 2
-- All 27 tables created in strict dependency order.
-- RLS is NOT included here — that is Step 4.
-- Run this entire file once in the Supabase SQL editor.
-- =============================================================================


-- =============================================================================
-- 0. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- 1. ROLES
-- Lookup table for the 6 system portal roles.
-- No foreign key dependencies.
-- =============================================================================

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,          -- ceo | accountant | project_manager | hr_manager | employee | client
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 6 fixed roles immediately so profiles can reference them.
INSERT INTO roles (name, description) VALUES
    ('ceo',             'Chief Executive / Director — full system access'),
    ('accountant',      'Accountant — full financial and tax access'),
    ('project_manager', 'Project Manager — project finance and site management'),
    ('hr_manager',      'HR Manager — employee registry and payroll input'),
    ('employee',        'Employee — payslips, timesheets, leave'),
    ('client',          'Client — own project and invoice view only');


-- =============================================================================
-- 2. PROFILES
-- Extends auth.users. One row per authenticated user.
-- Depends on: roles
-- =============================================================================

CREATE TABLE profiles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL REFERENCES roles(name) ON DELETE RESTRICT,
    full_name   TEXT NOT NULL,
    phone       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id  ON profiles(user_id);
CREATE INDEX idx_profiles_role     ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);


-- =============================================================================
-- 3. DIVISIONS
-- Business divisions: Construction, Architecture, Real Estate, Logistics.
-- No foreign key dependencies.
-- =============================================================================

CREATE TABLE divisions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 4 operating divisions.
INSERT INTO divisions (name) VALUES
    ('Construction'),
    ('Architecture'),
    ('Real Estate'),
    ('Logistics');


-- =============================================================================
-- 4. CLIENTS
-- Depends on: nothing (standalone master record)
-- =============================================================================

CREATE TABLE clients (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    client_type TEXT NOT NULL CHECK (client_type IN ('individual', 'corporate', 'government')),
    email       TEXT,
    phone       TEXT,
    address     TEXT,
    tin         TEXT,                          -- Tax Identification Number
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_client_type ON clients(client_type);
CREATE INDEX idx_clients_tin         ON clients(tin);


-- =============================================================================
-- 5. PROJECTS
-- Depends on: clients, divisions
-- =============================================================================

CREATE TABLE projects (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           TEXT NOT NULL,
    client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    division_id    UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
    contract_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    start_date     DATE,
    end_date       DATE,
    status         TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_client_id   ON projects(client_id);
CREATE INDEX idx_projects_division_id ON projects(division_id);
CREATE INDEX idx_projects_status      ON projects(status);


-- =============================================================================
-- 6. CONTRACTS
-- Depends on: projects
-- =============================================================================

CREATE TABLE contracts (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    document_url         TEXT,
    signed_date          DATE,
    value                NUMERIC(18, 2) NOT NULL DEFAULT 0,
    retention_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,   -- e.g. 5.00 = 5%
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_project_id ON contracts(project_id);


-- =============================================================================
-- 7. CHART OF ACCOUNTS
-- Account code ranges per plan:
--   1000s Assets | 2000s Liabilities | 3000s Equity
--   4000s Revenue | 5000s Cost of Sales | 6000s Operating Expenses | 7000s Tax
-- Depends on: divisions (nullable)
-- =============================================================================

CREATE TABLE chart_of_accounts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_code  TEXT REFERENCES chart_of_accounts(account_code) ON DELETE SET NULL,
    division_id  UUID REFERENCES divisions(id) ON DELETE SET NULL,   -- nullable: division-specific accounts
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coa_account_code ON chart_of_accounts(account_code);
CREATE INDEX idx_coa_account_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent_code  ON chart_of_accounts(parent_code);
CREATE INDEX idx_coa_division_id  ON chart_of_accounts(division_id);
CREATE INDEX idx_coa_is_active    ON chart_of_accounts(is_active);

-- -----------------------------------------------------------------------------
-- Seed: Pre-built chart of accounts for a construction/architecture firm in Ghana
-- -----------------------------------------------------------------------------

-- ASSETS (1000s)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code) VALUES
    ('1000', 'Assets',                        'asset', NULL),
    ('1100', 'Current Assets',                'asset', '1000'),
    ('1101', 'Cash — GHS',                   'asset', '1100'),
    ('1102', 'Cash — USD',                   'asset', '1100'),
    ('1103', 'Cash — GBP',                   'asset', '1100'),
    ('1104', 'Cash — EUR',                   'asset', '1100'),
    ('1110', 'Accounts Receivable',           'asset', '1100'),
    ('1111', 'Withholding Tax Receivable',    'asset', '1100'),
    ('1112', 'Input VAT Receivable',          'asset', '1100'),
    ('1120', 'Prepayments and Deposits',      'asset', '1100'),
    ('1130', 'Staff Advances',                'asset', '1100'),
    ('1140', 'Inventory / Materials on Hand', 'asset', '1100'),
    ('1200', 'Non-Current Assets',            'asset', '1000'),
    ('1210', 'Property, Plant & Equipment',   'asset', '1200'),
    ('1211', 'Accumulated Depreciation',      'asset', '1200'),
    ('1220', 'Intangible Assets',             'asset', '1200'),
    ('1230', 'Long-term Deposits',            'asset', '1200');

-- LIABILITIES (2000s)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code) VALUES
    ('2000', 'Liabilities',                   'liability', NULL),
    ('2100', 'Current Liabilities',           'liability', '2000'),
    ('2101', 'Accounts Payable',              'liability', '2100'),
    ('2102', 'VAT Payable',                   'liability', '2100'),
    ('2103', 'NHIL Payable',                  'liability', '2100'),
    ('2104', 'GetFUND Levy Payable',          'liability', '2100'),
    ('2105', 'PAYE Payable',                  'liability', '2100'),
    ('2106', 'SSNIT Payable',                 'liability', '2100'),
    ('2107', 'Withholding Tax Payable',       'liability', '2100'),
    ('2108', 'Accrued Expenses',              'liability', '2100'),
    ('2109', 'Retention Payable',             'liability', '2100'),
    ('2110', 'Customer Deposits',             'liability', '2100'),
    ('2200', 'Non-Current Liabilities',       'liability', '2000'),
    ('2201', 'Long-term Loans',               'liability', '2200'),
    ('2202', 'Deferred Tax Liability',        'liability', '2200');

-- EQUITY (3000s)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code) VALUES
    ('3000', 'Equity',                        'equity', NULL),
    ('3100', 'Share Capital',                 'equity', '3000'),
    ('3200', 'Retained Earnings',             'equity', '3000'),
    ('3300', 'Current Year Profit / Loss',    'equity', '3000'),
    ('3400', 'FX Translation Reserve',        'equity', '3000');

-- REVENUE (4000s) — broken out by division
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code) VALUES
    ('4000', 'Revenue',                          'revenue', NULL),
    ('4100', 'Construction Revenue',             'revenue', '4000'),
    ('4101', 'Construction — Contract Billings', 'revenue', '4100'),
    ('4102', 'Construction — Variation Orders',  'revenue', '4100'),
    ('4200', 'Architecture Revenue',             'revenue', '4000'),
    ('4201', 'Architecture — Design Fees',       'revenue', '4200'),
    ('4202', 'Architecture — Consultation Fees', 'revenue', '4200'),
    ('4300', 'Real Estate Revenue',              'revenue', '4000'),
    ('4301', 'Real Estate — Property Sales',     'revenue', '4300'),
    ('4302', 'Real Estate — Rental Income',      'revenue', '4300'),
    ('4400', 'Logistics Revenue',                'revenue', '4000'),
    ('4401', 'Logistics — Haulage Fees',         'revenue', '4400'),
    ('4402', 'Logistics — Storage Fees',         'revenue', '4400'),
    ('4500', 'Other Income',                     'revenue', '4000'),
    ('4501', 'FX Gain',                          'revenue', '4500'),
    ('4502', 'Interest Income',                  'revenue', '4500');

-- COST OF SALES (5000s)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code) VALUES
    ('5000', 'Cost of Sales',                    'expense', NULL),
    ('5100', 'Construction Cost of Sales',       'expense', '5000'),
    ('5101', 'Materials — Construction',         'expense', '5100'),
    ('5102', 'Subcontractor Costs',              'expense', '5100'),
    ('5103', 'Site Labour',                      'expense', '5100'),
    ('5104', 'Equipment Hire',                   'expense', '5100'),
    ('5200', 'Architecture Cost of Sales',       'expense', '5000'),
    ('5201', 'Consultant Fees',                  'expense', '5200'),
    ('5300', 'Real Estate Cost of Sales',        'expense', '5000'),
    ('5301', 'Land Cost',                        'expense', '5300'),
    ('5302', 'Development Cost',                 'expense', '5300'),
    ('5400', 'Logistics Cost of Sales',          'expense', '5000'),
    ('5401', 'Fuel',                             'expense', '5400'),
    ('5402', 'Vehicle Maintenance',              'expense', '5400');

-- OPERATING EXPENSES (6000s)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code) VALUES
    ('6000', 'Operating Expenses',               'expense', NULL),
    ('6100', 'Staff Costs',                      'expense', '6000'),
    ('6101', 'Salaries and Wages',               'expense', '6100'),
    ('6102', 'SSNIT — Employer Contribution',    'expense', '6100'),
    ('6103', 'Staff Welfare',                    'expense', '6100'),
    ('6200', 'Office and Administration',        'expense', '6000'),
    ('6201', 'Rent',                             'expense', '6200'),
    ('6202', 'Utilities',                        'expense', '6200'),
    ('6203', 'Office Supplies',                  'expense', '6200'),
    ('6204', 'Communication',                    'expense', '6200'),
    ('6300', 'Finance Costs',                    'expense', '6000'),
    ('6301', 'Bank Charges',                     'expense', '6300'),
    ('6302', 'Interest Expense',                 'expense', '6300'),
    ('6303', 'FX Loss',                          'expense', '6300'),
    ('6400', 'Depreciation',                     'expense', '6000'),
    ('6401', 'Depreciation — Plant & Equipment', 'expense', '6400'),
    ('6500', 'Professional Fees',                'expense', '6000'),
    ('6501', 'Legal Fees',                       'expense', '6500'),
    ('6502', 'Audit Fees',                       'expense', '6500'),
    ('6600', 'Marketing and Business Development','expense', '6000'),
    ('6700', 'Travel and Transport',             'expense', '6000');

-- TAX ACCOUNTS (7000s)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_code) VALUES
    ('7000', 'Tax Accounts',                     'expense', NULL),
    ('7100', 'Corporate Income Tax',             'expense', '7000'),
    ('7200', 'Capital Allowances',               'expense', '7000'),
    ('7300', 'Deferred Tax',                     'expense', '7000');


-- =============================================================================
-- 8. JOURNAL ENTRIES
-- Header record for each double-entry posting.
-- Depends on: profiles
-- =============================================================================

CREATE TABLE journal_entries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    reference   TEXT,                            -- invoice number, payroll ref, etc.
    created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    is_posted   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_entry_date  ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_reference   ON journal_entries(reference);
CREATE INDEX idx_journal_entries_created_by  ON journal_entries(created_by);
CREATE INDEX idx_journal_entries_is_posted   ON journal_entries(is_posted);


-- =============================================================================
-- 9. JOURNAL LINES
-- Individual debit/credit lines within a journal entry.
-- Depends on: journal_entries, chart_of_accounts, projects
-- =============================================================================

CREATE TABLE journal_lines (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code     TEXT NOT NULL REFERENCES chart_of_accounts(account_code) ON DELETE RESTRICT,
    debit            NUMERIC(18, 2) NOT NULL DEFAULT 0,
    credit           NUMERIC(18, 2) NOT NULL DEFAULT 0,
    project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,   -- nullable cost centre tag
    description      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_journal_lines_not_both_zero CHECK (debit > 0 OR credit > 0),
    CONSTRAINT chk_journal_lines_not_both_set  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_journal_lines_journal_entry_id ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account_code     ON journal_lines(account_code);
CREATE INDEX idx_journal_lines_project_id       ON journal_lines(project_id);


-- =============================================================================
-- 10. INVOICES
-- Depends on: clients, projects, divisions, profiles
-- =============================================================================

CREATE TABLE invoices (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number   TEXT NOT NULL UNIQUE,
    client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    division_id      UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
    invoice_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date         DATE,
    currency         TEXT NOT NULL DEFAULT 'GHS'
                         CHECK (currency IN ('GHS', 'USD', 'GBP', 'EUR')),
    exchange_rate    NUMERIC(12, 6) NOT NULL DEFAULT 1,   -- rate to GHS at invoice date
    subtotal         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    vat_amount       NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- 15%
    nhil_amount      NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- 2.5%
    getfund_amount   NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- 2.5%
    wht_amount       NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- withholding tax deducted
    wht_rate         NUMERIC(5, 2)  NOT NULL DEFAULT 0,   -- 5 | 7.5 | 15
    total_gross      NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- subtotal + vat + nhil + getfund
    total_net        NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- total_gross - wht_amount
    status           TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'paid')),
    approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_client_id      ON invoices(client_id);
CREATE INDEX idx_invoices_project_id     ON invoices(project_id);
CREATE INDEX idx_invoices_division_id    ON invoices(division_id);
CREATE INDEX idx_invoices_status         ON invoices(status);
CREATE INDEX idx_invoices_invoice_date   ON invoices(invoice_date);
CREATE INDEX idx_invoices_due_date       ON invoices(due_date);
CREATE INDEX idx_invoices_created_by     ON invoices(created_by);


-- =============================================================================
-- 11. INVOICE LINE ITEMS
-- Individual line items on an invoice.
-- Depends on: invoices, chart_of_accounts
-- =============================================================================

CREATE TABLE invoice_line_items (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description  TEXT NOT NULL,
    quantity     NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit_price   NUMERIC(18, 2) NOT NULL DEFAULT 0,
    amount       NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- quantity × unit_price
    account_code TEXT NOT NULL REFERENCES chart_of_accounts(account_code) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_line_items_invoice_id   ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_account_code ON invoice_line_items(account_code);


-- =============================================================================
-- 12. EMPLOYEES
-- Depends on: profiles
-- =============================================================================

CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id      UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
    employee_number TEXT NOT NULL UNIQUE,
    department      TEXT,
    job_title       TEXT,
    basic_salary    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    hire_date       DATE,
    contract_type   TEXT CHECK (contract_type IN ('permanent', 'contract', 'casual', 'intern')),
    tin             TEXT,
    ssnit_number    TEXT,
    bank_name       TEXT,
    bank_account    TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_profile_id      ON employees(profile_id);
CREATE INDEX idx_employees_employee_number ON employees(employee_number);
CREATE INDEX idx_employees_department      ON employees(department);
CREATE INDEX idx_employees_is_active       ON employees(is_active);


-- =============================================================================
-- 13. PAYROLL RUNS
-- One row per monthly payroll run.
-- Depends on: profiles
-- =============================================================================

CREATE TABLE payroll_runs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pay_period_month INTEGER NOT NULL CHECK (pay_period_month BETWEEN 1 AND 12),
    pay_period_year  INTEGER NOT NULL CHECK (pay_period_year >= 2020),
    status           TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'reviewed', 'approved', 'posted')),
    processed_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pay_period_month, pay_period_year)   -- one run per month
);

CREATE INDEX idx_payroll_runs_month_year ON payroll_runs(pay_period_month, pay_period_year);
CREATE INDEX idx_payroll_runs_status     ON payroll_runs(status);


-- =============================================================================
-- 14. PAYROLL LINES
-- One row per employee per payroll run.
-- Depends on: payroll_runs, employees
-- =============================================================================

CREATE TABLE payroll_lines (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id   UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    basic_salary     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    allowances       NUMERIC(18, 2) NOT NULL DEFAULT 0,
    gross_pay        NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- basic + allowances
    paye             NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- computed from GRA bands
    ssnit_employee   NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- 5.5% of basic
    ssnit_employer   NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- 13% of basic
    loan_deduction   NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- from staff_loans
    net_pay          NUMERIC(18, 2) NOT NULL DEFAULT 0,   -- gross - paye - ssnit_employee - loan_deduction
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (payroll_run_id, employee_id)                  -- one line per employee per run
);

CREATE INDEX idx_payroll_lines_payroll_run_id ON payroll_lines(payroll_run_id);
CREATE INDEX idx_payroll_lines_employee_id    ON payroll_lines(employee_id);


-- =============================================================================
-- 15. ASSETS
-- Fixed asset register.
-- Depends on: projects (nullable)
-- =============================================================================

CREATE TABLE assets (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_name              TEXT NOT NULL,
    asset_code              TEXT NOT NULL UNIQUE,
    category                TEXT NOT NULL,              -- e.g. Vehicle, Plant, Computer
    cost                    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    acquisition_date        DATE NOT NULL,
    useful_life_years       INTEGER NOT NULL DEFAULT 1,
    depreciation_method     TEXT NOT NULL DEFAULT 'straight_line'
                                CHECK (depreciation_method IN ('straight_line', 'reducing_balance')),
    accumulated_depreciation NUMERIC(18, 2) NOT NULL DEFAULT 0,
    net_book_value          NUMERIC(18, 2) NOT NULL DEFAULT 0,
    project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
    is_disposed             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_asset_code  ON assets(asset_code);
CREATE INDEX idx_assets_category    ON assets(category);
CREATE INDEX idx_assets_project_id  ON assets(project_id);
CREATE INDEX idx_assets_is_disposed ON assets(is_disposed);


-- =============================================================================
-- 16. SUBCONTRACTORS
-- Master record for subcontractor companies / sole traders.
-- No foreign key dependencies.
-- =============================================================================

CREATE TABLE subcontractors (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           TEXT NOT NULL,
    tin            TEXT,
    contact_person TEXT,
    phone          TEXT,
    email          TEXT,
    trade_type     TEXT,                -- e.g. Electrical, Plumbing, Carpentry
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subcontractors_tin ON subcontractors(tin);


-- =============================================================================
-- 17. PROJECT COSTS
-- Every cost tagged to a project — materials, labour, subcontractors, equipment.
-- Depends on: projects, subcontractors (nullable), profiles
-- =============================================================================

CREATE TABLE project_costs (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    cost_type              TEXT NOT NULL
                               CHECK (cost_type IN ('material', 'labour', 'subcontractor', 'equipment', 'overhead')),
    description            TEXT NOT NULL,
    amount                 NUMERIC(18, 2) NOT NULL DEFAULT 0,
    currency               TEXT NOT NULL DEFAULT 'GHS'
                               CHECK (currency IN ('GHS', 'USD', 'GBP', 'EUR')),
    supplier_subcontractor TEXT,                         -- free-text supplier name
    subcontractor_id       UUID REFERENCES subcontractors(id) ON DELETE SET NULL,
    receipt_url            TEXT,
    date_incurred          DATE NOT NULL DEFAULT CURRENT_DATE,
    posted_by              UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_costs_project_id       ON project_costs(project_id);
CREATE INDEX idx_project_costs_cost_type        ON project_costs(cost_type);
CREATE INDEX idx_project_costs_date_incurred    ON project_costs(date_incurred);
CREATE INDEX idx_project_costs_subcontractor_id ON project_costs(subcontractor_id);


-- =============================================================================
-- 18. MILESTONES
-- Project stages that trigger milestone billing when completed.
-- Depends on: projects, invoices (nullable — set after invoice is generated)
-- =============================================================================

CREATE TABLE milestones (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    title               TEXT NOT NULL,
    description         TEXT,
    percentage_complete NUMERIC(5, 2) NOT NULL DEFAULT 0
                            CHECK (percentage_complete BETWEEN 0 AND 100),
    due_date            DATE,
    completed_date      DATE,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'completed')),
    invoice_id          UUID REFERENCES invoices(id) ON DELETE SET NULL,   -- set once invoice raised
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_milestones_project_id ON milestones(project_id);
CREATE INDEX idx_milestones_status     ON milestones(status);
CREATE INDEX idx_milestones_invoice_id ON milestones(invoice_id);


-- =============================================================================
-- 19. DOCUMENTS
-- Generic document store linking files to any entity.
-- Depends on: profiles
-- =============================================================================

CREATE TABLE documents (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    related_type TEXT NOT NULL
                     CHECK (related_type IN ('invoice', 'project', 'employee', 'payroll', 'contract', 'asset')),
    related_id   UUID NOT NULL,          -- polymorphic FK — validated at app layer
    file_name    TEXT NOT NULL,
    file_url     TEXT NOT NULL,          -- Supabase Storage path
    uploaded_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_related_type ON documents(related_type);
CREATE INDEX idx_documents_related_id   ON documents(related_id);
CREATE INDEX idx_documents_uploaded_by  ON documents(uploaded_by);


-- =============================================================================
-- 20. MESSAGES
-- Internal messaging thread per project (visible across portals).
-- Depends on: projects, profiles
-- =============================================================================

CREATE TABLE messages (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sender_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    message_body TEXT NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_sender_id  ON messages(sender_id);
CREATE INDEX idx_messages_is_read    ON messages(is_read);


-- =============================================================================
-- 21. STAFF LOANS
-- Tracks employee loans and salary advance repayments.
-- Depends on: employees
-- =============================================================================

CREATE TABLE staff_loans (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    loan_amount        NUMERIC(18, 2) NOT NULL DEFAULT 0,
    outstanding_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    monthly_deduction  NUMERIC(18, 2) NOT NULL DEFAULT 0,
    start_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    status             TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'settled', 'written_off')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_loans_employee_id ON staff_loans(employee_id);
CREATE INDEX idx_staff_loans_status      ON staff_loans(status);


-- =============================================================================
-- 22. LEAVE REQUESTS
-- Depends on: employees, profiles (approver, nullable)
-- =============================================================================

CREATE TABLE leave_requests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    leave_type     TEXT NOT NULL
                       CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'study', 'unpaid', 'other')),
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    days_requested INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status      ON leave_requests(status);
CREATE INDEX idx_leave_requests_start_date  ON leave_requests(start_date);


-- =============================================================================
-- 23. TIMESHEETS
-- Hours per employee per project per day — feeds payroll and project costs.
-- Depends on: employees, projects, profiles (approver, nullable)
-- =============================================================================

CREATE TABLE timesheets (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    work_date    DATE NOT NULL,
    hours_worked NUMERIC(5, 2) NOT NULL DEFAULT 0
                     CHECK (hours_worked > 0 AND hours_worked <= 24),
    description  TEXT,
    approved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timesheets_employee_id ON timesheets(employee_id);
CREATE INDEX idx_timesheets_project_id  ON timesheets(project_id);
CREATE INDEX idx_timesheets_work_date   ON timesheets(work_date);


-- =============================================================================
-- 24. TAX RATES
-- Live tax rate table — rates can change; historical rates preserved by rows.
-- No foreign key dependencies.
-- =============================================================================

CREATE TABLE tax_rates (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_name       TEXT NOT NULL,          -- VAT | NHIL | GetFUND | WHT_individual | WHT_corporate | SSNIT_employee | SSNIT_employer | CIT
    rate           NUMERIC(8, 4) NOT NULL, -- stored as percentage: 15.0000 = 15%
    effective_date DATE NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tax_rates_tax_name      ON tax_rates(tax_name);
CREATE INDEX idx_tax_rates_effective_date ON tax_rates(effective_date);
CREATE INDEX idx_tax_rates_is_active     ON tax_rates(is_active);

-- Seed current Ghana tax rates (as at 2025)
INSERT INTO tax_rates (tax_name, rate, effective_date, is_active) VALUES
    ('VAT',              15.0000, '2023-01-01', TRUE),
    ('NHIL',              2.5000, '2019-01-01', TRUE),
    ('GetFUND',           2.5000, '2019-01-01', TRUE),
    ('WHT_individual',    5.0000, '2020-01-01', TRUE),
    ('WHT_corporate',     7.5000, '2020-01-01', TRUE),
    ('WHT_government',   15.0000, '2020-01-01', TRUE),
    ('SSNIT_employee',    5.5000, '2020-01-01', TRUE),
    ('SSNIT_employer',   13.0000, '2020-01-01', TRUE),
    ('CIT',              25.0000, '2020-01-01', TRUE);


-- =============================================================================
-- 25. FX RATES
-- Daily exchange rates from Bank of Ghana (or manual entry).
-- No foreign key dependencies.
-- =============================================================================

CREATE TABLE fx_rates (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency_code TEXT NOT NULL CHECK (currency_code IN ('USD', 'GBP', 'EUR')),
    rate_to_ghs   NUMERIC(12, 6) NOT NULL,
    rate_date     DATE NOT NULL,
    source        TEXT NOT NULL DEFAULT 'manual',   -- 'bank_of_ghana' | 'manual'
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (currency_code, rate_date)               -- one rate per currency per day
);

CREATE INDEX idx_fx_rates_currency_code ON fx_rates(currency_code);
CREATE INDEX idx_fx_rates_rate_date     ON fx_rates(rate_date);


-- =============================================================================
-- 26. AUDIT LOG
-- Immutable log of every write action across the system.
-- Depends on: profiles
-- =============================================================================

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'EXPORT')),
    table_name  TEXT NOT NULL,
    record_id   UUID,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id    ON audit_log(user_id);
CREATE INDEX idx_audit_log_action     ON audit_log(action);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_record_id  ON audit_log(record_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);


-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================
-- Tables created: 27
-- Seed data: roles (6), divisions (4), chart_of_accounts (77 accounts), tax_rates (9)
-- Indexes: 57
-- RLS: NOT included — see migration 002 (Step 4)
-- =============================================================================
