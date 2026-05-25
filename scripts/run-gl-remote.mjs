/**
 * Run GL integrity RPCs against VITE_SUPABASE_* from .env (handles UTF-8 BOM).
 * Optional: SUPABASE_EMAIL + SUPABASE_PASSWORD for authenticated RPCs.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import {
  aggregateTrialBalance,
  buildFinancialReports,
  dayBefore,
  startOfYear,
  endOfYear,
} from '../src/lib/financialStatements.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const path = resolve(root, '.env')
  if (!existsSync(path)) return {}
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, serviceKey || anonKey)

async function ensureSession() {
  if (serviceKey) return
  const email = env.SUPABASE_EMAIL
  const password = env.SUPABASE_PASSWORD
  if (email && password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`Sign-in failed: ${error.message}`)
    return
  }
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session) {
    console.warn('No auth session — RPCs may fail if granted to authenticated only.')
  }
}

async function fetchAll(table, buildQuery) {
  let all = []
  let from = 0
  const page = 1000
  while (true) {
    let q = supabase.from(table).select('*').range(from, from + page - 1)
    if (buildQuery) q = buildQuery(q)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data)
    if (data.length < page) break
    from += page
  }
  return all
}

async function main() {
  await ensureSession()

  let actorUserId = '00000000-0000-0000-0000-000000000001'
  const { data: actor } = await supabase
    .from('profiles')
    .select('user_id, full_name, role')
    .in('role', ['system', 'accountant', 'ceo'])
    .limit(1)
    .maybeSingle()
  if (actor?.user_id) {
    actorUserId = actor.user_id
    console.log('Acting user:', actor.full_name, actor.role, actorUserId)
  }

  console.log('\n========== backfill_missing_invoice_journals ==========')
  const { data: backfill, error: bfErr } = await supabase.rpc('backfill_missing_invoice_journals', {
    acting_user_id: actorUserId,
  })
  if (bfErr) console.error(bfErr.message)
  else console.log(JSON.stringify(backfill, null, 2))

  console.log('\n========== get_gl_integrity_report ==========')
  const { data: report, error: repErr } = await supabase.rpc('get_gl_integrity_report')
  if (repErr) console.error(repErr.message)
  else console.log(JSON.stringify(report, null, 2))

  const { data: util } = await supabase
    .from('ledger_entries')
    .select('debit_amount, credit_amount')
    .eq('account_code', '6202')
  const utilNet = (util || []).reduce(
    (s, r) => s + Number(r.credit_amount || 0) - Number(r.debit_amount || 0),
    0
  )

  if (utilNet > 0.5) {
    console.log('\n========== fix 6202 Utilities (net credit', utilNet, ') ==========')
    const { data: fixRpc, error: fixRpcErr } = await supabase.rpc('fix_utilities_6202_journal')
    if (!fixRpcErr) {
      console.log(JSON.stringify(fixRpc, null, 2))
    } else {
      console.warn('fix_utilities_6202_journal:', fixRpcErr.message)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['system', 'accountant', 'ceo'])
        .limit(1)
        .maybeSingle()
      const { data: fixMj, error: fixMjErr } = await supabase.rpc('post_manual_journal', {
        description_param: 'Correction — reverse mis-posted Utilities entry',
        entry_date_param: new Date().toISOString().slice(0, 10),
        reference_param: 'GL-FIX-6202',
        lines_param: [
          {
            account_code: '6202',
            debit_amount: utilNet,
            credit_amount: 0,
            line_description: 'Reverse incorrect credit on Utilities',
          },
          {
            account_code: '1101',
            debit_amount: 0,
            credit_amount: utilNet,
            line_description: 'Offset to cash',
          },
        ],
        actor_uuid: profile?.id,
      })
      if (fixMjErr) console.error('post_manual_journal fix failed:', fixMjErr.message)
      else console.log(JSON.stringify(fixMj, null, 2))
    }
  } else {
    console.log('\n6202 Utilities: no credit-only reversal needed (net=', utilNet, ')')
  }

  console.log('\n========== get_gl_integrity_report (after 6202) ==========')
  const { data: report2 } = await supabase.rpc('get_gl_integrity_report')
  console.log(JSON.stringify(report2, null, 2))

  console.log('\n========== post_invoice_journal revenue credits ==========')
  const { data: jeInvoices } = await supabase
    .from('journal_entries')
    .select('id, reference, source_type')
    .eq('source_type', 'invoice')
  const jeIds = new Set((jeInvoices || []).map((j) => j.id))
  const { data: revLedger } = await supabase
    .from('ledger_entries')
    .select('account_code, account_name, credit_amount, journal_entry_id, description')
    .gt('credit_amount', 0)

  const byCode = {}
  for (const r of revLedger || []) {
    if (!jeIds.has(r.journal_entry_id) || !String(r.account_code).startsWith('4')) continue
    byCode[r.account_code] = byCode[r.account_code] || { name: r.account_name, total: 0, refs: [] }
    byCode[r.account_code].total += Number(r.credit_amount || 0)
    const je = jeInvoices.find((j) => j.id === r.journal_entry_id)
    const ref = je?.reference || ''
    if (ref && !byCode[r.account_code].refs.includes(ref)) byCode[r.account_code].refs.push(ref)
  }
  console.log('Division → revenue COA (from post_invoice_journal):')
  console.log('  Construction → 4100 | Architecture → 4200 | Real Estate → 4300 | Logistics → 4400 | default → 4500')
  console.table(
    Object.entries(byCode).map(([code, v]) => ({
      revenue_account: code,
      account_name: v.name,
      total_credited: v.total.toFixed(2),
      invoice_refs: v.refs.join(', '),
    }))
  )

  const gl = await fetchAll('general_ledger', (q) => q)
  const { data: coa } = await supabase
    .from('chart_of_accounts')
    .select('account_code,account_name,account_type,financial_statement,element,sub_element,nature,is_contra')
    .eq('is_active', true)
  const coaMap = {}
  coa?.forEach((c) => {
    coaMap[c.account_code] = c
  })

  const startDate = startOfYear(new Date())
  const endDate = endOfYear(new Date())
  const openEnd = dayBefore(startDate)
  const glPeriod = gl.filter((r) => r.entry_date >= startDate && r.entry_date <= endDate)
  const glAsAt = gl.filter((r) => r.entry_date <= new Date().toISOString().slice(0, 10))
  const glOpening = gl.filter((r) => r.entry_date <= openEnd)

  const trialPeriod = aggregateTrialBalance(glPeriod, coaMap)
  const trialAsAt = aggregateTrialBalance(glAsAt, coaMap)
  const trialOpening = aggregateTrialBalance(glOpening, coaMap)
  const reports = buildFinancialReports({ trialPeriod, trialAsAt, trialOpening, coaMap })
  const { incomeStatement: is, balanceSheet: bs, cashFlow: cf } = reports

  const tbDr = trialPeriod.reduce((s, r) => s + r.total_debits, 0)
  const tbCr = trialPeriod.reduce((s, r) => s + r.total_credits, 0)
  const ar = trialAsAt.find((r) => r.account_code === '1110')

  console.log('\n========== Four financial statements (engine) ==========')
  console.log('Trial Balance:', { total_debits: tbDr, total_credits: tbCr, balanced: Math.abs(tbDr - tbCr) < 0.02 })
  console.log('AR 1110:', {
    debits: ar?.total_debits,
    credits: ar?.total_credits,
    net_debit_balance: ar?.signed_balance,
  })
  console.log('Income Statement revenue:', is.totalRevenue, '| lines:', is.revenueLines?.length)
  console.log('Balance Sheet:', {
    totalAssets: bs.totalAssets,
    liabPlusEquity: bs.totalLiabilitiesAndEquity,
    balanced: bs.balanced,
    variance: bs.variance,
  })
  console.log('Cash Flow receivablesChange:', cf.receivablesChange)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
