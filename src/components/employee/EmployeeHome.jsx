import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useEmployee } from '../../context/EmployeeContext'
import { formatGhs } from '../../lib/formatGhs'
import { fetchAnnualLeaveEntitlement } from '../../lib/hr-config'
import { firstName, greeting } from '../../lib/employee-utils'

export default function EmployeeHome({ onViewPayslip }) {
  const { employee, profile } = useEmployee()
  const [stats, setStats] = useState({ netPay: null, leaveRemaining: null, loanOutstanding: 0 })
  const [upcomingLeave, setUpcomingLeave] = useState([])
  const [recentLine, setRecentLine] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!employee?.id) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const year = new Date().getFullYear()

    const [lineRes, leaveRes, upcomingRes, loansRes, entitlement] = await Promise.all([
      supabase
        .from('payroll_lines')
        .select('id, basic_salary, paye, net_pay, payroll_run_id, created_at')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
        .limit(1),
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
        .select('leave_type, start_date, end_date, days_requested')
        .eq('employee_id', employee.id)
        .eq('status', 'approved')
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(3),
      supabase
        .from('staff_loans')
        .select('outstanding_balance')
        .eq('employee_id', employee.id)
        .eq('status', 'active'),
      fetchAnnualLeaveEntitlement(),
    ])

    const taken = (leaveRes.data ?? []).reduce((s, r) => s + (r.days_requested || 0), 0)
    const loanTotal = (loansRes.data ?? []).reduce((s, r) => s + Number(r.outstanding_balance || 0), 0)
    const line = lineRes.data?.[0] ?? null

    setStats({
      netPay: line?.net_pay ?? null,
      leaveRemaining: Math.max(0, entitlement - taken),
      loanOutstanding: loanTotal,
    })
    setUpcomingLeave(upcomingRes.data ?? [])
    setRecentLine(line)
    setLoading(false)
  }, [employee?.id])

  useEffect(() => {
    load()
  }, [load])

  const today = new Date().toLocaleDateString('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6 pb-4">
      <div className="rounded-3xl border border-orange-400/25 bg-gradient-to-br from-orange-500/15 to-transparent p-5">
        <p className="text-sm text-orange-200/80">{today}</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          {greeting()}, {firstName(profile?.full_name)}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {employee?.job_title ?? 'Team member'}
          {employee?.department ? ` · ${employee.department}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Last net pay', value: stats.netPay != null ? formatGhs(stats.netPay) : '—' },
          { label: 'Leave balance', value: loading ? '—' : `${stats.leaveRemaining} days` },
          { label: 'Loan outstanding', value: formatGhs(stats.loanOutstanding) },
        ].map((card) => (
          <div key={card.label} className="kpi-card">
            <p className="portal-eyebrow text-slate-500">{card.label}</p>
            <p className="mt-2 text-xl font-semibold text-orange-200">{card.value}</p>
          </div>
        ))}
      </div>

      {upcomingLeave.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">Upcoming leave</h3>
          <ul className="space-y-2">
            {upcomingLeave.map((l, i) => (
              <li key={`${l.start_date}-${i}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <span className="font-medium capitalize text-white">{l.leave_type}</span>
                <span className="text-slate-400">
                  {' '}
                  · {l.start_date} → {l.end_date} ({l.days_requested} days)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Recent payslip</h3>
        {loading ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-white/5" />
        ) : !recentLine ? (
          <p className="mt-3 text-sm text-slate-500">No payslips yet.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between text-slate-300">
                <span>Basic</span>
                <span>{formatGhs(recentLine.basic_salary)}</span>
              </li>
              <li className="flex justify-between text-slate-300">
                <span>PAYE</span>
                <span>{formatGhs(recentLine.paye)}</span>
              </li>
              <li className="flex justify-between font-semibold text-white">
                <span>Net pay</span>
                <span className="text-orange-200">{formatGhs(recentLine.net_pay)}</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => onViewPayslip?.(recentLine)}
              className="mt-4 min-touch w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-slate-950 sm:w-auto sm:px-6"
            >
              View full payslip
            </button>
          </>
        )}
      </section>
    </div>
  )
}
