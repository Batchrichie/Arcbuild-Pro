import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'

const DIVISIONS = ['Construction', 'Architecture', 'Real Estate', 'Logistics']
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
]

export default function DebtorsLedger({ readOnly = false }) {
  const [summary, setSummary] = useState([])
  const [clients, setClients] = useState([])
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

  const buildSummary = useCallback((rows) => {
    const grouped = {}

    rows.forEach((row) => {
      const id = row.client_id
      if (!grouped[id]) {
        grouped[id] = {
          client_id: id,
          client_name: row.client_name,
          client_type: row.client_type,
          email: row.email,
          total_invoiced_ghs: 0,
          total_received_ghs: 0,
          total_outstanding_ghs: 0,
          total_wht_deducted_ghs: 0,
          current_ghs: 0,
          overdue_1_30_ghs: 0,
          overdue_31_60_ghs: 0,
          overdue_61_90_ghs: 0,
          overdue_90_plus_ghs: 0,
        }
      }

      const rowGroup = grouped[id]
      const invoiced = Number(row.invoiced_amount || 0)
      const received = Number(row.amount_received || 0)
      const outstanding = Number(row.amount_outstanding || 0)
      const wht = Number(row.wht_deducted || 0)
      const overdue = Number(row.days_overdue || 0)

      rowGroup.total_invoiced_ghs += invoiced
      rowGroup.total_received_ghs += received
      rowGroup.total_outstanding_ghs += outstanding
      rowGroup.total_wht_deducted_ghs += wht

      if (overdue === 0) rowGroup.current_ghs += outstanding
      else if (overdue <= 30) rowGroup.overdue_1_30_ghs += outstanding
      else if (overdue <= 60) rowGroup.overdue_31_60_ghs += outstanding
      else if (overdue <= 90) rowGroup.overdue_61_90_ghs += outstanding
      else rowGroup.overdue_90_plus_ghs += outstanding
    })

    return Object.values(grouped).sort((a, b) => Number(b.total_outstanding_ghs || 0) - Number(a.total_outstanding_ghs || 0))
  }, [])

  const loadClientLedger = useCallback(async (clientId) => {
    if (!clientId) return
    try {
      let q = supabase.from('debtors_ledger').select('*').eq('client_id', clientId).order('transaction_date', { ascending: true })
      if (filters.from) q = q.gte('transaction_date', filters.from)
      if (filters.to) q = q.lte('transaction_date', filters.to)
      if (filters.division) q = q.eq('division_name', filters.division)
      if (filters.status === 'paid') {
        q = q.eq('invoice_status', 'paid')
      } else if (filters.status === 'outstanding') {
        q = q.in('invoice_status', ['sent', 'approved']).gt('amount_outstanding', 0)
      } else if (filters.status === 'overdue') {
        q = q.in('invoice_status', ['sent', 'approved']).gt('amount_outstanding', 0).lt('due_date', new Date().toISOString().slice(0, 10))
      }

      const { data, error } = await q
      if (error) throw error
      setLedgerRows((prev) => ({ ...prev, [clientId]: data || [] }))
    } catch (err) {
      console.error('Failed to load debtors ledger for', clientId, err)
    }
  }, [filters])

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      let query = supabase.from('debtors_ledger').select('*')

      if (filters.clientId) query = query.eq('client_id', filters.clientId)
      if (filters.division) query = query.eq('division_name', filters.division)
      if (filters.from) query = query.gte('transaction_date', filters.from)
      if (filters.to) query = query.lte('transaction_date', filters.to)

      if (filters.status === 'paid') {
        query = query.eq('invoice_status', 'paid')
      } else if (filters.status === 'outstanding') {
        query = query.in('invoice_status', ['sent', 'approved']).gt('amount_outstanding', 0)
      } else if (filters.status === 'overdue') {
        query = query.in('invoice_status', ['sent', 'approved']).gt('amount_outstanding', 0).lt('due_date', new Date().toISOString().slice(0, 10))
      }

      const { data, error } = await query.order('client_name', { ascending: true }).order('transaction_date', { ascending: true })
      if (error) throw error

      const group = buildSummary(data || [])
      setSummary(group)

      if (filters.clientId) {
        setExpandedClient(filters.clientId)
        if (!ledgerRows[filters.clientId]) {
          loadClientLedger(filters.clientId)
        }
      }
    } catch (err) {
      console.error('Failed to load client balance summary', err)
    } finally {
      setLoadingSummary(false)
    }
  }, [filters, ledgerRows, buildSummary, loadClientLedger])

  useEffect(() => {
    const init = async () => {
      await loadClients()
      await loadSummary()
    }
    init()
  }, [loadClients, loadSummary])

  useEffect(() => {
    const refresh = async () => {
      await loadSummary()
    }
    refresh()
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
      let q = supabase.from('debtors_ledger').select('*')
      if (filters.clientId) q = q.eq('client_id', filters.clientId)
      if (filters.division) q = q.eq('division_name', filters.division)
      if (filters.from) q = q.gte('transaction_date', filters.from)
      if (filters.to) q = q.lte('transaction_date', filters.to)
      if (filters.status === 'paid') {
        q = q.eq('invoice_status', 'paid')
      } else if (filters.status === 'outstanding') {
        q = q.in('invoice_status', ['sent', 'approved']).gt('amount_outstanding', 0)
      } else if (filters.status === 'overdue') {
        q = q.in('invoice_status', ['sent', 'approved']).gt('amount_outstanding', 0).lt('due_date', new Date().toISOString().slice(0, 10))
      }
      const { data, error } = await q.order('client_name', { ascending: true }).order('transaction_date', { ascending: true })
      if (error) throw error
      exportCsv(data || [], 'debtors_ledger.csv')
    } catch (err) {
      console.error('Failed to export full debtors ledger', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Debtors Ledger</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Aged Receivables Summary</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportSummary} className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200">Export Aged Receivables</button>
            <button type="button" onClick={exportFullLedger} className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200">Export Full Debtors Ledger</button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Client</span>
            <select value={filters.clientId} onChange={(e) => handleFilterChange('clientId', e.target.value)} className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary">
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Division</span>
            <select value={filters.division} onChange={(e) => handleFilterChange('division', e.target.value)} className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary">
              <option value="">All divisions</option>
              {DIVISIONS.map((division) => (
                <option key={division} value={division}>{division}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</span>
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">From</span>
            <input type="date" value={filters.from} onChange={(e) => handleFilterChange('from', e.target.value)} className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">To</span>
            <input type="date" value={filters.to} onChange={(e) => handleFilterChange('to', e.target.value)} className="w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">{summary.length} client(s) shown</p>
          <button type="button" onClick={resetFilters} className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200">Reset Filters</button>
        </div>

        <div className="mt-6 portal-table-scroll overflow-x-auto rounded-3xl border border-border-soft bg-surface/80">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Type</th>
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
                <tr><td colSpan={10} className="p-4 text-slate-400">Loading...</td></tr>
              ) : summary.length === 0 ? (
                <tr><td colSpan={10} className="p-4 text-slate-400">No data</td></tr>
              ) : (
                summary.map((c) => (
                  <tr key={c.client_id} className="border-t border-border-soft hover:bg-white/5 cursor-pointer" onClick={() => handleExpand(c.client_id)}>
                    <td className="px-3 py-3 text-slate-200">{c.client_name}</td>
                    <td className="px-3 py-3 text-slate-200">{c.client_type}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{formatGhs(c.total_invoiced_ghs)}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{formatGhs(c.total_received_ghs)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${Number(c.total_outstanding_ghs) > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatGhs(c.total_outstanding_ghs)}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{formatGhs(c.current_ghs)}</td>
                    <td className={`px-3 py-3 text-right ${Number(c.overdue_1_30_ghs) > 0 ? 'text-amber-300' : 'text-slate-200'}`}>{formatGhs(c.overdue_1_30_ghs)}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{formatGhs(c.overdue_31_60_ghs)}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{formatGhs(c.overdue_61_90_ghs)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${Number(c.overdue_90_plus_ghs) > 0 ? 'text-rose-300' : 'text-slate-200'}`}>{formatGhs(c.overdue_90_plus_ghs)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {summary.length > 0 && (
              <tfoot>
                <tr className="border-t border-border-soft bg-white/5 text-slate-300">
                  <td className="px-3 py-3 font-semibold">Totals</td>
                  <td className="px-3 py-3" />
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
              <h3 className="text-lg font-semibold text-white">Transactions — {summary.find((s) => s.client_id === expandedClient)?.client_name}</h3>
              <p className="text-sm text-slate-400">Running balance shown on the right</p>
            </div>
            <button type="button" onClick={() => setExpandedClient(null)} className="min-touch rounded-full border border-border-soft px-4 py-2 text-sm text-slate-300">Close</button>
          </div>

          <div className="mt-4 portal-table-scroll overflow-x-auto rounded-3xl border border-border-soft bg-surface/80">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Invoice No.</th>
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
                  <tr><td colSpan={13} className="p-4 text-slate-400">No transactions</td></tr>
                ) : (() => {
                  let running = 0
                  return ledgerRows[expandedClient].map((r) => {
                    const delta = Number(r.amount_outstanding || 0) - Number(r.amount_received || 0)
                    running += delta
                    const overdue = Number(r.days_overdue || 0)
                    const rowClass = r.invoice_status === 'paid' ? 'bg-emerald-900/40 text-emerald-200' : overdue > 30 ? 'bg-rose-900/30 text-rose-200' : overdue > 0 ? 'bg-amber-900/20 text-amber-200' : ''
                    return (
                      <tr key={r.invoice_id} className={`border-t border-border-soft ${rowClass}`}>
                        <td className="px-3 py-3 text-slate-200">{r.transaction_date}</td>
                        <td className="px-3 py-3 text-slate-200">{r.invoice_number}</td>
                        <td className="px-3 py-3 text-slate-200">{r.project_name || '—'}</td>
                        <td className="px-3 py-3 text-slate-200">{r.division_name || '—'}</td>
                        <td className="px-3 py-3 text-right text-slate-200">{formatGhs(r.invoiced_amount)}</td>
                        <td className="px-3 py-3 text-right text-slate-200">{formatGhs(r.wht_deducted)}</td>
                        <td className="px-3 py-3 text-right text-slate-200">{formatGhs(r.net_receivable)}</td>
                        <td className="px-3 py-3 text-right text-slate-200">{formatGhs(r.amount_received)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-200">{formatGhs(r.amount_outstanding)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-200">{formatGhs(running)}</td>
                        <td className="px-3 py-3 text-slate-200">{r.due_date || '—'}</td>
                        <td className="px-3 py-3 text-slate-200">{r.days_overdue || 0}</td>
                        <td className="px-3 py-3 text-slate-200">{r.invoice_status}</td>
                        <td className="px-3 py-3">
                          {!readOnly && r.days_overdue > 0 && (
                            <button type="button" onClick={() => alert('Send Reminder stub for ' + r.invoice_number)} className="min-touch rounded-full border border-border-soft bg-white/5 px-3 py-2 text-xs text-slate-200">Send Reminder</button>
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
