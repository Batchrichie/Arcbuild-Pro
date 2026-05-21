-- Migration 035: Invoice Payments Table and Invoice Payment Tracking
-- Date: 19 May 2026

-- Step 1: Add partially_paid to invoice_status enum
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'partially_paid' AFTER 'sent';

-- Step 2: Add payment tracking columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_paid              NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due              NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS last_payment_date        DATE,
  ADD COLUMN IF NOT EXISTS last_payment_reference   TEXT;

-- Step 3: Create invoice_payments table
CREATE TABLE IF NOT EXISTS invoice_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  payment_date          DATE NOT NULL,
  payment_reference     TEXT NOT NULL,
  payment_account_code  TEXT NOT NULL,
  payment_account_name  TEXT,
  amount_ghs            NUMERIC(18,2) NOT NULL,
  journal_entry_id      UUID REFERENCES journal_entries(id),
  recorded_by           UUID REFERENCES profiles(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_client  ON invoice_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date    ON invoice_payments(payment_date);

-- Step 4: RLS
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- Ensure idempotent policy creation: drop if exists then create
DROP POLICY IF EXISTS payments_accountant_ceo ON invoice_payments;

CREATE POLICY payments_accountant_ceo ON invoice_payments
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('CEO', 'Accountant')
    )
  );

-- Step 5: Set balance_due for existing invoices
UPDATE invoices
SET balance_due = COALESCE(expected_receipt_ghs, 0) - COALESCE(amount_paid, 0)
WHERE balance_due IS NULL;
