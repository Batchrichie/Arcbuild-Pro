import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useEmployee } from '../../context/EmployeeContext'
import { fetchAnnualLeaveEntitlement } from '../../lib/hr-config'
import { countWeekdays, EMPLOYEE_LEAVE_TYPES } from '../../lib/employee-utils'

const STATUS_BADGE = {
  pending: 'bg-amber-500/20 text-amber-200',
  approved: 'bg-emerald-500/20 text-emerald-200',
  rejected: 'bg-red-500/20 text-red-300',
}

const inputCls = 'w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2.5 text-sm text-white'

export default function EmployeeLeave() {
  const { employee } = useEmployee()
  const [balance, setBalance] = useState({ entitlement: 21, taken: 0, remaining: 21, pending: 0 })
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const daysRequested = countWeekdays(form.start_date, form.end_date)

  const load = useCallback(async () => {
    if (!employee?.id) return
    setLoading(true)
    const year = new Date().getFullYear()
    const entitlement = await fetchAnnualLeaveEntitlement()

    const [approvedRes, pendingRes, allRes] = await Promise.all([
      supabase
        .from('leave_requests')
        .select('days_requested')
        .eq('employee_id', employee.id)
        .eq('status', 'approved')
        .eq('leave_type', 'annual')
        .gte('start_date', `${year}-01-01`)
        .lte('end_date', `${year}-12-31`),
      supabase
        .from('leave_requests')
        .select('days_requested')
        .eq('employee_id', employee.id)
        .eq('status', 'pending'),
      supabase
        .from('leave_requests')
        .select('id, leave_type, start_date, end_date, days_requested, status, created_at')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false }),
    ])

    const taken = (approvedRes.data ?? []).reduce((s, r) => s + (r.days_requested || 0), 0)
    const pending = (pendingRes.data ?? []).reduce((s, r) => s + (r.days_requested || 0), 0)

    setBalance({ entitlement, taken, remaining: Math.max(0, entitlement - taken), pending })
    setHistory(allRes.data ?? [])
    setLoading(false)
  }, [employee?.id])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!employee?.id || daysRequested < 1) {
      setError('Select valid dates (weekdays only).')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const { data, error: err } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: employee.id,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        days_requested: daysRequested,
        status: 'pending',
      })
      .select('id')
      .single()

    if (err) {
      setError(err.message)
      setSubmitting(false)
      return
    }

    // TODO Phase 5: leave_requests.reason column
    if (form.reason.trim() && data?.id) {
      try {
        localStorage.setItem(`arcbuild_leave_reason_${data.id}`, form.reason.trim())
      } catch {
        /* ignore */
      }
    }

    setSuccess('Leave request submitted.')
    setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
    setSubmitting(false)
    load()
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Entitlement', value: balance.entitlement },
          { label: 'Taken', value: balance.taken },
          { label: 'Remaining', value: balance.remaining },
          { label: 'Pending', value: balance.pending },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border-soft bg-white/5 p-3 text-center">
            <p className="text-xs uppercase text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-semibold text-orange-200">{loading ? '—' : c.value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border-soft bg-white/5 p-4">
        <h3 className="font-semibold text-white">Apply for leave</h3>
        <select className={inputCls} value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
          {EMPLOYEE_LEAVE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input required type="date" className={inputCls} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <input required type="date" className={inputCls} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <p className="text-sm text-slate-400">Days requested (weekdays): <strong className="text-white">{daysRequested || 0}</strong></p>
        <textarea
          className={inputCls}
          rows={3}
          placeholder="Reason"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        {success && <p className="text-sm text-emerald-300">{success}</p>}
        <button type="submit" disabled={submitting} className="min-touch w-full rounded-full bg-orange-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </form>

      <section>
        <h3 className="mb-3 font-semibold text-white">Leave history</h3>
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No leave requests yet.</p>
        ) : (
          <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-border-soft">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border-soft text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">From</th>
                  <th className="px-3 py-3">To</th>
                  <th className="px-3 py-3">Days</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Applied</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-border-soft">
                    <td className="px-3 py-3 capitalize text-white">{row.leave_type}</td>
                    <td className="px-3 py-3 text-slate-400">{row.start_date}</td>
                    <td className="px-3 py-3 text-slate-400">{row.end_date}</td>
                    <td className="px-3 py-3 text-slate-400">{row.days_requested}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_BADGE[row.status]}`}>{row.status}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{new Date(row.created_at).toLocaleDateString('en-GH')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
