import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'
import {
  buildClientSummaryFromGlDebtors,
  enrichDebtorRowsWithInvoiceMetadata,
  exportGlDebtors,
  getGlDebtors,
  getGlDebtorsForClient,
} from '../../services/debtorsReportService'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
]

export default function DebtorsLedger({ readOnly = false }) {
  const [summary, setSummary] = useState([])
  const [clients, setClients] = useState([])
  const [divisions, setDivisions] = useState([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [expandedClient, setExpandedClient] = useState(null)
  const [ledgerRows, setLedgerRows] = useState({})
  const [filters, setFilters] = useState({
    clientId: '',
    division: '',
    status: '',
    from: '',
    to: '',
  })

  const loadClients = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('clients').select('id,name').order('name', { ascending: true })
      if (error) throw error
      setClients(data || [])
    } catch (err) {
      console.error('Failed to load clients', err)
    }
  }, [])

  const loadDivisions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('divisions').select('name').order('name')
      if (error) throw error
      setDivisions((data || []).map((row) => row.name))
    } catch (err) {
      console.error('Failed to load divisions', err)
    }
  }, [])

  const loadClientLedger = useCallback(async (clientId) => {
    if (!clientId) return
    try {
      const rows = await getGlDebtorsForClient(clientId, filters)
      let enriched = await enrichDebtorRowsWithInvoiceMetadata(rows)

      if (filters.status === 'paid') {
        enriched = enriched.filter((row) => row.invoice_status === 'paid' || Number(row.amount_outstanding || 0) <= 0)
      }

      setLedgerRows((prev) => ({ ...prev, [clientId]: enriched }))
    } catch (err) {
      console.error('Failed to load GL debtors for', clientId, err)
    }
  }, [filters])

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const rows = await getGlDebtors(filters)
      let enriched = await enrichDebtorRowsWithInvoiceMetadata(rows)

      if (filters.status === 'paid') {
        enriched = enriched.filter((row) => row.invoice_status === 'paid' || Number(row.amount_outstanding || 0) <= 0)
      }

      const group = buildClientSummaryFromGlDebtors(enriched)
      setSummary(group)

      if (filters.clientId) {
        setExpandedClient(filters.clientId)
        if (!ledgerRows[filters.clientId]) {
          loadClientLedger(filters.clientId)
        }
      }
    } catch (err) {
      console.error('Failed to load GL debtors summary', err)
    } finally {
      setLoadingSummary(false)
    }
  }, [filters, ledgerRows, loadClientLedger])

  useEffect(() => {
    loadClients()
    loadDivisions()
  }, [loadClients, loadDivisions])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const handleExpand = (clientId) => {
    if (expandedClient === clientId) {
      setExpandedClient(null)
      return
    }
    setExpandedClient(clientId)
    if (!ledgerRows[clientId]) loadClientLedger(clientId)
  }

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const resetFilters = () => {
    setFilters({ clientId: '', division: '', status: '', from: '', to: '' })
  }

  const exportCsv = (rows, filename = 'export.csv') => {
    if (!rows || rows.length === 0) return
    const keys = Object.keys(rows[0])
    const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => {
      const v = r[k]
      if (v === null || v === undefined) return ''
      return String(v).replace(/"/g, '""')
    }).map((c) => `"${c}"`).join(','))].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const summaryTotals = useMemo(() => {
    return summary.reduce(
      (totals, row) => ({
        total_invoiced_ghs: totals.total_invoiced_ghs + Number(row.total_invoiced_ghs || 0),
        total_received_ghs: totals.total_received_ghs + Number(row.total_received_ghs || 0),
        total_outstanding_ghs: totals.total_outstanding_ghs + Number(row.total_outstanding_ghs || 0),
        current_ghs: totals.current_ghs + Number(row.current_ghs || 0),
        overdue_1_30_ghs: totals.overdue_1_30_ghs + Number(row.overdue_1_30_ghs || 0),
        overdue_31_60_ghs: totals.overdue_31_60_ghs + Number(row.overdue_31_60_ghs || 0),
        overdue_61_90_ghs: totals.overdue_61_90_ghs + Number(row.overdue_61_90_ghs || 0),
        overdue_90_plus_ghs: totals.overdue_90_plus_ghs + Number(row.overdue_90_plus_ghs || 0),
      }),
      {
        total_invoiced_ghs: 0,
        total_received_ghs: 0,
        total_outstanding_ghs: 0,
        current_ghs: 0,
        overdue_1_30_ghs: 0,
        overdue_31_60_ghs: 0,
        overdue_61_90_ghs: 0,
        overdue_90_plus_ghs: 0,
      }
    )
  }, [summary])

  const exportSummary = () => exportCsv(summary, 'aged_receivables_summary.csv')
  const exportFullLedger = async () => {
    try {
      const data = await exportGlDebtors(filters)
      exportCsv(data, 'gl_debtors.csv')
    } catch (err) {
      console.error('Failed to export GL debtors', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-portal-muted">Debtors Ledger</p>
            <h2 className="mt-2 text-2xl font-semibold text-portal-primary">Aged Receivables Summary</h2>
            <p className="mt-2 text-sm text-portal-muted">Balances and ageing from posted GL (<code className="text-portal-info">gl_debtors</code>). Invoice numbers and due dates from invoices.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportSummary} className="min-touch rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted">Export Aged Receivables</button>
            <button type="button" onClick={exportFullLedger} className="min-touch rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted">Export GL Debtors</button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Client</span>
            <select value={filters.clientId} onChange={(e) => handleFilterChange('clientId', e.target.value)} className="w-full rounded-lg border border-border-soft bg-portal-input px-3 py-2 text-sm text-portal-primary">
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Division</span>
            <select value={filters.division} onChange={(e) => handleFilterChange('division', e.target.value)} className="w-full rounded-lg border border-border-soft bg-portal-input px-3 py-2 text-sm text-portal-primary">
              <option value="">All divisions</option>
              {divisions.map((division) => (
                <option key={division} value={division}>{division}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Status</span>
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="w-full rounded-lg border border-border-soft bg-portal-input px-3 py-2 text-sm text-portal-primary">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">From</span>
            <input type="date" value={filters.from} onChange={(e) => handleFilterChange('from', e.target.value)} className="w-full rounded-lg border border-border-soft bg-portal-input px-3 py-2 text-sm text-portal-primary" />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">To</span>
            <input type="date" value={filters.to} onChange={(e) => handleFilterChange('to', e.target.value)} className="w-full rounded-lg border border-border-soft bg-portal-input px-3 py-2 text-sm text-portal-primary" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-portal-muted">{summary.length} client(s) shown</p>
          <button type="button" onClick={resetFilters} className="min-touch rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted">Reset Filters</button>
        </div>

        <div className="mt-6 portal-table-scroll overflow-x-auto rounded-3xl border border-border-soft bg-portal-input">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.24em] text-portal-muted">
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Currency</th>
                <th className="px-3 py-3 text-right">Total Invoiced</th>
                <th className="px-3 py-3 text-right">Total Received</th>
                <th className="px-3 py-3 text-right">Outstanding</th>
                <th className="px-3 py-3 text-right">Current</th>
                <th className="px-3 py-3 text-right">1-30</th>
                <th className="px-3 py-3 text-right">31-60</th>
                <th className="px-3 py-3 text-right">61-90</th>
                <th className="px-3 py-3 text-right">90+</th>
              </tr>
            </thead>
            <tbody>
              {loadingSummary ? (
                <tr><td colSpan={11} className="p-4 text-portal-muted">Loading...</td></tr>
              ) : summary.length === 0 ? (
                <tr><td colSpan={11} className="p-4 text-portal-muted">No data</td></tr>
              ) : (
                summary.map((c) => (
                  <tr key={c.client_id} className="border-t border-border-soft hover:bg-portal-overlay cursor-pointer" onClick={() => handleExpand(c.client_id)}>
                    <td className="px-3 py-3 text-portal-primary">{c.client_name}</td>
                    <td className="px-3 py-3 text-portal-primary">{c.client_type}</td>
                    <td className="px-3 py-3 text-portal-primary">{c.currency || 'GHS'}</td>
                    <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(c.total_invoiced_ghs)}</td>
                    <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(c.total_received_ghs)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${Number(c.total_outstanding_ghs) > 0 ? 'text-portal-danger' : 'text-portal-success'}`}>{formatGhs(c.total_outstanding_ghs)}</td>
                    <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(c.current_ghs)}</td>
                    <td className={`px-3 py-3 text-right ${Number(c.overdue_1_30_ghs) > 0 ? 'text-portal-warning' : 'text-portal-primary'}`}>{formatGhs(c.overdue_1_30_ghs)}</td>
                    <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(c.overdue_31_60_ghs)}</td>
                    <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(c.overdue_61_90_ghs)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${Number(c.overdue_90_plus_ghs) > 0 ? 'text-portal-danger' : 'text-portal-primary'}`}>{formatGhs(c.overdue_90_plus_ghs)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {summary.length > 0 && (
              <tfoot>
                <tr className="border-t border-border-soft bg-portal-overlay text-portal-muted">
                  <td className="px-3 py-3 font-semibold text-portal-primary">Totals</td>
                  <td className="px-3 py-3" colSpan={2} />
                  <td className="px-3 py-3 text-right font-semibold">{formatGhs(summaryTotals.total_invoiced_ghs)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatGhs(summaryTotals.total_received_ghs)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatGhs(summaryTotals.total_outstanding_ghs)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatGhs(summaryTotals.current_ghs)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatGhs(summaryTotals.overdue_1_30_ghs)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatGhs(summaryTotals.overdue_31_60_ghs)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatGhs(summaryTotals.overdue_61_90_ghs)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatGhs(summaryTotals.overdue_90_plus_ghs)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {expandedClient && (
        <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-portal-primary">Transactions — {summary.find((s) => s.client_id === expandedClient)?.client_name}</h3>
              <p className="text-sm text-portal-muted">GL balances from gl_debtors; invoice metadata from invoices</p>
            </div>
            <button type="button" onClick={() => setExpandedClient(null)} className="min-touch rounded-full border border-border-soft px-4 py-2 text-sm text-portal-muted">Close</button>
          </div>

          <div className="mt-4 portal-table-scroll overflow-x-auto rounded-3xl border border-border-soft bg-portal-input">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.24em] text-portal-muted">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Invoice No.</th>
                  <th className="px-3 py-3">Currency</th>
                  <th className="px-3 py-3">Project</th>
                  <th className="px-3 py-3">Division</th>
                  <th className="px-3 py-3 text-right">Invoiced</th>
                  <th className="px-3 py-3 text-right">WHT</th>
                  <th className="px-3 py-3 text-right">Net Receivable</th>
                  <th className="px-3 py-3 text-right">Received</th>
                  <th className="px-3 py-3 text-right">Outstanding</th>
                  <th className="px-3 py-3 text-right">Running Balance</th>
                  <th className="px-3 py-3">Due Date</th>
                  <th className="px-3 py-3">Days Overdue</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerRows[expandedClient] || []).length === 0 ? (
                  <tr><td colSpan={15} className="p-4 text-portal-muted">No transactions</td></tr>
                ) : (() => {
                  let running = 0
                  return ledgerRows[expandedClient].map((r) => {
                    running += Number(r.amount_outstanding || 0)
                    const overdue = Number(r.days_overdue || 0)
                    const rowClass = r.invoice_status === 'paid' ? 'bg-portal-success text-portal-success' : overdue > 30 ? 'bg-portal-danger text-portal-danger' : overdue > 0 ? 'bg-portal-warning text-portal-warning' : ''
                    return (
                      <tr key={r.invoice_id || `${r.transaction_date}-${r.invoice_number}`} className={`border-t border-border-soft ${rowClass}`}>
                        <td className="px-3 py-3 text-portal-primary">{r.transaction_date}</td>
                        <td className="px-3 py-3 text-portal-primary">{r.invoice_number}</td>
                        <td className="px-3 py-3 text-portal-primary">{r.currency || 'GHS'}</td>
                        <td className="px-3 py-3 text-portal-primary">{r.project_name || '—'}</td>
                        <td className="px-3 py-3 text-portal-primary">{r.division_name || '—'}</td>
                        <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(r.invoiced_amount)}</td>
                        <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(r.wht_deducted)}</td>
                        <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(r.net_receivable)}</td>
                        <td className="px-3 py-3 text-right text-portal-primary">{formatGhs(r.amount_received)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-portal-primary">{formatGhs(r.amount_outstanding)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-portal-primary">{formatGhs(running)}</td>
                        <td className="px-3 py-3 text-portal-primary">{r.due_date || '—'}</td>
                        <td className="px-3 py-3 text-portal-primary">{r.days_overdue || 0}</td>
                        <td className="px-3 py-3 text-portal-primary">{r.invoice_status || '—'}</td>
                        <td className="px-3 py-3">
                          {!readOnly && overdue > 0 && (
                            <button type="button" onClick={() => alert('Send Reminder stub for ' + r.invoice_number)} className="min-touch rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-xs text-portal-muted">Send Reminder</button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
