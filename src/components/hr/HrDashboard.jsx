import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
function daysUntil(dateStr) {
  if (!dateStr) return null
  const end = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24))
}

function urgencyClass(days) {
  if (days == null) return 'text-slate-300'
  if (days < 7) return 'text-red-300 font-semibold'
  if (days < 30) return 'text-amber-300'
  return 'text-slate-300'
}

const STATUS_BADGE = {
  pending: 'bg-amber-500/20 text-amber-200',
  approved: 'bg-emerald-500/20 text-emerald-200',
  rejected: 'bg-red-500/20 text-red-300',
}

export default function HrDashboard({ onNavigate }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState({
    activeEmployees: 0,
    contractsExpiring: 0,
    leavePending: 0,
    payrollDraft: 0,
  })
  const [expiring, setExpiring] = useState([])
  const [recentLeave, setRecentLeave] = useState([])
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const today = new Date()
      const in60 = new Date(today)
      in60.setDate(in60.getDate() + 60)
      const in60Str = in60.toISOString().split('T')[0]
      const todayStr = today.toISOString().split('T')[0]

      const [activeRes, expiringRes, leavePendingRes, leaveRecentRes, payrollRes] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase
          .from('employees')
          .select(
            'id, employee_number, job_title, department, termination_date, profiles:profile_id(full_name), division:division_id(name)'
          )
          .eq('is_active', true)
          .not('termination_date', 'is', null)
          .lte('termination_date', in60Str)
          .gte('termination_date', todayStr)
          .order('termination_date', { ascending: true }),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('leave_requests')
          .select(
            'id, leave_type, start_date, end_date, days_requested, status, created_at, employees(employee_number, profiles:profile_id(full_name))'
          )
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('payroll_runs').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
      ])

      setCards({
        activeEmployees: activeRes.count ?? 0,
        contractsExpiring: expiringRes.data?.length ?? 0,
        leavePending: leavePendingRes.count ?? 0,
        payrollDraft: payrollRes.count ?? 0,
      })
      setExpiring(expiringRes.data ?? [])
      setRecentLeave(leaveRecentRes.data ?? [])
    } catch (err) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const approveLeave = async (id) => {
    if (!profile?.id) return
    const { error: err } = await supabase
      .from('leave_requests')
      .update({ status: 'approved', approved_by: profile.id })
      .eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  const rejectLeave = async (id) => {
    const reason = window.prompt('Rejection reason (required):')
    if (!reason?.trim()) return
  // TODO Phase 5: persist rejection_reason on leave_requests
    try {
      localStorage.setItem(`arcbuild_leave_rejection_${id}`, reason.trim())
    } catch {
      /* ignore */
    }
    const { error: err } = await supabase
      .from('leave_requests')
      .update({ status: 'rejected', approved_by: profile.id })
      .eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  const actionCards = [
    { label: 'Active Employees', value: cards.activeEmployees, view: 'registry', accent: 'text-violet-300' },
    { label: 'Contracts Expiring', value: cards.contractsExpiring, view: 'compliance', accent: 'text-amber-300' },
    { label: 'Leave Pending Approval', value: cards.leavePending, view: 'leave-approvals', accent: 'text-pink-300' },
    { label: 'Payroll Draft Open', value: cards.payrollDraft, view: 'variable-pay', accent: 'text-blue-300' },
  ]

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {actionCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigate?.(card.view)}
            className="kpi-card text-left transition hover:border-violet-400/30"
          >
            <p className="portal-eyebrow uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${card.accent}`}>
              {loading ? '—' : card.value}
            </p>
          </button>
        ))}
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">Contracts expiring soon</h3>
        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
        ) : expiring.length === 0 ? (
          <p className="text-sm text-slate-500">No contracts ending in the next 60 days.</p>
        ) : (
          <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Job title</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Contract end</th>
                  <th className="px-4 py-3">Days left</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((row) => {
                  const days = daysUntil(row.termination_date)
                  return (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-white">{row.profiles?.full_name ?? row.employee_number}</td>
                      <td className="px-4 py-3 text-slate-400">{row.job_title ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{row.department ?? row.division?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{row.termination_date}</td>
                      <td className={`px-4 py-3 ${urgencyClass(days)}`}>{days ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">Recent leave requests</h3>
        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
        ) : recentLeave.length === 0 ? (
          <p className="text-sm text-slate-500">No leave requests yet.</p>
        ) : (
          <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {recentLeave.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white">
                      {row.employees?.profiles?.full_name ?? row.employees?.employee_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-400">{row.leave_type}</td>
                    <td className="px-4 py-3 text-slate-400">{row.start_date}</td>
                    <td className="px-4 py-3 text-slate-400">{row.end_date}</td>
                    <td className="px-4 py-3 text-slate-400">{row.days_requested}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'pending' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => approveLeave(row.id)}
                            className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectLeave(row.id)}
                            className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
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
