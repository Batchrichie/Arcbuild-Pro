import { readFile } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

async function loadEnv() {
  const envText = await readFile('.env', 'utf8')
  return Object.fromEntries(
    envText
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=', 2))
  )
}

const env = await loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  realtime: {
    transport: ws,
  },
})

const { data: invoiceRows, error: invoiceError } = await supabase
  .from('invoices')
  .select('id,invoice_number,client_id,project_id,division_id,currency,status,balance_due,amount_paid,expected_receipt_ghs')
  .in('status', ['sent', 'partially_paid'])
  .gt('balance_due', 0)
  .limit(1)

if (invoiceError) {
  console.error('Invoice query failed:', invoiceError)
  process.exit(1)
}
if (!invoiceRows || invoiceRows.length === 0) {
  console.error('No suitable invoice found to test.')
  process.exit(1)
}
const invoice = invoiceRows[0]
console.log('Found invoice:', invoice.invoice_number, invoice.id)

const { data: accountRows, error: accountError } = await supabase
  .from('chart_of_accounts')
  .select('account_code,account_name')
  .eq('account_type', 'asset')
  .eq('is_active', true)
  .eq('status', 'Active')
  .limit(1)

if (accountError) {
  console.error('Account query failed:', accountError)
  process.exit(1)
}
if (!accountRows || accountRows.length === 0) {
  console.error('No payment account found to test.')
  process.exit(1)
}
const account = accountRows[0]
console.log('Using account:', account.account_code, account.account_name)

const paymentReference = `TEST-PAYMENT-${Date.now()}`
const payload = {
  entry_date: new Date().toISOString().split('T')[0],
  description: `Payment received — ${paymentReference}`,
  reference: paymentReference,
  source_type: 'payment',
  source_id: invoice.id,
  created_by: invoice.client_id,
  posted_by: invoice.client_id,
}

const { data: inserted, error: insertError } = await supabase
  .from('journal_entries')
  .insert(payload)
  .select('id,status')
  .single()

if (insertError) {
  console.error('Insert error:', insertError)
  process.exit(1)
}
console.log('Inserted journal entry:', inserted)

const { data: fetched, error: fetchError } = await supabase
  .from('journal_entries')
  .select('id,status')
  .eq('id', inserted.id)
  .single()

if (fetchError) {
  console.error('Fetch error:', fetchError)
  process.exit(1)
}
console.log('Fetched journal entry status:', fetched.status)
