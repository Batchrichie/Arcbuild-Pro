import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

function downloadCsv(filename, rows) {
  if (!rows.length) return
  const csv = [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).map((v) => `"${String(v ?? '')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function TimesheetReport() {
  const [rows, setRows] = useState([])
  const [, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSummary()
  }, [])

  async function loadSummary() {
    setLoading(true)
    const { data, error } = await supabase
      .from('timesheet_summary')
      .select('*')
      .order('date', { ascending: false })
      .limit(200)

    setLoading(false)
    if (error) {
      setError('Could not load timesheet summary: ' + error.message)
      return
    }
    setRows(data || [])
  }

  const metrics = useMemo(() => {
    const totals = { submitted: 0, approved: 0, rejected: 0, hours: 0, billableHours: 0 }
    rows.forEach((row) => {
      totals[row.status] = (totals[row.status] || 0) + 1
      totals.hours += Number(row.hours_worked || 0)
      if (row.billable) totals.billableHours += Number(row.hours_worked || 0)
    })
    return totals
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="rounded-4xl border border-border-soft bg-portal-input p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-portal-primary">Timesheet Summary</h2>
            <p className="text-sm text-portal-muted">Review recent employee time submissions across the business.</p>
          </div>
          <button
            type="button"
            onClick={loadSummary}
            className="rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-portal-surface p-4">
            <p className="text-sm uppercase tracking-[0.2em] text-portal-muted">Submitted</p>
            <p className="mt-3 text-3xl font-semibold text-portal-primary">{metrics.submitted}</p>
          </div>
          <div className="rounded-3xl bg-portal-surface p-4">
            <p className="text-sm uppercase tracking-[0.2em] text-portal-muted">Approved</p>
            <p className="mt-3 text-3xl font-semibold text-portal-primary">{metrics.approved}</p>
          </div>
          <div className="rounded-3xl bg-portal-surface p-4">
            <p className="text-sm uppercase tracking-[0.2em] text-portal-muted">Rejected</p>
            <p className="mt-3 text-3xl font-semibold text-portal-primary">{metrics.rejected}</p>
          </div>
          <div className="rounded-3xl bg-portal-surface p-4">
            <p className="text-sm uppercase tracking-[0.2em] text-portal-muted">Total hours</p>
            <p className="mt-3 text-3xl font-semibold text-portal-primary">{metrics.hours.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl bg-portal-surface p-4">
            <p className="text-sm uppercase tracking-[0.2em] text-portal-muted">Billable hours</p>
            <p className="mt-3 text-3xl font-semibold text-portal-primary">{metrics.billableHours.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {error && <p className="rounded-3xl border border-portal-danger bg-portal-danger/10 p-4 text-sm text-portal-danger">{error}</p>}

      <div className="overflow-x-auto rounded-4xl border border-border-soft bg-portal-input p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-portal-muted">Latest 200 timesheet records from the summary view.</p>
          <button
            type="button"
            onClick={() => downloadCsv('timesheet_summary.csv', rows)}
            disabled={!rows.length}
            className="rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <table className="min-w-full text-left text-sm text-portal-primary">
          <thead className="bg-portal-surface text-portal-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Billable</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Approved by</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-portal-muted">No timesheet summary rows available.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border-soft">
                  <td className="px-4 py-3 text-portal-primary">{row.date}</td>
                  <td className="px-4 py-3 text-portal-primary">{row.employee_name}</td>
                  <td className="px-4 py-3 text-portal-primary">{row.project_name}</td>
                  <td className="px-4 py-3 text-portal-primary">{row.hours_worked}</td>
                  <td className="px-4 py-3 text-portal-primary">{row.billable ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-portal-primary capitalize">{row.status}</td>
                  <td className="px-4 py-3 text-portal-primary">{row.approved_by_name || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
