# MODULE 2.1 — CRITICAL ISSUES IDENTIFIED

**Date**: May 16, 2026  
**Status**: ⚠️ THREE CRITICAL ISSUES REQUIRING FIX  
**Impact**: System architecture, journal cascade (Module 2.3), authentication

---

## ISSUE #1 — Schema Inconsistency: division_id vs division TEXT ⚠️ CRITICAL

### Problem Description

**In Migration 001 (projects table)**:
```sql
CREATE TABLE projects (
    ...
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
    ...
);
```
✅ Projects store division as a **FK to divisions table** (division_id → UUID)

**In Migration 004 (invoices table)**:
```sql
CREATE TABLE invoices (
    ...
    division TEXT NOT NULL,
    ...
);
```
❌ Invoices store division as **plain TEXT field**

### Why This Is a Problem

1. **Journal Cascade (Module 2.3)**: When an approved invoice is posted to the general ledger, the cascade function needs to post the revenue to the correct account:
   - Construction → Account 4100
   - Architecture → Account 4200
   - Real Estate → Account 4300
   - Logistics → Account 4400

   The mapping uses division NAME as input (e.g., "Construction"). 
   
   If invoices.division is TEXT but projects.division is a UUID FK, the journal cascade must:
   - Either join invoice → project → divisions to resolve the FK to name
   - Or accept that invoices.division should mirror projects.division_id with a FK instead of text

2. **Redundancy**: Storing division name in two places (projects and invoices) violates normalization if they can diverge.

3. **Invoice Editing**: If a project's division changes, old invoices won't reflect it. Should they?

### Fix Required

**Option A** (Recommended): Make invoices.division consistent with projects by using division_id FK:
```sql
-- In Migration 004, replace:
division TEXT NOT NULL,

-- With:
division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
```

Then update the React component and journal cascade to:
- Fetch division name via JOIN when displaying
- Use division_id in journal posting

**Option B**: Store division as TEXT but document it as a denormalized field for performance:
- Accept that it's a snapshot of project.divisions.name at invoice creation
- Journal cascade logic resolves through the project if available

### Recommended Action

**Use Option A** (FK consistency):
- Change invoices.division from TEXT to UUID FK
- Update InvoiceForm to still display division NAME (fetch via projects/divisions JOIN)
- Update RLS policies to work with division_id
- Update Module 2.3 journal cascade to use division_id directly

---

## ISSUE #2 — compute_invoice_taxes() Called Before Invoice Exists ⚠️ CRITICAL

### Problem Description

**Current Implementation** (InvoiceForm.jsx):
1. User opens form → loads clients, projects
2. User selects client, project → division auto-filled
3. User adds line items
4. On each line item change → `computeTaxes()` computes taxes in React state
5. User clicks "Submit for Approval" → INSERT invoice, then call `supabase.rpc('compute_invoice_taxes', { invoice_uuid: invoiceId })`

**Issue**: The `computeTaxes()` function in React is a **JavaScript implementation**, not a call to the PostgreSQL function. It's correct for UI display.

**However, per the design spec**, the instruction states:
> "On every line item change: call compute_invoice_taxes(invoice_id) and refresh the tax breakdown display"

This **implies** calling the PostgreSQL function on every keystroke. If taken literally, it would fail because:
- No invoice record exists until the user clicks "Submit"
- `compute_invoice_taxes(invoice_uuid)` needs a real UUID to operate on
- Calling it with a non-existent UUID will fail

### Actual Current State

Looking at InvoiceForm.jsx, the component uses a **local React function**:
```javascript
const computeTaxes = useCallback(() => {
    // ... JavaScript computation using state, NOT the PostgreSQL function
    setTaxes({...});
}, [clientTaxProfile, lineItems, formData.fx_rate_to_ghs, approvalThreshold]);
```

This is called on every line item change. Then on save:
```javascript
// Call compute_invoice_taxes RPC function
const { error: err } = await supabase.rpc('compute_invoice_taxes', {
  invoice_uuid: invoiceId,
});
```

### The Problem with This Design

1. **Duplicate Logic**: Tax computation logic exists in TWO places:
   - React component (for real-time UI display)
   - PostgreSQL function (for authoritative database update)
   
   If they diverge, results will be inconsistent.

2. **Trust Issue**: What if a user modifies the invoice after save? The UI might show taxes computed one way, but the database has them computed another way.

3. **Module 2.3 Reliance**: The journal cascade will read taxes from the invoices table (which are computed by `compute_invoice_taxes`). If the logic differs from what the user saw in the form, audit issues arise.

### Fix Required

Choose ONE approach:

**Option A** (Current Approach — Preferred):
- Keep React `computeTaxes()` local for UI display
- On save, call PostgreSQL `compute_invoice_taxes()` to store authoritative values
- **ACCEPT** that the two sources of truth may differ slightly (rounding, timing)
- **DOCUMENT** that the database version is authoritative

**Option B** (Alternative):
- Auto-create a draft invoice record immediately on form open
- Call PostgreSQL `compute_invoice_taxes()` on every line item change (via RPC)
- Render displayed taxes by fetching from database, not local state
- More network calls, but single source of truth

### Recommended Action

**Keep Option A** (current approach) but document it clearly:
1. React component computes taxes locally for UI preview
2. On save, PostgreSQL function recomputes and stores authoritative values
3. Module 2.3 journal cascade reads from database (authoritative source)
4. Add comment in code: "React taxes are preview; database is authoritative"

**No code change needed** if this is accepted. But **MUST be documented** for Module 2.3.

---

## ISSUE #3 — RLS Policies Cannot Read JWT Role (Auth Hook Missing) ⚠️ CRITICAL

### Problem Description

**Current RLS Policy** (Migration 004):
```sql
CREATE POLICY "CEO and accountant full invoice access"
    ON invoices FOR ALL
    USING (auth.jwt() ->> 'role' IN ('ceo', 'accountant'))
    WITH CHECK (auth.jwt() ->> 'role' IN ('ceo', 'accountant'));
```

**Issue**: This policy tries to read `auth.jwt() ->> 'role'`, which requires the role to be stored in Supabase Auth's JWT custom claims.

### Current Auth Implementation (Migration 003)

The auth trigger **does NOT** set JWT custom claims:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _role TEXT;
    ...
BEGIN
    _role := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''), 'employee');
    
    -- Role is validated and inserted into profiles table
    INSERT INTO public.profiles (user_id, role, full_name)
    VALUES (NEW.id, _role, _full_name);
    
    RETURN NEW;  -- ← No JWT claim update here!
END;
```

The role is stored in `profiles.role`, NOT in the JWT token.

### What Happens When RLS Policy Executes

1. User logs in
2. Supabase generates JWT token for user
3. User queries `SELECT * FROM invoices`
4. PostgreSQL evaluates RLS policy
5. Policy checks `auth.jwt() ->> 'role'`
6. JWT does NOT contain 'role' field → returns NULL
7. Comparison `NULL IN ('ceo', 'accountant')` → FALSE
8. Access DENIED (silently) — even for CEO/accountant!

### Result

✅ **Query returns zero rows** (no error, just silently denied)  
❌ **CEO cannot see invoices** (policy blocks them)  
❌ **Accountant cannot see invoices** (policy blocks them)  
❌ **System appears broken** after deployment

### Fix Required

**Option A** (Recommended): Create Supabase Auth hook to set JWT custom claims on login

Supabase provides `https://supabase.com/docs/guides/auth/managing-user-data#auth-claims` 

Add a PostgreSQL function to inject role into JWT:
```sql
-- New migration file (e.g., 005_auth_hooks.sql)
CREATE OR REPLACE FUNCTION public.get_user_role_jwt_claim()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('role', p.role)
  FROM profiles p
  WHERE p.user_id = auth.uid()
$$;
```

Then configure Supabase Auth to call this function and inject the result into JWT.

**Option B**: Update RLS policies to read role from profiles table

```sql
-- Updated policy (reads from profiles, not JWT)
CREATE POLICY "CEO and accountant full invoice access"
    ON invoices FOR ALL
    USING (
        (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant')
    )
    WITH CHECK (
        (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('ceo', 'accountant')
    );
```

**Pros**: No Auth hook needed, works immediately  
**Cons**: Extra subquery on every access (minor performance hit)

**Option C**: Use row-based role checks via a helper function

```sql
CREATE OR REPLACE FUNCTION public.user_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = required_role FROM profiles WHERE user_id = auth.uid()
$$;

CREATE POLICY "CEO and accountant full access"
    ON invoices FOR ALL
    USING (user_has_role('ceo') OR user_has_role('accountant'))
    WITH CHECK (user_has_role('ceo') OR user_has_role('accountant'));
```

### Recommended Action

**Use Option B** (profiles table subquery):
1. Update all RLS policies to read role from `profiles` table instead of JWT
2. Works immediately without additional Auth configuration
3. Slight performance impact but acceptable (profiles table is small and indexed)
4. Can migrate to Option A later if performance becomes an issue

**Files to Update**:
- Migration 004 (all RLS policies)
- MODULE_2_1_TECHNICAL_GUIDE.md (document the change)

---

## Summary Table

| Issue | Severity | Root Cause | Recommended Fix | Effort |
|-------|----------|-----------|-----------------|--------|
| #1: division_id vs TEXT | CRITICAL | Schema inconsistency | Change invoices.division to UUID FK | Medium |
| #2: compute_taxes() timing | MEDIUM | Design ambiguity | Document local vs. authoritative | Low |
| #3: RLS JWT claims | CRITICAL | Auth hook not implemented | Use profiles table subquery in RLS | Medium |

---

## Action Items Before Module 2.2

- [ ] **Issue #1**: Decide: FK division or denormalized text?
  - If FK: Update Migration 004 + InvoiceForm + RLS
  - If text: Document denormalization + update journal cascade
  
- [ ] **Issue #2**: Document that React taxes are preview; DB is authoritative

- [ ] **Issue #3**: Update all RLS policies to read role from profiles table (Option B)
  - Regenerate Migration 004 with corrected policies
  - Test with different user roles

- [ ] **Retest Everything**:
  - CEO login → can see all invoices
  - Accountant login → can see all invoices
  - PM login → can see only assigned projects
  - Client login → can see only own invoices

---

## Recommended Next Steps

1. **Prioritize Issue #3** (RLS) → Fix immediately before any testing
   - This blocks the entire system
   - Quick fix (update policies)

2. **Prioritize Issue #1** (division FK vs TEXT) → Decide before Module 2.2
   - Affects journal cascade design
   - Requires migration decision

3. **Document Issue #2** (compute_taxes duality) → For Module 2.3
   - Not blocking
   - Must be clear for journal cascade developers

---

**Status**: BLOCKED ON FIXES  
**Ready for Module 2.2**: NO  
**Estimated Fix Time**: 2–4 hours (including retesting)
