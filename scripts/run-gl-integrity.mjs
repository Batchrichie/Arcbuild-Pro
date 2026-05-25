/**
 * Run GL backfill + integrity report + optional 6202 correction.
 * Requires: SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env or environment.
 *
 * Usage: node scripts/run-gl-integrity.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const path = resolve(root, '.env')
  if (!existsSync(path)) return {}
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

async function main() {
  const { data: actor, error: actorErr } = await supabase
    .from('profiles')
    .select('user_id, id, role, full_name')
    .in('role', ['accountant', 'ceo', 'system'])
    .limit(1)
    .single()

  if (actorErr || !actor?.user_id) {
    console.error('Could not resolve acting user:', actorErr?.message)
    process.exit(1)
  }

  console.log('Acting user:', actor.full_name, actor.role, actor.user_id)

  console.log('\n--- backfill_missing_invoice_journals ---')
  const { data: backfill, error: bfErr } = await supabase.rpc('backfill_missing_invoice_journals', {
    acting_user_id: actor.user_id,
  })
  if (bfErr) {
    console.error('Backfill RPC error:', bfErr.message)
    if (bfErr.message.includes('does not exist')) {
      console.error('Apply migration 047_gl_integrity_invoice_posting.sql in Supabase SQL Editor first.')
    }
  } else {
    console.log(JSON.stringify(backfill, null, 2))
  }

  const { data: revLines } = await supabase
    .from('ledger_entries')
    .select('account_code, account_name, credit_amount, description, journal_entry_id')
    .gt('credit_amount', 0)

  const { data: jeInvoices } = await supabase
    .from('journal_entries')
    .select('id, reference, source_type')
    .eq('source_type', 'invoice')

  const invoiceJournalIds = new Set((jeInvoices || []).map((j) => j.id))
  const invoiceRevenue = (revLines || []).filter(
    (r) => invoiceJournalIds.has(r.journal_entry_id) && String(r.account_code).startsWith('4')
  )

  console.log('\n--- post_invoice_journal revenue credits (by account_code) ---')
  if (invoiceRevenue.length) {
    const byCode = {}
    for (const r of invoiceRevenue) {
      byCode[r.account_code] = byCode[r.account_code] || { name: r.account_name, total: 0, refs: [] }
      byCode[r.account_code].total += Number(r.credit_amount || 0)
      const je = jeInvoices.find((j) => j.id === r.journal_entry_id)
      const ref = je?.reference || r.description
      if (ref && !byCode[r.account_code].refs.includes(ref)) byCode[r.account_code].refs.push(ref)
    }
    console.table(
      Object.entries(byCode).map(([code, v]) => ({
        revenue_account: code,
        account_name: v.name,
        total_credited: v.total.toFixed(2),
        invoice_refs: v.refs.join(', '),
      }))
    )
  } else {
    console.log('No invoice revenue credit lines in ledger yet.')
  }

  console.log('\n--- get_gl_integrity_report ---')
  const { data: report, error: repErr } = await supabase.rpc('get_gl_integrity_report')
  if (repErr) {
    console.error('Integrity report error:', repErr.message)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }

  const { data: util } = await supabase
    .from('ledger_entries')
    .select('id, journal_entry_id, debit_amount, credit_amount, description')
    .eq('account_code', '6202')

  const utilNet = (util || []).reduce((s, r) => s + Number(r.credit_amount || 0) - Number(r.debit_amount || 0), 0)
  if (utilNet > 0.5) {
    console.log('\n--- Correcting reversed 6202 Utilities (credit balance) ---')
    const { data: fixResult, error: fixErr } = await supabase.rpc('post_manual_journal', {
      description_param: 'Correction — reverse mis-posted Utilities entry',
      entry_date_param: new Date().toISOString().slice(0, 10),
      reference_param: 'GL-FIX-6202',
      lines_param: [
        { account_code: '6202', debit_amount: utilNet, credit_amount: 0, line_description: 'Reverse incorrect credit on Utilities' },
        { account_code: '1101', debit_amount: 0, credit_amount: utilNet, line_description: 'Offset to cash' },
      ],
      actor_uuid: actor.id,
    })
    if (fixErr) console.error('6202 correction failed:', fixErr.message)
    else console.log(JSON.stringify(fixResult, null, 2))
  }

  const { data: report2 } = await supabase.rpc('get_gl_integrity_report')
  console.log('\n--- get_gl_integrity_report (after 6202 fix) ---')
  console.log(JSON.stringify(report2, null, 2))

  const { data: tb } = await supabase.from('general_ledger').select('debit_amount, credit_amount').limit(50000)
  const dr = (tb || []).reduce((s, r) => s + Number(r.debit_amount || 0), 0)
  const cr = (tb || []).reduce((s, r) => s + Number(r.credit_amount || 0), 0)
  console.log('\n--- Trial balance totals (from general_ledger) ---')
  console.log({ total_debits: dr, total_credits: cr, difference: dr - cr, balanced: Math.abs(dr - cr) < 0.02 })

  const { data: ar } = await supabase
    .from('ledger_entries')
    .select('debit_amount, credit_amount')
    .eq('account_code', '1110')
  const arDr = (ar || []).reduce((s, r) => s + Number(r.debit_amount || 0), 0)
  const arCr = (ar || []).reduce((s, r) => s + Number(r.credit_amount || 0), 0)
  console.log('\n--- Account 1110 AR ---')
  console.log({ debits: arDr, credits: arCr, net_debit_balance: arDr - arCr })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
