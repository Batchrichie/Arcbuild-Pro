import { readFile } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const envText = await readFile('.env', 'utf8')
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => line.split('=', 2)))
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } })

const { data: invoiceRows, error } = await supabase
  .from('invoices')
  .select('id,invoice_number,status,balance_due,amount_paid,expected_receipt_ghs')
  .order('created_at', { ascending: false })
  .limit(20)

if (error) {
  console.error('Query failed:', error)
  process.exit(1)
}
console.log('Invoices sample:')
console.dir(invoiceRows, { depth: null })
