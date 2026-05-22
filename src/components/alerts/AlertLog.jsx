import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ALERT_TYPES = [
  { value: '', label: 'All alerts' },
  { value: 'invoice_overdue', label: 'Invoice overdue' },
  { value: 'budget_overrun', label: 'Budget overrun' },
  { value: 'tax_deadline', label: 'Tax deadline' },
  { value: 'contract_expiry', label: 'Contract expiry' },
]

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AlertStatusBadge({ status }) {
  const config = {
    sent: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20',
    failed: 'bg-rose-500/10 text-rose-200 border border-rose-500/20',
  }
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${config[status] || 'bg-slate-800/80 text-slate-200 border border-slate-700'}`}>
      {status?.replace(/_/g, ' ') || 'unknown'}
    </span>
  )
}

export default function AlertLog({ readOnly = false }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('alert_log').select('*').order('sent_at', { ascending: false })
      if (filterType) query = query.eq('alert_type', filterType)
      if (fromDate) query = query.gte('sent_at', `${fromDate}T00:00:00Z`)
      if (toDate) query = query.lte('sent_at', `${toDate}T23:59:59Z`)
      const { data, error } = await query
      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Failed to load alert logs', err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [filterType, fromDate, toDate])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const runAlertsNow = async () => {
    setRunning(true)
    setMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('alert-runner')
      if (error) throw error
      setMessage(data?.message || 'Alert runner executed successfully.')
      await loadLogs()
    } catch (err) {
      console.error('Alert runner failed', err)
      setMessage(err.message || 'Alert runner failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Smart Alert System</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Alert Log</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadLogs}
              className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={runAlertsNow}
              disabled={readOnly || running}
              className="min-touch rounded-full border border-border-soft bg-amber-500/10 px-4 py-2 text-sm text-amber-200 disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run Alerts Now'}
            </button>
          </div>
        </div>

        {message && <p className="mt-4 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-200">{message}</p>}

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Alert type</span>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white">
              {ALERT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">From</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white" />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">To</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white" />
          </label>
        </div>
      </div>

      <div className="rounded-4xl border border-border-soft bg-slate-950/80 p-4 shadow-xl shadow-black/10">
        <div className="overflow-x-auto rounded-3xl">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                <th className="px-3 py-3">Sent At</th>
                <th className="px-3 py-3">Alert Type</th>
                <th className="px-3 py-3">Subject</th>
                <th className="px-3 py-3">Recipients</th>
                <th className="px-3 py-3">Related Record</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-slate-400">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-slate-400">No alert logs found.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-border-soft hover:bg-white/5">
                    <td className="px-3 py-3 text-slate-200">{formatDate(log.sent_at)}</td>
                    <td className="px-3 py-3 text-slate-200">{log.alert_type}</td>
                    <td className="px-3 py-3 text-slate-200">{log.subject}</td>
                    <td className="px-3 py-3 text-slate-200">{log.recipient_email}</td>
                    <td className="px-3 py-3 text-slate-200">{log.related_table} / {log.related_id}</td>
                    <td className="px-3 py-3"><AlertStatusBadge status={log.delivery_status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
