# AGENTS.md — Arcbuild Pro Development Guide

**Last Updated**: May 23, 2026  
**Current Phase**: Module 2.1 Complete (Invoice Engine) | Module 2.2 Starting (Invoice Approval)  
**AI Stack**: React + Vite + Supabase + PostgreSQL + Tailwind CSS

---

## Architecture Overview

**Arcbuild Pro** is a construction finance management system with:
- **Frontend**: React (JSX) + Vite + Tailwind CSS, running on Vercel
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **6 Role-Based Portals**: CEO, Accountant, Project Manager, HR Manager, Employee, Client
- **7 Financial Pillars**: Invoicing, Journals, Payroll, Project Finance, Assets, Tax, Retention

### Tech Stack
```
VITE + REACT 19 + TAILWIND 4 + REACT-ROUTER 7
└─ SUPABASE (PostgreSQL + RLS + Auth)
   └─ EDGE FUNCTIONS (Deno)
   └─ Row-Level Security (RLS) policies
```

---

## Critical Patterns (Read These First)

### 1. **Three Golden Rules of Arcbuild Pro**

1. **Role = Source of Truth**, not JWT claims
   - Roles live in `profiles.role` (text field)
   - RLS policies read role via: `SELECT role FROM profiles WHERE user_id = auth.uid()`
   - ❌ Never use `auth.jwt() ->> 'role'` — it's empty
   - ✅ Example (CRITICAL_FIXES_APPLIED.md line 56–85)

2. **Division ID = Foreign Key**, not TEXT
   - `invoices.division_id` → UUID FK to `divisions.id`
   - `projects.division_id` → UUID FK to `divisions.id`
   - NOT `invoices.division` (text)
   - Enable journal cascade in Module 2.3: `invoices.division_id → divisions.id → ACCOUNT_CODES`

3. **Tax Computation = Dual Authority**
   - **React** (`InvoiceForm.jsx`, line ~470): Local `computeTaxes()` for real-time UI display
   - **PostgreSQL** (`compute_invoice_taxes()` RPC): Authoritative values stored in DB
   - Module 2.3 journals use **only the DB values** (not React recalculations)

### 2. **Authentication Flow (10 seconds)**

```javascript
// In AuthContext.jsx:
1. supabase.auth.getSession() → get auth user
2. fetchProfile(user.id) → query profiles table
3. setRole(profile.role) → store role in React state
4. useAuth hook → provides { user, profile, role, loading }

// In components:
const { role, loading } = useAuth()
if (!loading && role === 'accountant') { ... }
```

### 3. **RLS Policy Pattern**

```sql
-- Template (from CRITICAL_FIXES_APPLIED.md):
CREATE POLICY "policy_name" ON table_name FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE user_id = auth.uid()) 
    IN ('ceo', 'accountant')
  );

-- Do NOT use: auth.jwt() ->> 'role'
-- Roles are in profiles table, not JWT
```

---

## Database Schema Essentials

### Core Tables Structure
- **profiles** (links auth.users to roles and orgs)
  - `user_id` (FK auth.users) 
  - `role` (text: 'ceo', 'accountant', 'project_manager', 'hr_manager', 'employee', 'client')
  - `email`, `full_name`, `phone`

- **clients** (with tax flags)
  - `client_type` (enum: 'individual', 'corporate', 'government')
  - `applies_vat`, `applies_nhil`, `applies_getfund`, `applies_wht` (all BOOLEAN)
  - `wht_rate` (numeric, computed from client_type)

- **invoices** (current focus — Module 2.1)
  - `invoice_number` (auto-generated: 'ARC-2025-0001')
  - `client_id`, `project_id`, `division_id` (all FKs)
  - `currency` (enum: 'GHS', 'USD', 'GBP', 'EUR')
  - `fx_rate_to_ghs` (locked at invoice creation)
  - Tax fields: `vat_amount`, `nhil_amount`, `getfund_amount`, `wht_amount`, `gross_total`, `expected_receipt`
  - GHS equivalents: `vat_amount_ghs`, `nhil_amount_ghs`, etc. (frozen, never recalculated)
  - Status: 'draft' → 'pending_approval' → 'approved' → 'sent' → 'paid' | 'rejected'
  - `requires_approval` (boolean, set by `compute_invoice_taxes()` if gross_total_ghs ≥ threshold)

- **invoice_line_items**
  - `invoice_id` (FK cascading delete)
  - `quantity`, `unit_price`, `line_total` (auto-calculated)
  - `description`

- **exchange_rates** (for multi-currency)
  - `currency_code` (USD, GBP, EUR)
  - `rate_to_ghs` (e.g., 14.50)
  - `rate_date`, `created_at`
  - Unique constraint: (currency_code, rate_date)

- **system_config** (business rules)
  - Key examples: 'invoice_approval_threshold_ghs' = 100000, 'default_currency' = 'GHS'

### Key Migrations
- `001_initial_schema.sql` — Core tables
- `002_rls_policies.sql` — Security policies
- `003_auth_trigger.sql` — Profile auto-creation
- `004_invoice_engine.sql` — Invoices, tax functions, RLS for invoices (May 16 fixes applied)

---

## Service Layer Pattern

### File: `src/services/*.js`

Each service follows this structure:
```javascript
// 1. Import supabase client
import { supabase } from '../lib/supabase'

// 2. Helper: resolve profile ID (handles both profile_id and user_id)
async function resolveProfileId(userId) { ... }

// 3. Define allowed fields (whitelist for sanitization)
const CLIENT_FIELDS = ['name', 'client_type', 'tin', ...]
const sanitizeClientPayload = (payload) => { ... }

// 4. Export async functions (each handles one operation)
export async function getClients(filters = {}) { ... }
export async function getClientById(id) { ... }
export async function createClient(clientData, currentUserId) { ... }
export async function updateClient(id, clientData, currentUserId) { ... }

// 5. Include audit logging
await supabase.from('audit_log').insert({
  user_id: auditUserId,
  action: 'UPDATE',
  table_name: 'clients',
  record_id: id,
  old_value: JSON.stringify(before),
  new_value: JSON.stringify(data),
})
```

**Current Services**:
- `clientService.js` — CRUD, tax profile, ageing analysis
- `projectService.js` — Projects + divisions + cost ledgers
- `paymentService.js` — Record payments, reconciliation
- `chartOfAccountsService.js` — Chart + journals + trial balance
- `fxRatesService.js` — Exchange rates
- `revenueRecognitionService.js` — Revenue tracking
- `retentionService.js` — Retention holds

---

## Component Patterns

### Standard Hook Pattern (InvoiceForm.jsx is the reference)
```javascript
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Component() {
  const { role } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch on mount or dependency change
  useEffect(() => {
    const load = async () => {
      try {
        const { data: result, error: err } = await supabase
          .from('table_name')
          .select('columns')
          .eq('filter', value)
        if (err) throw err
        setData(result)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dependency])

  if (loading) return <Spinner />
  if (error) return <ErrorAlert>{error}</ErrorAlert>
  return <div>...</div>
}
```

### Form State Pattern (InvoiceForm.jsx lines 312–355)
- Separate form state from computed state
- formData = { client_id, project_id, division_id, currency, fx_rate_to_ghs, ... }
- lineItems = [{ id, description, quantity, unit_price }, ...]
- taxes = { subtotal, vat, nhil, getfund, gross_total, wht, expected_receipt, ... }
- Each useEffect watches specific dependencies and updates derived state

---

## Tax Computation (Module 2.1 Reference)

### In React (InvoiceForm.jsx, line ~470)
```javascript
const computeTaxes = useCallback(() => {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  
  const vat = clientTaxProfile?.applies_vat ? subtotal * 0.15 : 0
  const nhil = clientTaxProfile?.applies_nhil ? subtotal * 0.025 : 0
  const getfund = clientTaxProfile?.applies_getfund ? subtotal * 0.025 : 0
  const gross_total = subtotal + vat + nhil + getfund
  const wht = clientTaxProfile?.applies_wht ? subtotal * clientTaxProfile.wht_rate : 0
  const expected_receipt = gross_total - wht
  
  const fx = formData.fx_rate_to_ghs || 1.0
  const gross_total_ghs = gross_total * fx
  
  setTaxes({ subtotal, vat, nhil, getfund, gross_total, wht, expected_receipt, gross_total_ghs, ... })
  setRequiresApproval(gross_total_ghs >= approvalThreshold)
}, [lineItems, clientTaxProfile, formData.fx_rate_to_ghs, approvalThreshold])
```

### In PostgreSQL (compute_invoice_taxes() RPC)
**Location**: `supabase/migrations/004_invoice_engine.sql` (lines ~320–400)
- Called after invoice saved via: `supabase.rpc('compute_invoice_taxes', { invoice_uuid })`
- Recalculates all taxes and GHS equivalents
- Atomically updates invoice row
- This is the **authoritative version** — used by Module 2.3 journals

---

## Routing Architecture

### Route Security Pattern (App.jsx)
```javascript
<Route path="/accountant" element={
  <ProtectedRoute allowedRoles={['accountant']}>
    <AccountantPortal />
  </ProtectedRoute>
} />
```

**ProtectedRoute Component** (`ProtectedRoute.jsx`):
1. If loading → Show spinner
2. If no session → Redirect to /login
3. If role not allowed → Redirect to /unauthorized
4. Else → Render children

**Roles**:
- 'ceo' → all features
- 'accountant' → invoicing, journals, tax, chart of accounts
- 'project_manager' → own projects + invoices
- 'hr_manager' → payroll + employees
- 'employee' → timesheets + payslips
- 'client' → own invoices + project progress

---

## Development Workflow

### Setup & Running
```bash
# Install dependencies
npm install

# Start dev server (HMR enabled)
npm run dev
# → App runs on http://localhost:5173

# Build for production
npm run build
# → Output in dist/

# Preview production build locally
npm run preview

# Lint
npm lint
```

### Environment Variables (required)
Create `.env` file:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Key Config Files
- `vite.config.js` — Plugins: React, Tailwind CSS; Aliases for buffer
- `tailwind.config.js` — Tailwind + Vite integration
- `tsconfig.json` — JSX, ESNext, allowJs=true
- `eslint.config.js` — Eslint rules

---

## Current Module Status

### ✅ Module 2.1 Complete: Invoice Engine

**Implemented** (May 16, 2026):
- Database schema: invoices, invoice_line_items, exchange_rates
- Auto-numbering: `ARC-YYYY-NNNN` format
- Multi-currency: GHS, USD, GBP, EUR with FX rates locked at invoice time
- Tax computation: VAT (15%), NHIL (2.5%), GetFUND (2.5%), WHT (by client type)
- Approval threshold: Invoices with gross_total_ghs ≥ ₵100,000 require approval
- RLS policies: CEO/Accountant full access, PM project-scoped, Client self-service
- InvoiceForm component: 650 lines, real-time tax display, line item management

**Critical Fixes Applied** (CRITICAL_FIXES_APPLIED.md):
1. Schema: division_id is now UUID FK (not TEXT)
2. RLS: All policies read role from profiles table (not JWT claims)
3. Tax: Documented dual-authority pattern (React for UI, PostgreSQL authoritative)

**Testing**: MODULE_2_1_TECHNICAL_GUIDE.md contains full checklist + 3 integration scenarios

### ⏳ Module 2.2 In Progress: Invoice Approval Workflow

**Next Tasks**:
- CEO/Director approval interface
- Bulk actions + filtering
- Email notifications (Resend API)
- PDF invoice generation
- Status state machine enforcement
- Payment recording interface

**Prerequisites**: Module 2.1 must be complete (✅ Done)

### 🔮 Future Modules
- **Module 2.3**: Journal cascade (auto-post GL entries on invoice approval)
- **Phase 3**: Project finance dashboard, payroll engine, asset register
- **Phase 4**: Six portals (Portal placeholders exist in src/pages/portals/)

---

## Known Gotchas & Anti-Patterns

### ❌ DO NOT
- Use `auth.jwt() ->> 'role'` — role is not in JWT claims
- Store `division` as TEXT in invoices table — use division_id FK
- Recalculate taxes in Module 2.3 — use values from invoices table only
- Call `compute_invoice_taxes()` multiple times in quick succession — it's idempotent but expensive
- Forget to sanitize payloads before INSERT/UPDATE (use service layer patterns)

### ✅ DO THIS INSTEAD
- Query `profiles.role` for role checks in RLS policies
- Use `division_id` FK everywhere for consistency
- Trust PostgreSQL-computed tax amounts in journals
- Batch operations when possible
- Always include audit_log entry after mutations

---

## Project Dependencies

### Key NPM Packages
- `@supabase/supabase-js@^2.105.4` — Database + Auth client
- `react@^19.2.6` + `react-dom@^19.2.6` — UI framework
- `react-router-dom@^7.15.1` — Routing
- `@react-pdf/renderer@^4.5.1` — PDF generation
- `recharts@^3.8.1` — Data visualization
- `tailwindcss@^4.3.0` — CSS framework
- `vite@^8.0.12` — Build tool
- `xlsx@^0.18.5` — Excel export
- `ws@^8.20.1` — WebSocket (future: real-time sync)

### External APIs
- **Bank of Ghana FX API** — Fetch daily rates (exchange_rates table)
- **Resend** — Email notifications (Module 2.2)
- **GRA Tax API** — Tax tables (Phase 5)

---

## File Organization

```
src/
├── App.jsx                           # Main router
├── main.jsx                          # Entry point
├── context/
│   ├── AuthContext.jsx               # Auth + role + profile state
│   ├── ThemeContext.jsx              # Dark/light theme
│   ├── ClientContext.jsx             # Shared client data
│   ├── PmProjectContext.jsx          # PM project context
│   └── EmployeeContext.jsx           # Employee context
├── components/
│   ├── ProtectedRoute.jsx            # Route protection wrapper
│   ├── InvoiceForm.jsx               # 650-line invoice builder (Module 2.1)
│   ├── InvoiceList.jsx               # Invoice registry
│   ├── GeneralLedger.jsx             # GL viewer
│   ├── FinancialStatements.jsx       # P&L, Balance Sheet
│   ├── [other modules...]
│   └── ui/                           # Reusable UI components
├── pages/
│   ├── Login.jsx                     # Auth entry
│   ├── portals/                      # 6 role-specific portals
│   │   ├── CeoPortal.jsx
│   │   ├── AccountantPortal.jsx
│   │   ├── PmPortal.jsx
│   │   └── ...
│   ├── clients/, projects/, accounts/, payments/, ... # CRUD pages
├── services/
│   ├── clientService.js              # Client CRUD + audit
│   ├── projectService.js
│   ├── paymentService.js
│   ├── chartOfAccountsService.js
│   └── ...                           # 1 service per entity
├── lib/
│   ├── supabase.js                   # Supabase client init
│   ├── company-config.js             # Company metadata
│   ├── tax-constants.js              # Tax rates + account mappings
│   ├── formatGhs.js                  # Currency formatting
│   ├── payroll-variables.js          # Payroll tax bands
│   └── ...
├── hooks/
│   └── usePaymentReceipt.js          # Reusable hook pattern
├── styles/
│   ├── theme.css                     # Tailwind color palette
│   ├── globals.css                   # Global styles
│   └── ...
└── utils/
    ├── exportToExcel.js              # Data export
    ├── numberToWords.js              # GHS to Words ("Five Thousand Ghana Cedis")
    └── ...
```

---

## Key Documentation Files

- **MODULE_2_1_TECHNICAL_GUIDE.md** (1018 lines) — Complete invoice engine design + testing checklist
- **CRITICAL_FIXES_APPLIED.md** (240 lines) — RLS + schema fixes applied May 16
- **CHART_OF_ACCOUNTS.md** — GL account structure + posting rules
- **arcbuild_pro_development_plan.md** — 5-phase roadmap + all 7 pillars
- **CRITICAL_ISSUES_MODULE_2_1.md** — Original issue tracking (now resolved)

---

## Quick Reference: Common Tasks

### Add a New Service
```javascript
// 1. Create src/services/featureService.js
// 2. Import supabase
// 3. Define fields whitelist
// 4. Implement CRUD + audit logging
// 5. Export async functions
// 6. Use in components via service functions
```

### Add a New REST Endpoint
Arcbuild Pro uses RPC (PostgreSQL functions) instead of REST. Example:
```javascript
const { data, error } = await supabase.rpc('compute_invoice_taxes', {
  invoice_uuid: invoiceId
})
```

### Check RLS Access for a Role
```sql
-- In Supabase SQL Editor, impersonate a role:
SET ROLE authenticated;  -- or 'ceo', etc.
SELECT * FROM invoices;  -- What can this role see?
RESET ROLE;
```

### Debug Auth Issues
```javascript
// In browser console:
const { data: { session } } = await supabase.auth.getSession()
console.log(session?.user?.id)  // Auth user ID
const { data: profile } = await supabase.from('profiles').select('*').single()
console.log(profile?.role)  // Should show role
```

---

## Next Steps for New Contributors

1. **Understand Module 2.1** — Read MODULE_2_1_TECHNICAL_GUIDE.md (sections: Architecture, Database, Frontend, Tax Logic)
2. **Run locally** — `npm install && npm run dev`, login with test account
3. **Inspect InvoiceForm.jsx** — 650 lines showing state management, useEffect patterns, Supabase queries
4. **Read CRITICAL_FIXES_APPLIED.md** — Know the gotchas (role lookup, division_id FK, tax duality)
5. **Start Module 2.2** — Use existing invoice data to build approval workflow

---

**Last Updated**: May 23, 2026  
**Maintained By**: AI Build System  
**Status**: Ready for Module 2.2 Development

