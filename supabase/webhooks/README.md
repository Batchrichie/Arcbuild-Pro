# Supabase Webhooks for ARCBUILD PRO

## invoice-cascade webhook
This webhook is used to trigger the `invoice-cascade` Edge Function when an invoice transitions to `approved`.

### Configuration
- Table: `invoices`
- Event: `UPDATE`
- Condition: `status = 'approved'`
- Target: `invoice-cascade` Edge Function URL
- Method: `POST`

### Purpose
When an invoice becomes `approved`, the Edge Function:
1. calls `post_invoice_journal()` to post the invoice journal to the ledger
2. calls `transition_invoice_status(..., 'sent', SYSTEM_ACTOR_ID)`
3. stubs PDF generation + email dispatch for Phase 5

### Required secrets
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SYSTEM_ACTOR_ID`

### Notes
- The Edge Function must use the Supabase service role key so it can bypass RLS and act as the system service account.
- The `SYSTEM_ACTOR_ID` value is currently `00000000-0000-0000-0000-000000000001`.
