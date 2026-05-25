/**
 * Verify financial statements against live Supabase (anon read on general_ledger + coa).
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
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}
const supabase = createClient(url, key)

const startDate = startOfYear(new Date())
const endDate = endOfYear(new Date())
const asAtDate = new Date().toISOString().slice(0, 10)
const openEnd = dayBefore(startDate)

async function fetchGl({ gteDate, lteDate }) {
  let all = []
  let from = 0
  const page = 1000
  while (true) {
    let q = supabase.from('general_ledger').select('*').range(from, from + page - 1)
    if (gteDate) q = q.gte('entry_date', gteDate)
    if (lteDate) q = q.lte('entry_date', lteDate)
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
  const { data: coa } = await supabase
    .from('chart_of_accounts')
    .select('account_code,account_name,account_type,financial_statement,element,sub_element,nature,is_contra')
    .eq('is_active', true)

  const coaMap = {}
  coa?.forEach((c) => {
    coaMap[c.account_code] = c
  })

  const [glPeriod, glAsAt, glOpening] = await Promise.all([
    fetchGl({ gteDate: startDate, lteDate: endDate }),
    fetchGl({ lteDate: asAtDate }),
    fetchGl({ lteDate: openEnd }),
  ])

  const trialPeriod = aggregateTrialBalance(glPeriod, coaMap)
  const trialAsAt = aggregateTrialBalance(glAsAt, coaMap)
  const trialOpening = aggregateTrialBalance(glOpening, coaMap)
  const reports = buildFinancialReports({ trialPeriod, trialAsAt, trialOpening, coaMap })

  const tbDr = trialPeriod.reduce((s, r) => s + r.total_debits, 0)
  const tbCr = trialPeriod.reduce((s, r) => s + r.total_credits, 0)

  const ar = trialAsAt.find((r) => r.account_code === '1110')
  const { incomeStatement: is, balanceSheet: bs, cashFlow: cf } = reports

  console.log('\n=== Trial Balance (period) ===')
  console.log({ total_debits: tbDr, total_credits: tbCr, balanced: Math.abs(tbDr - tbCr) < 0.02 })

  console.log('\n=== Account 1110 AR (as-at) ===')
  console.log({
    debits: ar?.total_debits,
    credits: ar?.total_credits,
    net_debit_balance: ar?.signed_balance,
  })

  console.log('\n=== Revenue lines (Income Statement) ===')
  console.table(is.revenueLines)

  console.log('\n=== Income Statement waterfall ===')
  console.log({
    totalRevenue: is.totalRevenue,
    grossProfit: is.grossProfit,
    operatingProfit: is.operatingProfit,
    netProfitAfterTax: is.netProfitAfterTax,
  })

  console.log('\n=== Balance Sheet ===')
  console.log({
    totalAssets: bs.totalAssets,
    totalLiabilities: bs.totalLiabilities,
    totalEquity: bs.totalEquity,
    liabPlusEquity: bs.totalLiabilitiesAndEquity,
    balanced: bs.balanced,
    variance: bs.variance,
  })

  console.log('\n=== Cash Flow (receivables movement) ===')
  console.log({
    receivablesChange: cf.receivablesChange,
    netCashFromOperations: cf.netCashFromOperations,
    netCashChange: cf.netCashChange,
  })

  const { data: revJe } = await supabase
    .from('journal_entries')
    .select('id, reference, source_type')
    .eq('source_type', 'invoice')

  const jeIds = new Set((revJe || []).map((j) => j.id))
  const { data: revLedger } = await supabase
    .from('ledger_entries')
    .select('account_code, account_name, credit_amount, journal_entry_id')
    .gt('credit_amount', 0)

  const map = {}
  for (const r of revLedger || []) {
    if (!jeIds.has(r.journal_entry_id) || !String(r.account_code).startsWith('4')) continue
    map[r.account_code] = (map[r.account_code] || 0) + Number(r.credit_amount)
  }
  console.log('\n=== post_invoice_journal revenue COA credits (cumulative GL) ===')
  console.table(
    Object.entries(map).map(([code, amt]) => ({
      revenue_account: code,
      account_name: coaMap[code]?.account_name,
      total_credited: amt,
    }))
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
