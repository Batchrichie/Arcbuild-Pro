# ARCBUILD PRO — Development Plan
**AI-built · Supabase backend · React frontend · 5 phases · 7 pillars · 6 portals**

---

## Technology Stack

| Layer | Tools |
|---|---|
| Database / Backend | Supabase (PostgreSQL), Supabase Auth, Supabase Storage, Supabase Edge Functions, Row Level Security (RLS), Realtime subscriptions |
| Frontend | React + Vite, Tailwind CSS, React Router, Recharts (dashboards), React PDF |
| AI Layer | Claude API (Sonnet) — tax computation, smart alerts, report generation |
| Integrations | Resend (email), Bank of Ghana FX API, GRA tax tables, SSNIT rates |

---

## Phase 1 — Foundation: Database & Auth
**Timeline: Weeks 1–2**
Everything else runs on what is built here.

### Supabase Setup Tasks
- **Database schema** — Design and migrate all 20+ core tables: clients, contracts, projects, chart of accounts, journal entries, invoices, employees, payroll, assets, documents, audit log — with foreign keys and indexes
- **Row Level Security (RLS) policies** — CEO sees all; accountant sees financials; project manager sees own projects; client sees own data only
- **Auth & roles** — 6 portal roles: CEO, Accountant, Project Manager, HR Manager, Employee, Client — role assignment on signup/invite
- **Chart of accounts** — Pre-seeded with: 1000s Assets, 2000s Liabilities, 3000s Equity, 4000s Revenue (by division), 5000s Cost of Sales, 6000s Operating Expenses, 7000s Tax Accounts

### Phase 1 Completion Flow
```
Supabase project created → Schema migrated → RLS active → Auth roles configured → Seed data loaded
```

---

## Phase 2 — Core Financial Engine
**Timeline: Weeks 3–5**
Invoice → journal cascade → live financial statements.

### Modules to Build

- **Invoice engine** — Auto-compute VAT (15%), NHIL (2.5%), GetFUND (2.5%), and withholding tax based on client type (individual, corporate, government). Display: Gross → Taxes → Net → WHT Deduction → Expected Receipt
- **Journal cascade (Edge Function)** — Triggers on invoice approval and automatically posts double-entry journal:
  - Debit: Accounts Receivable (client)
  - Credit: Revenue (by service type — Construction, Design, Real Estate, Logistics)
  - Credit: VAT Payable
  - Credit: NHIL / GetFUND Payable
  - Debit: Withholding Tax Receivable (where applicable)
- **General ledger** — Live, filterable by account code, date range, project, and division. Running balance column.
- **Financial statements** — Real-time Income Statement, Balance Sheet, Trial Balance, Cash Flow Statement. Filter by date range and division.
- **Multi-currency module** — Invoice in USD, GBP, EUR; store GHS equivalent at invoice date using Bank of Ghana rate; auto-post FX gain/loss on payment if rate has moved
- **Invoice approval workflow** — Invoices above a set threshold require director approval. State machine: Draft → Pending Approval → Approved → Sent → Paid

---

## Phase 3 — Project Finance & Payroll
**Timeline: Weeks 6–8**
Project cockpits + one-button payroll.

### Modules to Build

- **Project finance dashboard** — Per-project cockpit showing: contract value, invoiced to date, received, outstanding balance, amount spent, budget vs actual variance, profit/loss, retention held, financial completion percentage
- **Cost tagging** — Every purchase, wage, subcontractor payment, or expense tagged to a project in Supabase; feeds project cost ledger automatically
- **Milestone billing** — Project stage completion triggers invoice creation. PM confirms stage → accountant queue notification → invoice prepared and sent
- **Payroll engine (Edge Function)** — One-button month-end processing:
  - Compute basic salary + allowances per employee
  - Auto-compute PAYE using Ghana Revenue Authority tax bands
  - Deduct SSNIT: 5.5% employee + 13% employer
  - Deduct staff loans and salary advances
  - Generate net pay per employee
  - Auto-generate payslips (PDF via Supabase Storage)
  - Prepare PAYE remittance schedule for GRA
  - Prepare SSNIT contribution schedule
  - Post payroll journal entry automatically
- **Subcontractor management** — Register with TIN, link to projects, issue payment certificates, auto-deduct withholding tax, track payment history per project
- **Asset register** — Register assets with cost, depreciation method, useful life; auto-post monthly depreciation journal; show net book value at any date

---

## Phase 4 — Six Portals
**Timeline: Weeks 9–12**
Each role sees exactly what they need, and nothing they don't.

### Portal 1 — Client Portal
- Auto-created when first invoice is generated; login credentials emailed to client
- Project progress tracker with visual stage bars (construction stages + design stages)
- Invoice list with PDF download
- Payment history and outstanding balance
- Built-in messaging thread with project team (logged and timestamped)
- Cannot see: internal costs, margins, other clients' data

### Portal 2 — CEO / Director Portal
- Executive dashboard: revenue this month vs last vs same month last year, cash across all bank accounts, outstanding receivables, outstanding payables, active project health status, profit margin, tax due in 30 days, payroll cost this month
- Division performance: Construction vs Architecture vs Real Estate vs Logistics
- One-tap approvals for high-value invoices, payroll release, large expenses
- Smart alert notifications

### Portal 3 — Accountant Portal
- Full invoice management (create, review, approve, send, record payments)
- Chart of accounts management and manual journal entries
- General ledger, trial balance, bank reconciliation
- Tax centre: VAT returns, WHT schedules, PAYE remittances
- Financial statements export (PDF and Excel)
- Payroll review and approval before release
- Full audit trail access

### Portal 4 — Project Manager Portal
- Project control centre: milestone tracker, budget vs actual, team and subcontractor list
- Mark stages complete (triggers milestone invoice queue)
- Cost entry: materials, equipment hire, subcontractor payment certificates
- Site photo upload via Supabase Storage (visible to client in their portal)
- Issue and risk log (visible to CEO and directors)

### Portal 5 — Employee Portal
- Current and historical payslips (downloadable PDF)
- PAYE deduction summary and SSNIT contribution history
- Staff loan / salary advance repayment schedule
- Leave application, leave balance, leave history
- Timesheet submission (hours per project per day → feeds payroll and project cost)
- Site staff: project assignments, daily progress reports, material usage logging

### Portal 6 — HR Manager Portal
- Full employee registry with onboarding flow (auto-creates employee portal access)
- Monthly payroll variable input (overtime, bonuses, new joiners, leavers)
- Payroll review before sending to accountant
- Leave calendar and approval management
- SSNIT registration, TIN registration, and contract expiry tracking

---

## Phase 5 — Tax Centre, Alerts & Intelligence
**Timeline: Weeks 13–15**
GRA-ready reporting + smart notifications + management intelligence.

### Modules to Build

- **Tax Management Centre**
  - Live tax calendar with all GRA deadlines
  - One-click generation of: VAT Return (Form VAT 3), WHT certificates, PAYE schedule, NHIL/GetFUND summary, corporate tax computation with capital allowances
  - Mark taxes as filed with GRA reference numbers
  - Input VAT tracking and auto-offset against output VAT

- **Smart alert system (Edge Functions + Resend)**
  - Invoice 7 days overdue → accountant alerted, client gets polite automated reminder
  - Project 10% over budget → project manager and CEO notified
  - Tax deadline in 14 days → accountant and CEO notified
  - Employee contract expires in 30 days → HR notified
  - Bank balance drops below threshold → CEO and accountant notified
  - Large payment received → CEO notified immediately

- **Document generation (React PDF + Supabase Storage)**
  - Branded PDFs: invoices, payslips, receipts, progress reports, financial statements, WHT certificates, subcontractor payment certificates, proforma invoices
  - All stored in Supabase Storage and linked to relevant project/client/transaction

- **Bank reconciliation**
  - Import bank statements
  - Auto-match against system transactions
  - Flag unmatched items for investigation
  - Supports multiple GHS and foreign currency accounts

- **Management reporting suite**
  - Revenue by division
  - Project profitability rankings
  - Aged receivables (who owes and for how long)
  - Aged payables
  - Top clients by revenue
  - Budget vs actual (company and project level)
  - Employee cost report
  - Export to PDF and Excel

- **Audit trail and access control**
  - Log every action: who, what, when, what changed
  - Audit trail view for directors
  - No deletion without trace
  - User role management UI for administrator

---

## Key Automation: The Invoice Cascade

When an invoice is approved, one Supabase Edge Function executes the full chain:

```
Invoice approved
  → Journal entry auto-posted (debit/credit all affected accounts)
  → General ledger updated in real time
  → Trial balance refreshed
  → Financial statements updated
  → Project finance dashboard updated
  → Tax liabilities updated
  → Invoice PDF generated and emailed to client (via Resend)
```

No human intervention required at any step.

---

## Month-End Flow

```
PM confirms milestone → Accountant prepares invoice → CEO approves (if above threshold)
  → Invoice posted → Cascade executes
  → End of month: Run Payroll (one button)
  → Payroll journals posted → PAYE and SSNIT schedules generated
  → Tax centre: VAT return prepared → Filed → Marked complete in tax calendar
  → CEO reviews executive dashboard
```

---

## Portal Access Summary

| Feature | Client | Accountant | CEO | Employee | Project Manager | HR |
|---|---|---|---|---|---|---|
| Own project tracking | ✅ | ✅ | ✅ | — | ✅ | — |
| Own invoices | ✅ | ✅ | ✅ | — | View only | — |
| All financials | — | ✅ | ✅ | — | Project only | — |
| Payroll | — | ✅ | Summary | Own payslips | — | ✅ |
| Tax management | — | ✅ | Summary | — | — | — |
| Approvals | — | Invoices | Full | — | Progress | HR items |
| Site updates | — | — | View | If site staff | ✅ | — |
| Company reports | — | ✅ | ✅ | — | Project only | HR reports |
| Client messaging | ✅ | ✅ | ✅ | — | ✅ | — |

---

## Active Tax Rules (Ghana)

| Tax | Rate | Notes |
|---|---|---|
| VAT | 15% | On applicable taxable supplies |
| NHIL | 2.5% | National Health Insurance Levy |
| GetFUND Levy | 2.5% | On taxable supplies |
| Withholding Tax | 5% / 7.5% / 15% | Rate varies by client type and transaction |
| PAYE | GRA tax bands | Computed per employee monthly |
| SSNIT | 5.5% employee + 13% employer | Monthly contribution |
| Corporate Income Tax | 25% | Annual |

*Note: COVID-19 Health Recovery Levy has been removed — no longer applicable.*

---

---

## Development Progress

### Phase 1 — Foundation ✅ COMPLETE
**Database schema**: All 27 tables migrated (Migrations 001–003)  
**Auth & RLS**: 6 roles configured with row-level security policies  
**Chart of Accounts**: Pre-seeded with Ghana-compliant GL accounts  
**Status**: Ready for Phase 2

### Phase 2, Module 2.1 — Invoice Engine ✅ COMPLETE
**Date Completed**: May 16, 2026

#### Deliverables Implemented
1. **System Configuration** (system_config table)
   - Approval threshold: GHS 100,000
   - Default currency: GHS
   - Exchange rate source: Bank of Ghana

2. **Tax Constants Module** (`supabase/functions/_shared/tax-constants.ts`)
   - VAT, NHIL, GetFUND, WHT rates
   - Chart of accounts mappings
   - Division-to-revenue-account lookup
   - Utility functions for tax calculations

3. **Extended Clients Table**
   - Tax profile flags: applies_vat, applies_nhil, applies_getfund, applies_wht
   - Computed WHT rate by client type (individual 5%, corporate 7.5%, government 15%)
   - Auth user link for client portal access

4. **Exchange Rates Table**
   - Multi-currency support (GHS, USD, GBP, EUR)
   - Seeded with placeholder rates (accountant updates daily or via API)
   - Supports FX rate override in invoice form

5. **Invoices Table** — Complete rebuild with:
   - Auto-numbered format: ARC-YYYY-NNNN
   - Currency and FX fields
   - In-currency amounts (subtotal, taxes, gross, WHT, expected receipt)
   - GHS equivalents (locked at fx_rate_date)
   - Approval workflow (draft → pending_approval → approved → sent → paid)
   - Approval threshold detection and flag
   - Full audit trail (created_by, created_at, updated_at, etc.)

6. **Invoice Line Items Table**
   - Description, quantity, unit_price
   - Line total computed field (quantity × unit_price)
   - Cascading delete with invoice

7. **Tax Computation Function** (`compute_invoice_taxes`)
   - PostgreSQL function called after line item changes
   - Calculates: subtotal, VAT, NHIL, GetFUND, gross total, WHT, expected receipt
   - Converts all amounts to GHS equivalent
   - Checks approval threshold
   - Updates invoice atomically
   - **Security**: DEFINER privileges, run by system

8. **Auto-Numbering Trigger** (`generate_invoice_number`)
   - Generates invoice numbers: ARC-YYYY-NNNN
   - Increments per calendar year
   - Applied before insert when invoice_number is NULL

9. **Row Level Security** (invoices & invoice_line_items tables)
   - CEO & Accountant: Full access (all operations)
   - Project Manager: SELECT only on assigned projects
   - Client: SELECT only on own invoices
   - Policies prevent unauthorized access at the database layer

10. **React Invoice Form Component** (`src/components/InvoiceForm.jsx`)
    - **Features**:
      - Client selection dropdown with tax profile loading
      - Project selection filtered by client
      - Division auto-filled from project
      - Multi-currency selector (GHS/USD/GBP/EUR)
      - FX rate fetching and override capability
      - Line items: add/remove rows, quantity × unit price calculation
      - Real-time tax breakdown panel (sticky right sidebar)
      - Approval threshold banner warning
      - Save as Draft / Submit for Approval actions
    - **Behavior**:
      - Tax breakdown updates in real-time on every line item change
      - Shows all applicable taxes based on client profile
      - Displays GHS equivalents if foreign currency
      - Calls compute_invoice_taxes() on save
      - Status set to 'pending_approval' if requires_approval=true
    - **Styling**: Tailwind CSS, professional gradient UI

#### Migration File
**Location**: `supabase/migrations/004_invoice_engine.sql`  
**Lines**: ~500+  
**Idempotent**: YES — Safe to re-run (uses IF NOT EXISTS, DROP IF EXISTS)  
**Dependencies**: Completed Phase 1 migrations (001–003)

#### How It Works (Example)
```
1. Accountant selects: Client (XYZ Corp), Project (Office Design), Currency (USD)
2. Form fetches FX rate: USD/GHS = 14.50
3. Accountant adds line items:
   - Design fees: 1 × $5,000 = $5,000
   - Revisions: 2 × $500 = $1,000
   - Subtotal: $6,000
4. Tax computation (auto):
   - VAT (15%): $900
   - NHIL (2.5%): $150
   - GetFUND (2.5%): $150
   - Gross: $7,200
   - WHT (7.5% corporate): $450
   - Expected receipt: $6,750
5. Convert to GHS:
   - Gross: $7,200 × 14.50 = ₵104,400
   - EXCEEDS ₵100,000 threshold → Banner: "Requires director approval"
6. Accountant clicks "Submit for Approval"
7. Status set to 'pending_approval'
8. compute_invoice_taxes() locks GHS equivalents and sets requires_approval=true
9. Invoice queued for CEO approval (Module 2.2)
```

#### Testing Completed
- ✅ Migration runs without errors
- ✅ system_config seeded correctly
- ✅ clients table extended with tax profile fields
- ✅ exchange_rates table seeded
- ✅ invoices table with enums and all fields
- ✅ invoice_line_items created with CASCADE delete
- ✅ compute_invoice_taxes function tested with line items
- ✅ Auto-number trigger generates correct format
- ✅ RLS policies created (CEO/Accountant/PM/Client access)
- ✅ React form loads clients and projects dynamically
- ✅ Tax breakdown computes correctly in real-time
- ✅ Approval threshold detection working
- ✅ Form saves invoices to database
- ✅ compute_invoice_taxes called on save

#### What's Next: Module 2.2 — Invoice Approval Workflow
When ready, Module 2.2 will implement:
- CEO approval interface with bulk actions
- Email notifications to CEO and client on status change
- Invoice PDF generation and email dispatch (via Resend)
- Payment tracking and receipt posting
- Cascade to journal entries for approved invoices
- Status state machine enforcement

---

*ARCBUILD PRO — Built for construction, architecture, real estate, and logistics. One entry. Everything updates.*
