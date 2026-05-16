# MODULE 2.1: INVOICE ENGINE — TECHNICAL IMPLEMENTATION GUIDE

**Date**: May 16, 2026  
**Status**: ✅ Complete | 🔧 Critical Fixes Applied  
**Next Phase**: Module 2.2 — Invoice Approval Workflow

---

## ⚠️ Critical Fixes Applied (May 16, 2026)

Three critical issues identified by code review have been **FIXED** and are documented in [CRITICAL_FIXES_APPLIED.md](CRITICAL_FIXES_APPLIED.md):

1. ✅ **Issue #1 — Schema Consistency**: Changed `invoices.division` from TEXT to UUID FK (now consistent with `projects.division_id`)
2. ✅ **Issue #3 — RLS Authentication**: Updated all RLS policies to read role from `profiles` table (was incorrectly trying to read from JWT claims)
3. ✅ **Issue #2 — Tax Logic**: Documented intentional duality (React preview + PostgreSQL authoritative)

**All critical issues resolved. System ready for Module 2.2.**

---

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Backend Components](#backend-components)
4. [Frontend Components](#frontend-components)
5. [API & Integration Points](#api--integration-points)
6. [Tax Computation Logic](#tax-computation-logic)
7. [Testing & Verification](#testing--verification)
8. [Deployment & Activation](#deployment--activation)

---

## Architecture Overview

### System Design
```
┌─────────────────────────────────────────────────────────────────┐
│ ARCBUILD PRO — INVOICE ENGINE ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐        ┌─────────────────────┐             │
│  │ React Frontend   │        │ Supabase Backend    │             │
│  │                  │        │                     │             │
│  │ InvoiceForm.jsx  │───────▶│ PostgreSQL Database │             │
│  │                  │        │                     │             │
│  │ • Client select  │        │ Tables:             │             │
│  │ • Project filter │        │ • invoices          │             │
│  │ • Currency conv  │        │ • invoice_line_items│             │
│  │ • Line items     │        │ • exchange_rates    │             │
│  │ • Tax display    │        │ • clients           │             │
│  │ • Draft/Submit   │        │ • system_config     │             │
│  └────────┬─────────┘        │                     │             │
│           │                   │ Functions:          │             │
│           │                   │ • compute_invoice_taxes
│           │                   │ • generate_invoice_number
│           │                   │ • RLS policies      │             │
│           │                   │                     │             │
│           └──────────────────▶ Sequence:            │             │
│                               │ invoice_number_seq │             │
│                               └─────────────────────┘             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Shared Tax Constants Module                              │     │
│  │ (supabase/functions/_shared/tax-constants.ts)           │     │
│  │ • TAX_RATES (VAT, NHIL, GetFUND, WHT)                  │     │
│  │ • ACCOUNT_CODES (GL account mappings)                  │     │
│  │ • DIVISION_REVENUE_ACCOUNT (mapping)                   │     │
│  │ • Utility functions                                    │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ External Integrations                                   │     │
│  │ • Bank of Ghana FX API (exchange_rates table)          │     │
│  │ • Resend Email (Module 2.2)                            │     │
│  │ • GRA Tax Tables (Phase 5)                             │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### 1. system_config Table
**Purpose**: Centralized configuration for business rules  
**Access**: Read by all roles; write restricted to admin

```sql
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-seeded values:
-- 'invoice_approval_threshold_ghs' → '100000'
-- 'default_currency' → 'GHS'
-- 'fx_source' → 'bank_of_ghana'
```

**Usage in Code**:
```javascript
// Fetch in React component
const { data } = await supabase
  .from('system_config')
  .select('value')
  .eq('key', 'invoice_approval_threshold_ghs')
  .single();

// Used in compute_invoice_taxes function (PostgreSQL)
SELECT value::numeric FROM system_config WHERE key = 'invoice_approval_threshold_ghs'
```

### 2. Clients Table (Extended)
**New Columns** (added in Migration 004):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `applies_vat` | BOOLEAN | TRUE | VAT applicability |
| `applies_nhil` | BOOLEAN | TRUE | NHIL applicability |
| `applies_getfund` | BOOLEAN | TRUE | GetFUND applicability |
| `applies_wht` | BOOLEAN | FALSE | WHT applicability |
| `wht_rate` | NUMERIC(5,4) | — | Computed from client_type |
| `auth_user_id` | UUID | NULL | Links to auth.users for client portal |

**WHT Rate Formula**:
```sql
CASE client_type
    WHEN 'individual' THEN 0.0500
    WHEN 'corporate' THEN 0.0750
    WHEN 'government' THEN 0.1500
    ELSE 0
END
```

**Migration Command**:
```sql
-- Run in supabase/migrations/004_invoice_engine.sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS applies_vat BOOLEAN DEFAULT TRUE;
-- ... (other columns)
```

### 3. exchange_rates Table
**Purpose**: Store FX rates for multi-currency invoicing

```sql
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code TEXT NOT NULL,              -- 'USD', 'GBP', 'EUR'
    rate_to_ghs NUMERIC(18, 6) NOT NULL,    -- e.g., 14.50
    rate_date DATE NOT NULL,
    source TEXT DEFAULT 'bank_of_ghana',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (currency_code, rate_date)
);

-- Initial seed (placeholder):
INSERT INTO exchange_rates (currency_code, rate_to_ghs, rate_date) VALUES
    ('USD', 14.50, CURRENT_DATE),
    ('GBP', 18.20, CURRENT_DATE),
    ('EUR', 15.80, CURRENT_DATE);
```

**Query Pattern in React**:
```javascript
const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
const { data } = await supabase
  .from('exchange_rates')
  .select('*')
  .eq('currency_code', 'USD')
  .eq('rate_date', today)
  .single();
```

### 4. Invoices Table (Rebuild)
**Complete Schema**:

```sql
CREATE TABLE invoices (
    -- Identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,      -- Format: ARC-2025-0001
    
    -- Relationships
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
    
    -- Currency & FX
    currency invoice_currency DEFAULT 'GHS',   -- Enum: GHS | USD | GBP | EUR
    fx_rate_to_ghs NUMERIC(18, 6) DEFAULT 1.0,
    fx_rate_date DATE,                         -- Date when rate was locked
    
    -- Amounts in invoice currency
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,
    vat_amount NUMERIC(18, 2) DEFAULT 0,
    nhil_amount NUMERIC(18, 2) DEFAULT 0,
    getfund_amount NUMERIC(18, 2) DEFAULT 0,
    gross_total NUMERIC(18, 2) DEFAULT 0,
    wht_amount NUMERIC(18, 2) DEFAULT 0,
    expected_receipt NUMERIC(18, 2) DEFAULT 0,
    
    -- GHS equivalents (frozen at fx_rate_date)
    subtotal_ghs NUMERIC(18, 2),
    vat_amount_ghs NUMERIC(18, 2),
    nhil_amount_ghs NUMERIC(18, 2),
    getfund_amount_ghs NUMERIC(18, 2),
    gross_total_ghs NUMERIC(18, 2),
    wht_amount_ghs NUMERIC(18, 2),
    expected_receipt_ghs NUMERIC(18, 2),
    
    -- Workflow
    status invoice_status DEFAULT 'draft',     -- Enum: see below
    approval_threshold_at_creation NUMERIC(18, 2),
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ,
    rejection_note TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    due_date DATE,
    payment_date DATE,
    payment_reference TEXT,
    notes TEXT
);

-- Enums
CREATE TYPE invoice_status AS ENUM (
    'draft',              -- Work in progress
    'pending_approval',   -- Awaiting CEO/Director approval (if above threshold)
    'approved',           -- Approved and ready to send
    'sent',              -- Sent to client
    'paid',              -- Payment received
    'rejected'           -- Rejected by approver
);

CREATE TYPE invoice_currency AS ENUM ('GHS', 'USD', 'GBP', 'EUR');
```

### 5. invoice_line_items Table
```sql
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1,
    unit_price NUMERIC(18, 2) NOT NULL,
    line_total NUMERIC(18, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Feature**: `line_total` is automatically computed and stored, ensuring consistency.

---

## Backend Components

### 1. compute_invoice_taxes() Function

**Location**: `supabase/migrations/004_invoice_engine.sql` (lines ~320–400)  
**Triggered By**: React component after line item changes or on invoice save  
**Execution**: Server-side (SECURITY DEFINER)

**Pseudocode**:
```
FUNCTION compute_invoice_taxes(invoice_uuid UUID):
  1. Fetch invoice record
  2. Fetch client tax profile
  3. Sum all line items → subtotal
  4. Apply client's tax flags:
     - if applies_vat: vat = subtotal × 0.15
     - if applies_nhil: nhil = subtotal × 0.025
     - if applies_getfund: getfund = subtotal × 0.025
  5. gross_total = subtotal + vat + nhil + getfund
  6. if applies_wht: wht = subtotal × client.wht_rate
  7. expected_receipt = gross_total - wht
  8. Fetch FX rate from invoice record
  9. Convert all amounts to GHS:
     - subtotal_ghs = subtotal × fx_rate
     - vat_amount_ghs = vat × fx_rate
     - ... etc
     - gross_total_ghs = gross × fx_rate
  10. Check approval threshold:
     - threshold = system_config['invoice_approval_threshold_ghs']
     - requires_approval = (gross_total_ghs >= threshold)
  11. UPDATE invoices SET all computed fields WHERE id = invoice_uuid
```

**Critical Points**:
- Runs with SECURITY DEFINER (executes as Supabase service account)
- All calculations are atomic (single UPDATE statement)
- GHS equivalents are locked — never recalculated
- Idempotent: can be called multiple times safely

**Call from React**:
```javascript
const { error } = await supabase.rpc('compute_invoice_taxes', {
  invoice_uuid: invoiceId
});
```

### 2. Invoice Auto-Number Trigger

**Location**: `supabase/migrations/004_invoice_engine.sql` (lines ~410–430)  
**Triggered**: BEFORE INSERT on invoices table  
**Condition**: When invoice_number is NULL

**Format Generated**: `ARC-YYYY-NNNN`
- ARC: Company prefix
- YYYY: Current year (e.g., 2025)
- NNNN: Zero-padded sequence (0001, 0002, ..., 9999)

**Example Sequence**:
```
Invoice 1 (created Jan 2025): ARC-2025-0001
Invoice 2 (created Jan 2025): ARC-2025-0002
Invoice 1 (created Jan 2026): ARC-2026-0001  ← Resets per year
```

**Implementation**:
```sql
CREATE SEQUENCE invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := 'ARC-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || 
                              LPAD(NEXTVAL('invoice_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL)
    EXECUTE FUNCTION generate_invoice_number();
```

### 3. Row Level Security Policies

**Tables Protected**: `invoices`, `invoice_line_items`  
**Enforcement Level**: Database (applied before data reaches application)

#### Policy: CEO & Accountant Full Access
```sql
CREATE POLICY "CEO and accountant full invoice access"
    ON invoices FOR ALL
    USING (auth.jwt() ->> 'role' IN ('ceo', 'accountant'))
    WITH CHECK (auth.jwt() ->> 'role' IN ('ceo', 'accountant'));
```
- Applies to: SELECT, INSERT, UPDATE, DELETE
- Condition: User's JWT role is 'ceo' or 'accountant'

#### Policy: Project Manager Project-Scoped Access
```sql
CREATE POLICY "PM views own project invoices"
    ON invoices FOR SELECT
    USING (
        auth.jwt() ->> 'role' = 'project_manager'
        AND project_id IN (
            SELECT project_id FROM project_assignments
            WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );
```
- Applies to: SELECT only
- Condition: PM is assigned to the project via project_assignments table

#### Policy: Client Own-Invoice Access
```sql
CREATE POLICY "Client views own invoices"
    ON invoices FOR SELECT
    USING (
        auth.jwt() ->> 'role' = 'client'
        AND client_id = (
            SELECT client_id FROM profiles WHERE user_id = auth.uid()
        )
    );
```
- Applies to: SELECT only
- Condition: User's profile.client_id matches invoice.client_id

---

## Frontend Components

### InvoiceForm.jsx Component

**Location**: `src/components/InvoiceForm.jsx`  
**Size**: ~650 lines  
**Dependencies**:
- React (hooks: useState, useEffect, useCallback)
- Supabase client
- Tailwind CSS
- Tax constants module

**State Management**:
```javascript
const [formData, setFormData] = useState({
  client_id: '',
  project_id: '',
  division: '',
  currency: 'GHS',
  fx_rate_to_ghs: 1.0,
  fx_rate_override: false,
  notes: '',
});

const [lineItems, setLineItems] = useState([
  { id: null, description: '', quantity: 1, unit_price: 0 }
]);

const [taxes, setTaxes] = useState({
  subtotal: 0,
  vat: 0,
  nhil: 0,
  getfund: 0,
  gross_total: 0,
  wht: 0,
  expected_receipt: 0,
  gross_total_ghs: 0,
  expected_receipt_ghs: 0,
});

const [requiresApproval, setRequiresApproval] = useState(false);
```

### Component Lifecycle

**1. Mount** (useEffect with no dependencies)
```
→ Fetch system_config (approval threshold)
→ Fetch all clients
```

**2. Client Selection Changes** (useEffect [formData.client_id])
```
→ Fetch active projects for selected client
→ Fetch client tax profile (applies_vat, applies_nhil, applies_getfund, applies_wht)
```

**3. Project Selection Changes** (useEffect [formData.project_id])
```
→ Auto-fill division from project.divisions.name
```

**4. Currency Selection Changes** (useEffect [formData.currency])
```
→ If GHS: set fx_rate_to_ghs = 1.0
→ If foreign: fetch today's rate from exchange_rates table
→ If override flag set: keep user's manual rate
```

**5. Line Items or FX Rate Changes** (useEffect [lineItems, formData.fx_rate_to_ghs, clientTaxProfile])
```
→ Call computeTaxes()
→ Compute subtotal = sum of (quantity × unit_price) for all items
→ Apply client's tax profile:
   - if applies_vat: vat = subtotal × 0.15
   - if applies_nhil: nhil = subtotal × 0.025
   - if applies_getfund: getfund = subtotal × 0.025
   - if applies_wht: wht = subtotal × client.wht_rate
→ Compute gross, expected_receipt
→ Convert to GHS equivalents
→ Check if gross_total_ghs >= approvalThreshold
→ Update setTaxes() and setRequiresApproval()
```

### UI Structure

```
┌──────────────────────────────────────────────────────┐
│ INVOICE FORM                                          │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────────────┐  ┌─────────────────┐   │
│  │ LEFT (2/3 width)         │  │ RIGHT (1/3 width)   │
│  │                          │  │ TAX BREAKDOWN   │   │
│  │ • Client Select (dd)     │  │ (sticky)        │   │
│  │ • Project Select (dd)    │  │                 │   │
│  │ • Division (text, RO)    │  │ Subtotal  $5000 │   │
│  │ • Currency (dd)          │  │ VAT (15%) $750  │   │
│  │ • FX Rate (num)          │  │ NHIL (2.5%)$125 │   │
│  │                          │  │ GetFUND   $125  │   │
│  │ ─── Line Items ───       │  │ ────────────    │   │
│  │ [Desc] [Qty] [Price] [$] │  │ Gross     $6125 │   │
│  │ [Desc] [Qty] [Price] [$] │  │                 │   │
│  │ [Desc] [Qty] [Price] [$] │  │ WHT (7.5%)$412  │   │
│  │ [+ Add Item]             │  │ ────────────    │   │
│  │                          │  │ Receipt   $5713 │   │
│  │ [Notes textarea]         │  │                 │   │
│  │                          │  │ GHS Equiv       │   │
│  │ [Save Draft] [Submit]    │  │ Gross:   ₵88,812    │
│  │                          │  │                 │   │
│  └──────────────────────────┘  └─────────────────┘   │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Key Features

1. **Real-Time Tax Display**
   - Updates on every keystroke in line items
   - No save required to see tax amounts
   - Shows only applicable taxes (hidden if client doesn't apply them)

2. **Currency Conversion**
   - Fetches rate from exchange_rates table if currency changed
   - Allows accountant to override rate with a note
   - Displays both invoice currency and GHS equivalents

3. **Approval Threshold Detection**
   - Banner displays if gross_total_ghs >= threshold
   - Warning text: "This invoice exceeds GHS 100,000 and will require director approval..."
   - Color: amber/warning

4. **Line Items Management**
   - Add button: Creates new row with defaults
   - Delete (✕): Removes row (last row can't be deleted)
   - Description: Free text
   - Quantity: Numeric with decimal
   - Unit Price: Numeric with decimal
   - Line Total: Read-only, auto-calculated

5. **Save Workflow**
   - **Save as Draft**: Saves immediately, status = 'draft'
   - **Submit for Approval**: 
     - Validates client and at least 1 line item
     - Sets status = 'pending_approval' if requires_approval=true
     - Sets status = 'approved' if requires_approval=false
     - Calls compute_invoice_taxes() on save

### Form Submission Flow

```
User clicks "Submit for Approval"
  ↓
Validate: Client selected? Line items exist?
  ↓
Prepare invoice data (client_id, project_id, division, currency, etc.)
  ↓
Set all tax amounts from computeTaxes()
  ↓
INSERT into invoices table
  ├→ Auto-trigger: generate_invoice_number() (ARC-2025-0001)
  ├→ Auto-trigger: set created_by to current user
  ├→ Auto-trigger: set created_at to NOW()
  ↓
DELETE old line items (if editing)
  ↓
INSERT new line items
  ↓
CALL compute_invoice_taxes() RPC function
  ├→ Sums line items
  ├→ Applies tax profile
  ├→ Calculates GHS equivalents
  ├→ Checks approval threshold
  ├→ Updates invoice atomically
  ↓
Success: Show alert or redirect

```

---

## API & Integration Points

### Supabase Queries Used

#### 1. Fetch Clients
```javascript
const { data } = await supabase
  .from('clients')
  .select('*')
  .order('name');
```

#### 2. Fetch Projects (filtered by client)
```javascript
const { data } = await supabase
  .from('projects')
  .select(`*, divisions(name)`)
  .eq('client_id', clientId)
  .eq('status', 'active')
  .order('name');
```

#### 3. Fetch Client Tax Profile
```javascript
const { data } = await supabase
  .from('clients')
  .select('client_type, applies_vat, applies_nhil, applies_getfund, applies_wht, wht_rate')
  .eq('id', clientId)
  .single();
```

#### 4. Fetch Exchange Rate
```javascript
const today = new Date().toISOString().split('T')[0];
const { data } = await supabase
  .from('exchange_rates')
  .select('*')
  .eq('currency_code', 'USD')
  .eq('rate_date', today)
  .single();
```

#### 5. Fetch System Config
```javascript
const { data } = await supabase
  .from('system_config')
  .select('value')
  .eq('key', 'invoice_approval_threshold_ghs')
  .single();
```

#### 6. Insert Invoice
```javascript
const { data: invoice } = await supabase
  .from('invoices')
  .insert([invoiceData])
  .select('id')
  .single();
```

#### 7. Insert Line Items
```javascript
const { error } = await supabase
  .from('invoice_line_items')
  .insert(lineItemsData);
```

#### 8. Call compute_invoice_taxes RPC
```javascript
const { error } = await supabase.rpc('compute_invoice_taxes', {
  invoice_uuid: invoiceId
});
```

---

## Tax Computation Logic

### Complete Tax Computation Formula

**Given**:
- Client tax profile: applies_vat, applies_nhil, applies_getfund, applies_wht, wht_rate
- Line items: quantity, unit_price for each
- FX rate: fx_rate_to_ghs (locked at invoice creation)

**Calculation Steps**:

```
1. SUBTOTAL (in invoice currency)
   subtotal = SUM(quantity × unit_price) for all line items

2. VAT AMOUNT
   IF client.applies_vat THEN
     vat = subtotal × 0.15
   ELSE
     vat = 0

3. NHIL AMOUNT
   IF client.applies_nhil THEN
     nhil = subtotal × 0.025
   ELSE
     nhil = 0

4. GETFUND AMOUNT
   IF client.applies_getfund THEN
     getfund = subtotal × 0.025
   ELSE
     getfund = 0

5. GROSS TOTAL (before WHT deduction)
   gross_total = subtotal + vat + nhil + getfund

6. WHT AMOUNT
   IF client.applies_wht THEN
     wht = subtotal × client.wht_rate
   ELSE
     wht = 0

7. EXPECTED RECEIPT (net of WHT)
   expected_receipt = gross_total - wht

8. GHS EQUIVALENTS (all amounts locked at fx_rate)
   fx = invoice.fx_rate_to_ghs (e.g., 14.50)
   subtotal_ghs = subtotal × fx
   vat_amount_ghs = vat × fx
   nhil_amount_ghs = nhil × fx
   getfund_amount_ghs = getfund × fx
   gross_total_ghs = gross_total × fx
   wht_amount_ghs = wht × fx
   expected_receipt_ghs = expected_receipt × fx

9. APPROVAL THRESHOLD CHECK
   threshold = system_config['invoice_approval_threshold_ghs']
   IF gross_total_ghs >= threshold THEN
     requires_approval = TRUE
   ELSE
     requires_approval = FALSE
```

### Example: Corporate Client, USD Invoice

```
CLIENT PROFILE:
- client_type: 'corporate'
- applies_vat: TRUE
- applies_nhil: TRUE
- applies_getfund: TRUE
- applies_wht: TRUE
- wht_rate: 0.075 (7.5%)

INVOICE:
- currency: USD
- fx_rate_to_ghs: 14.50

LINE ITEMS:
  Design fees         1 × $5,000 = $5,000
  Revisions          2 × $500 = $1,000
  ────────────────────────────
  Subtotal:                    $6,000

TAX CALCULATIONS:
  VAT (15%):        $6,000 × 0.15 = $900
  NHIL (2.5%):      $6,000 × 0.025 = $150
  GetFUND (2.5%):   $6,000 × 0.025 = $150
  ──────────────────────────────────
  Gross Total:                 $7,200
  
  WHT (7.5%):       $6,000 × 0.075 = $450
  ──────────────────────────────────
  Expected Receipt:            $6,750

GHS EQUIVALENTS (at 14.50 rate):
  Subtotal GHS:     $6,000 × 14.50 = ₵87,000
  VAT GHS:          $900 × 14.50 = ₵13,050
  NHIL GHS:         $150 × 14.50 = ₵2,175
  GetFUND GHS:      $150 × 14.50 = ₵2,175
  ──────────────────────────────────
  Gross GHS:        $7,200 × 14.50 = ₵104,400 ← EXCEEDS ₵100,000
  
  WHT GHS:          $450 × 14.50 = ₵6,525
  ──────────────────────────────────
  Expected Receipt: $6,750 × 14.50 = ₵97,875

APPROVAL STATUS:
  requires_approval = TRUE (because gross_total_ghs ₵104,400 >= threshold ₵100,000)
  approval_threshold_at_creation = 100000
```

---

## Testing & Verification

### Database Testing Checklist

- [ ] Migration 004 applies without errors
  ```sql
  SELECT * FROM system_config WHERE key = 'invoice_approval_threshold_ghs';
  -- Should return: value = '100000'
  ```

- [ ] system_config table seeded
  ```sql
  SELECT * FROM system_config ORDER BY key;
  -- Should return 3 rows
  ```

- [ ] Clients table extended
  ```sql
  \d clients
  -- Should show: applies_vat, applies_nhil, applies_getfund, applies_wht, wht_rate columns
  ```

- [ ] exchange_rates table created and seeded
  ```sql
  SELECT * FROM exchange_rates WHERE rate_date = CURRENT_DATE;
  -- Should return USD, GBP, EUR rows
  ```

- [ ] Invoices enums created
  ```sql
  SELECT * FROM pg_type WHERE typname IN ('invoice_status', 'invoice_currency');
  -- Should return 2 rows
  ```

- [ ] invoices table created with all fields
  ```sql
  \d invoices
  -- Should show 45+ columns including fx_rate_to_ghs, gross_total_ghs, requires_approval, etc.
  ```

- [ ] invoice_line_items table created
  ```sql
  SELECT * FROM information_schema.columns WHERE table_name = 'invoice_line_items';
  -- Should show: id, invoice_id, description, quantity, unit_price, line_total, created_at
  ```

- [ ] Auto-numbering works
  ```sql
  INSERT INTO invoices (client_id, division, created_by)
  VALUES ('...', 'Construction', auth.uid());
  -- Should auto-generate invoice_number like 'ARC-2025-0001'
  ```

- [ ] compute_invoice_taxes function exists
  ```sql
  SELECT routine_name FROM information_schema.routines
  WHERE routine_name = 'compute_invoice_taxes';
  -- Should return 1 row
  ```

- [ ] RLS policies enabled
  ```sql
  SELECT schemaname, tablename FROM pg_policies
  WHERE tablename IN ('invoices', 'invoice_line_items');
  -- Should return 6 rows (3 per table)
  ```

### React Component Testing Checklist

- [ ] Component renders without errors
- [ ] Client dropdown populates from Supabase
- [ ] Project dropdown filters by selected client
- [ ] Division auto-fills when project selected
- [ ] Currency selector works (GHS, USD, GBP, EUR)
- [ ] FX rate fetches when non-GHS currency selected
- [ ] FX rate can be overridden manually
- [ ] Line items can be added and removed
- [ ] Line total auto-calculates (quantity × unit_price)
- [ ] Tax breakdown updates in real-time
- [ ] All applicable taxes display (VAT, NHIL, GetFUND, WHT)
- [ ] Approval threshold banner displays when gross_total_ghs >= 100000
- [ ] "Save as Draft" button saves invoice with status='draft'
- [ ] "Submit for Approval" button saves with correct status
- [ ] Form validation: requires client and at least 1 line item
- [ ] Error messages display on failed operations
- [ ] Loading states show during API calls

### Manual Integration Testing

**Scenario 1**: Create draft invoice (GHS currency, individual client)
```
1. Select client (Type: Individual, applies_wht=TRUE)
2. Select project → Division auto-fills
3. Keep currency as GHS (fx_rate = 1.0)
4. Add line item: Description="Consulting", Qty=1, Price=50000
5. Verify taxes:
   - Subtotal: ₵50,000
   - VAT (15%): ₵7,500
   - NHIL (2.5%): ₵1,250
   - GetFUND (2.5%): ₵1,250
   - Gross: ₵60,000
   - WHT (5%): ₵2,500 (applied because individual)
   - Expected Receipt: ₵57,500
6. Click "Save as Draft"
7. Verify invoice created with status='draft'
8. Verify invoice_number generated (ARC-2025-0001 or similar)
```

**Scenario 2**: Create invoice above approval threshold (USD currency, corporate)
```
1. Select client (Type: Corporate, applies_wht=TRUE)
2. Select project
3. Change currency to USD
4. Verify FX rate fetches (should show ~14.50)
5. Add line item: Description="Design Services", Qty=1, Price=8000
6. Verify taxes (in USD):
   - Subtotal: $8,000
   - VAT: $1,200
   - NHIL: $200
   - GetFUND: $200
   - Gross: $9,600
   - WHT (7.5%): $600
   - Expected Receipt: $9,000
7. Verify GHS equivalents:
   - Gross GHS: $9,600 × 14.50 = ₵139,200 ← EXCEEDS ₵100,000
8. Verify approval banner displays
9. Click "Submit for Approval"
10. Verify invoice created with status='pending_approval' (not 'approved')
```

**Scenario 3**: Government client (no WHT applied)
```
1. Create client with client_type='government', applies_wht=FALSE
2. Create invoice with GHS amount of ₵50,000
3. Verify WHT amount = 0
4. Verify Expected Receipt = Gross Total (no WHT deduction)
5. Submit for approval
```

---

## Deployment & Activation

### Step 1: Apply Migration to Supabase
```bash
# Option A: Via Supabase Dashboard
# 1. Go to SQL Editor in Supabase console
# 2. Copy entire supabase/migrations/004_invoice_engine.sql
# 3. Paste into SQL editor
# 4. Click "Run"

# Option B: Via CLI (if available)
supabase db push  # Applies all pending migrations
```

### Step 2: Verify Migration Success
```sql
-- In Supabase SQL editor, run:
SELECT * FROM system_config;
SELECT COUNT(*) FROM exchange_rates WHERE rate_date = CURRENT_DATE;
SELECT invoice_number FROM invoices LIMIT 1;
```

### Step 3: Deploy React Component
```bash
# 1. Ensure InvoiceForm.jsx is in src/components/
# 2. Import in Accountant portal:
import InvoiceForm from '../components/InvoiceForm';

# 3. Add route in App.jsx if needed
# 4. Run dev server to test
npm run dev

# 5. Build and deploy
npm run build
# Deploy to Vercel, Netlify, or your hosting provider
```

### Step 4: Activate in Accountant Portal
Edit `src/pages/portals/AccountantPortal.jsx`:
```javascript
import InvoiceForm from '../../components/InvoiceForm';

export default function AccountantPortal() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleInvoiceSave = (invoiceId, status) => {
    // Navigate to invoice list or detail page
    navigate(`/accountant/invoices/${invoiceId}`);
  };

  return (
    <div>
      <h1>Accountant Portal</h1>
      <InvoiceForm onSave={handleInvoiceSave} />
      {/* Other accountant features... */}
    </div>
  );
}
```

### Step 5: Test in Staging Environment
1. Create test client (corporate)
2. Create test project
3. Use form to create invoice above threshold
4. Verify approval banner displays
5. Submit and verify status = 'pending_approval'
6. Verify database records created correctly

---

## Files Deliverable Summary

| File | Location | Purpose | Status |
|------|----------|---------|--------|
| Migration 004 | `supabase/migrations/004_invoice_engine.sql` | Database schema, functions, policies | ✅ Complete |
| Tax Constants | `supabase/functions/_shared/tax-constants.ts` | Shared tax rates and account codes | ✅ Complete |
| Invoice Form | `src/components/InvoiceForm.jsx` | React invoice creation component | ✅ Complete |
| Development Plan | `arcbuild_pro_development_plan.md` | Project roadmap (updated) | ✅ Complete |

---

## Next Steps: Module 2.2 Prerequisites

Before starting Module 2.2 (Invoice Approval Workflow), ensure:

1. ✅ Migration 004 successfully applied to Supabase
2. ✅ InvoiceForm component integrated into Accountant portal
3. ✅ Manual testing completed (all 3 scenarios above)
4. ✅ system_config values verified in database
5. ✅ All RLS policies working (test with different roles)

**Module 2.2 Will Add**:
- CEO/Director approval interface
- Bulk approval actions
- Email notifications (Resend integration)
- Invoice PDF generation
- Status state machine enforcement
- Payment tracking

---

**End of Technical Implementation Guide**

For questions or clarifications, refer to:
- Tax Computation Logic (Section: Tax Computation Logic)
- API Integration Points (Section: API & Integration Points)
- Testing Procedures (Section: Testing & Verification)
