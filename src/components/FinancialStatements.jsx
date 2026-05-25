import { useCallback, useEffect, useMemo, useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import FinancialStatementPdf from './pdf/FinancialStatementPdf'
import { supabase } from '../lib/supabase'
import ScrollableSelect from './ui/ScrollableSelect'
import { btnGhostCls } from '../lib/portal-classes'
import {
  aggregateTrialBalance,
  buildFinancialReports,
  dayBefore,
  endOfYear,
  startOfYear,
} from '../lib/financialStatements'
import {
  StatementLine,
  StatementPanel,
  StatementSectionHeader,
  StatementSubLine,
  StatementTotal,
  TrialBalanceTable,
} from './financialStatements/StatementTable'
import GlIntegrityBanner from './financialStatements/GlIntegrityBanner'

const TABS = [
  { id: 'trial', label: 'Trial Balance' },
  { id: 'income', label: 'Income Statement' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'cash', label: 'Cash Flow' },
]

export default function FinancialStatements({ defaultTab = 'trial' }) {
  const today = new Date()
  const [tab, setTab] = useState(defaultTab)
  const [startDate, setStartDate] = useState(startOfYear(today))
  const [endDate, setEndDate] = useState(endOfYear(today))
  const [asAtDate, setAsAtDate] = useState(today.toISOString().slice(0, 10))
  const [division, setDivision] = useState('All')

  const [coaMap, setCoaMap] = useState({})
  const [divisions, setDivisions] = useState([])
  const [glPeriod, setGlPeriod] = useState([])
  const [glAsAt, setGlAsAt] = useState([])
  const [glOpening, setGlOpening] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dataVersion, setDataVersion] = useState(0)

  useEffect(() => {
    async function loadMeta() {
      const { data: coa } = await supabase
        .from('chart_of_accounts')
        .select(
          'account_code,account_name,account_type,financial_statement,element,sub_element,nature,is_contra,is_active'
        )
        .eq('is_active', true)
      const map = {}
      coa?.forEach((c) => {
        map[c.account_code] = c
      })
      setCoaMap(map)

      const { data: divs } = await supabase.from('divisions').select('id,name').order('name')
      setDivisions(divs || [])
    }
    loadMeta()
  }, [])

  const loadLedger = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const openEnd = dayBefore(startDate)

      const [periodRes, asAtRes, openingRes] = await Promise.all([
        supabase
          .from('general_ledger')
          .select('*')
          .gte('entry_date', startDate)
          .lte('entry_date', endDate)
          .order('entry_date', { ascending: true })
          .limit(50000),
        supabase
          .from('general_ledger')
          .select('*')
          .lte('entry_date', asAtDate)
          .order('entry_date', { ascending: true })
          .limit(50000),
        supabase
          .from('general_ledger')
          .select('*')
          .lte('entry_date', openEnd)
          .order('entry_date', { ascending: true })
          .limit(50000),
      ])

      if (periodRes.error) throw periodRes.error
      if (asAtRes.error) throw asAtRes.error
      if (openingRes.error) throw openingRes.error

      setGlPeriod(periodRes.data || [])
      setGlAsAt(asAtRes.data || [])
      setGlOpening(openingRes.data || [])
    } catch (err) {
      console.error('Financial statements GL load failed', err)
      setError(err.message || 'Failed to load ledger data.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, asAtDate])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  const divisionOptions = useMemo(
    () => [
      { value: 'All', label: 'All divisions' },
      ...divisions.map((d) => ({ value: d.name, label: d.name })),
    ],
    [divisions]
  )

  const reports = useMemo(() => {
    const trialPeriod = aggregateTrialBalance(glPeriod, coaMap, { division, divisions })
    const trialAsAt = aggregateTrialBalance(glAsAt, coaMap, { division, divisions })
    const trialOpening = aggregateTrialBalance(glOpening, coaMap, { division, divisions })

    return {
      trialPeriod,
      trialAsAt,
      ...buildFinancialReports({ trialPeriod, trialAsAt, trialOpening, coaMap }),
    }
  }, [glPeriod, glAsAt, glOpening, coaMap, division, divisions, dataVersion])

  const pdfProps = {
    startDate,
    endDate,
    asAtDate,
    division,
    reports,
  }

  function exportTrialCsv() {
    const cols = ['account_code', 'account_name', 'total_debits', 'total_credits', 'net_balance', 'account_type']
    const csv = [cols.join(',')]
    for (const r of reports.trialPeriod) {
      csv.push(cols.map((c) => (c === 'net_balance' ? r.net_balance : r[c] ?? '')).join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trial_balance_${startDate}_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const { incomeStatement: is, balanceSheet: bs, cashFlow: cf } = reports

  const pdfButton = (statementType, fileName) => (
    <PDFDownloadLink
      document={<FinancialStatementPdf statementType={statementType} {...pdfProps} />}
      fileName={fileName}
      className={btnGhostCls}
    >
      {({ loading: pdfLoading }) => (pdfLoading ? 'Preparing PDF…' : 'Export PDF')}
    </PDFDownloadLink>
  )

  return (
    <div className="mt-6 space-y-6">
      <GlIntegrityBanner onRepaired={() => setDataVersion((v) => v + 1)} />

      <div className="rounded-2xl border border-border-soft bg-surface/60 px-4 py-3 text-sm text-text-muted">
        All statements are built from the same <strong className="text-text-primary">Trial Balance</strong> data.
        Income Statement uses the selected period; Balance Sheet uses balances as at the as-at date, with current-year
        profit from the Income Statement included in equity.
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border-soft">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-touch px-4 py-3 text-sm font-medium transition ${
              tab === t.id
                ? 'border-b-2 border-teal-500 text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.16em] text-text-muted">Period start</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="min-h-11 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.16em] text-text-muted">Period end</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="min-h-11 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary"
          />
        </label>
        {(tab === 'balance' || tab === 'trial') && (
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.16em] text-text-muted">Balance sheet as at</span>
            <input
              type="date"
              value={asAtDate}
              onChange={(e) => setAsAtDate(e.target.value)}
              className="min-h-11 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary"
            />
          </label>
        )}
        <label className="min-w-[10rem] space-y-1">
          <span className="text-xs uppercase tracking-[0.16em] text-text-muted">Division</span>
          <ScrollableSelect value={division} onChange={setDivision} options={divisionOptions} placeholder="All" />
        </label>
        {loading && <span className="text-sm text-text-muted">Loading ledger…</span>}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {tab === 'trial' && (
        <StatementPanel
          title="Trial Balance"
          actions={
            <div className="flex gap-2">
              <button type="button" onClick={exportTrialCsv} className={btnGhostCls}>
                Export CSV
              </button>
              {pdfButton('trial', `trial-balance-${startDate}-${endDate}.pdf`)}
            </div>
          }
        >
          <p className="mb-4 text-sm text-text-muted">
            Period: {startDate} — {endDate}
            {division !== 'All' ? ` · ${division}` : ''}
          </p>
          <TrialBalanceTable rows={reports.trialPeriod} totals={reports.trialTotals} />
          {!reports.trialTotals.balanced && (
            <p className="mt-4 text-sm font-medium text-red-500">Trial balance debits and credits do not match.</p>
          )}
          {reports.trialTotals.balanced && (
            <p className="mt-4 text-sm text-teal-600 dark:text-teal-300">Trial balance is balanced.</p>
          )}
        </StatementPanel>
      )}

      {tab === 'income' && (
        <StatementPanel
          title="Income Statement"
          actions={pdfButton('income', `income-statement-${startDate}-${endDate}.pdf`)}
        >
          <StatementSectionHeader>Revenue</StatementSectionHeader>
          {is.revenueLines.map((line) => (
            <StatementSubLine key={line.label} label={line.label} amount={line.amount} />
          ))}
          <StatementTotal label="Total Revenue" amount={is.totalRevenue} />

          <StatementSectionHeader>Cost of Sales / Direct Costs</StatementSectionHeader>
          {is.costOfSalesLines.length === 0 ? (
            <StatementLine label="No direct costs in period" amount={0} />
          ) : (
            is.costOfSalesLines.map((line) => (
              <StatementSubLine key={line.account_code} label={line.label || line.account_name} amount={line.amount} />
            ))
          )}
          <StatementTotal label="Total Cost of Sales" amount={is.totalCostOfSales} />
          <StatementTotal label="Gross Profit" amount={is.grossProfit} />

          <StatementSectionHeader>Operating Expenses</StatementSectionHeader>
          {is.operatingExpenseLines.map((line) => (
            <StatementSubLine key={line.label} label={line.label} amount={line.amount} />
          ))}
          <StatementTotal label="Total Operating Expenses" amount={is.totalOperatingExpenses} />
          <StatementTotal label="Operating Profit (EBIT)" amount={is.operatingProfit} />

          {is.financeLines.length > 0 && (
            <>
              <StatementSectionHeader>Finance Costs</StatementSectionHeader>
              {is.financeLines.map((line) => (
                <StatementSubLine key={line.label} label={line.label} amount={line.amount} />
              ))}
            </>
          )}
          <StatementTotal label="Net Profit Before Tax" amount={is.netProfitBeforeTax} />
          <StatementLine label="Tax Provision (25%)" amount={-is.taxProvision} />
          <StatementTotal label="Net Profit After Tax" amount={is.netProfitAfterTax} />
        </StatementPanel>
      )}

      {tab === 'balance' && (
        <StatementPanel
          title="Balance Sheet"
          actions={pdfButton('balance', `balance-sheet-${asAtDate}.pdf`)}
        >
          <p className="mb-4 text-sm text-text-muted">As at {asAtDate}</p>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <StatementSectionHeader>Assets</StatementSectionHeader>
              <StatementLine label="Current Assets" amount={null} bold />
              {bs.assetsCurrent.map((l) => (
                <StatementSubLine key={l.account_code} label={l.account_name} amount={l.amount} />
              ))}
              <StatementLine label="Non-Current Assets" amount={null} bold />
              {bs.assetsNonCurrent.map((l) => (
                <StatementSubLine key={l.account_code} label={l.account_name} amount={l.amount} />
              ))}
              <StatementTotal label="Total Assets" amount={bs.totalAssets} />
            </div>

            <div>
              <StatementSectionHeader>Liabilities & Equity</StatementSectionHeader>
              <StatementLine label="Current Liabilities" amount={null} bold />
              {bs.liabilitiesCurrent.map((l) => (
                <StatementSubLine key={l.account_code} label={l.account_name} amount={l.amount} />
              ))}
              <StatementLine label="Non-Current Liabilities" amount={null} bold />
              {bs.liabilitiesNonCurrent.map((l) => (
                <StatementSubLine key={l.account_code} label={l.account_name} amount={l.amount} />
              ))}
              <StatementTotal label="Total Liabilities" amount={bs.totalLiabilities} />

              <StatementLine label="Equity" amount={null} bold />
              {bs.equityLines.map((l) => (
                <StatementSubLine
                  key={l.account_code}
                  label={l.account_name}
                  amount={l.amount}
                />
              ))}
              <StatementTotal label="Total Equity" amount={bs.totalEquity} />
            </div>
          </div>

          <StatementTotal
            label="Total Liabilities + Equity"
            amount={bs.totalLiabilitiesAndEquity}
            ok={bs.balanced}
          />
          {!bs.balanced && (
            <p className="mt-3 text-sm text-red-500">
              Balance sheet does not balance (variance GHS {Math.abs(bs.variance).toFixed(2)}). Check trial balance
              and that current-year profit is reflected in equity.
            </p>
          )}
        </StatementPanel>
      )}

      {tab === 'cash' && (
        <StatementPanel
          title="Cash Flow Statement"
          actions={pdfButton('cash', `cash-flow-${startDate}-${endDate}.pdf`)}
        >
          <StatementSectionHeader>Operating Activities</StatementSectionHeader>
          <StatementLine label="Net Profit After Tax" amount={cf.netProfitAfterTax} />
          <StatementLine label="Add back: Depreciation" amount={cf.depreciation} />
          <StatementLine label="(Increase)/Decrease in Receivables" amount={cf.receivablesChange} />
          <StatementLine label="Increase/(Decrease) in Payables" amount={cf.payablesChange} />
          {Math.abs(cf.inventoryChange) > 0.005 && (
            <StatementLine label="(Increase)/Decrease in Inventory" amount={cf.inventoryChange} />
          )}
          {Math.abs(cf.contractAssetChange) > 0.005 && (
            <StatementLine label="(Increase)/Decrease in Contract Assets" amount={cf.contractAssetChange} />
          )}
          <StatementTotal label="Net Cash from Operations" amount={cf.netCashFromOperations} />

          <StatementSectionHeader>Investing Activities</StatementSectionHeader>
          {cf.investingLines.map((l) => (
            <StatementSubLine key={l.label} label={l.label} amount={l.amount} />
          ))}
          <StatementTotal label="Net Cash from Investing" amount={cf.netCashFromInvesting} />

          <StatementSectionHeader>Financing Activities</StatementSectionHeader>
          {cf.financingLines.length === 0 ? (
            <StatementLine label="Loan drawdowns / repayments" amount={cf.netCashFromFinancing} />
          ) : (
            cf.financingLines.map((l) => (
              <StatementSubLine key={l.label} label={l.label} amount={l.amount} />
            ))
          )}
          <StatementTotal label="Net Cash from Financing" amount={cf.netCashFromFinancing} />

          <StatementTotal label="Net Increase/(Decrease) in Cash" amount={cf.netCashChange} ok={cf.netCashChange >= 0} />
          <p className="mt-4 text-xs text-text-muted">
            Opening cash GHS {cf.openingCash?.toLocaleString?.('en-GH', { minimumFractionDigits: 2 })} → Closing cash
            GHS {cf.closingCash?.toLocaleString?.('en-GH', { minimumFractionDigits: 2 })}
          </p>
        </StatementPanel>
      )}
    </div>
  )
}
