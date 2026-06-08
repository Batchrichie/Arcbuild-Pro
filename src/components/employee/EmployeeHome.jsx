import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useEmployee } from '../../context/EmployeeContext'
import { formatGhs } from '../../lib/formatGhs'
import { fetchAnnualLeaveEntitlement } from '../../lib/hr-config'
import { firstName, greeting } from '../../lib/employee-utils'

export default function EmployeeHome({ onViewPayslip, onOpenTimesheet, onOpenLeave }) {
  const { employee, profile } = useEmployee()

  const { data, isLoading } = useQuery({
    queryKey: ['employee-personal-hub', employee?.id, profile?.email],
    queryFn: async () => {
      if (!employee?.id) return null
      
      const today = new Date().toISOString().split('T')[0]
      const year = new Date().getFullYear()

      const [lineRes, leaveRes, upcomingRes, leaveRowsRes, loansRes, timesheetRes, alertsRes, entitlement] = await Promise.all([
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
          .from('leave_requests')
          .select('leave_type, days_requested')
          .eq('employee_id', employee.id)
          .eq('status', 'approved')
          .gte('start_date', `${year}-01-01`)
          .lte('end_date', `${year}-12-31`),
        supabase
          .from('staff_loans')
          .select('outstanding_balance, monthly_deduction, start_date')
          .eq('employee_id', employee.id)
          .eq('status', 'active')
          .order('start_date', { ascending: true }),
        supabase
          .from('timesheets')
          .select('id, status, work_date, hours_worked, submitted_at')
          .eq('employee_id', employee.id)
          .in('status', ['draft', 'submitted'])
          .order('work_date', { ascending: false })
          .limit(5),
        ...(profile?.email
          ? [
              supabase
                .from('alert_log')
                .select('id, subject, message, alert_type, sent_at')
                .or(`recipient_role.eq.employee,recipient_email.eq.${profile.email}`)
                .order('sent_at', { ascending: false })
                .limit(5),
            ]
          : [
              supabase
                .from('alert_log')
                .select('id, subject, message, alert_type, sent_at')
                .eq('recipient_role', 'employee')
                .order('sent_at', { ascending: false })
                .limit(5),
            ]),
        fetchAnnualLeaveEntitlement(employee.id),
      ])

      const taken = (leaveRes.data ?? []).reduce((s, r) => s + (r.days_requested || 0), 0)
      const loanList = loansRes.data ?? []
      const loanTotal = loanList.reduce((s, r) => s + Number(r.outstanding_balance || 0), 0)
      const nextDeduction = loanList[0]?.monthly_deduction ?? null
      const line = lineRes.data?.[0] ?? null

      const leaveGroups = (leaveRowsRes.data ?? []).reduce((acc, row) => {
        const type = row.leave_type || 'Other'
        acc[type] = (acc[type] || 0) + Number(row.days_requested || 0)
        return acc
      }, {})

      return {
        stats: {
          netPay: line?.net_pay ?? null,
          leaveRemaining: Math.max(0, entitlement - taken),
          loanOutstanding: loanTotal,
        },
        upcomingLeave: upcomingRes.data ?? [],
        recentLine: line,
        leaveSummary: Object.entries(leaveGroups).map(([leave_type, days]) => ({ leave_type, days })),
        loanSummary: {
          activeCount: loanList.length,
          outstanding: loanTotal,
          nextDeduction,
        },
        timesheetRows: timesheetRes.data ?? [],
        announcements: alertsRes.data ?? [],
      }
    },
    enabled: !!employee?.id,
    staleTime: 1000 * 60 * 2,
  })

  const stats = data?.stats || { netPay: null, leaveRemaining: 0, loanOutstanding: 0 }
  const upcomingLeave = data?.upcomingLeave || []
  const recentLine = data?.recentLine || null
  const leaveSummary = data?.leaveSummary || []
  const loanSummary = data?.loanSummary || { activeCount: 0, outstanding: 0, nextDeduction: null }
  const timesheetRows = data?.timesheetRows || []
  const announcements = data?.announcements || []
  const loading = isLoading

  const pendingDrafts = useMemo(
    () => timesheetRows.filter((row) => row.status === 'draft').length,
    [timesheetRows]
  )
  const awaitingApproval = useMemo(
    () => timesheetRows.filter((row) => row.status === 'submitted').length,
    [timesheetRows]
  )

  const today = new Date().toLocaleDateString('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6 pb-4">
      <div className="rounded-3xl border border-orange-400/25 bg-gradient-to-br from-orange-500/15 to-transparent p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-orange-200/80">{today}</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">
              {greeting()}, {firstName(profile?.full_name)}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Personal hub for your payroll, leave, timesheets, and company news.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenTimesheet}
              className="min-touch rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Log timesheet
            </button>
            <button
              type="button"
              onClick={onOpenLeave}
              className="min-touch rounded-full border border-orange-500/30 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Apply leave
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[{
              label: 'Pending timesheets',
              value: pendingDrafts || awaitingApproval ? `${pendingDrafts + awaitingApproval}` : '0',
              detail: pendingDrafts ? `${pendingDrafts} draft` : awaitingApproval ? `${awaitingApproval} submitted` : 'All caught up',
            }, {
              label: 'Next payslip',
              value: stats.netPay != null ? formatGhs(stats.netPay) : '—',
              detail: 'Latest posted pay',
            }, {
              label: 'Leave balance',
              value: loading ? '—' : `${stats.leaveRemaining} days`,
              detail: leaveSummary.length ? leaveSummary.map((item) => `${item.leave_type}: ${item.days}d`).join(', ') : 'Annual entitlement',
            }, {
              label: 'Loan outstanding',
              value: formatGhs(loanSummary.outstanding),
              detail: loanSummary.activeCount ? `${loanSummary.activeCount} active loan(s)` : 'No active loan',
            }].map((card) => (
              <div key={card.label} className={`kpi-card ${loading ? 'animate-pulse bg-slate-700' : ''}`}>
                <p className="portal-eyebrow text-slate-500">{card.label}</p>
                <p className="mt-2 text-xl font-semibold text-orange-200">{card.value}</p>
                <p className="mt-2 text-sm text-slate-400">{card.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-border-soft bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Pending timesheets</h3>
                  <p className="mt-1 text-sm text-slate-400">Finish drafts or review submitted entries.</p>
                </div>
                <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">
                  {pendingDrafts + awaitingApproval} open
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {timesheetRows.length === 0 ? (
                  <p className="text-sm text-slate-400">No open timesheets yet.</p>
                ) : (
                  timesheetRows.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-200">{row.work_date}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${row.status === 'draft' ? 'bg-slate-600 text-slate-100' : 'bg-amber-500/15 text-amber-200'}`}>
                          {row.status}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-400">{row.hours_worked} hrs</p>
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={onOpenTimesheet}
                className="mt-5 min-touch w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-slate-950"
              >
                Manage timesheets
              </button>
            </section>

            <section className="rounded-3xl border border-border-soft bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Leave balance</h3>
                  <p className="mt-1 text-sm text-slate-400">See approved leave by type.</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenLeave}
                  className="rounded-full border border-orange-500/30 bg-slate-950/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-200"
                >
                  Apply
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {leaveSummary.length === 0 ? (
                  <p className="text-sm text-slate-400">No leave taken this year yet.</p>
                ) : (
                  leaveSummary.map((item) => (
                    <div key={item.leave_type} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm">
                      <span className="text-slate-200 capitalize">{item.leave_type}</span>
                      <span className="text-slate-400">{item.days} days</span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                <p className="text-slate-400">Annual entitlement</p>
                <p className="mt-2 text-lg font-semibold text-white">{loading ? '—' : `${stats.leaveRemaining} days remaining`}</p>
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-border-soft bg-white/5 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Recent announcements</h3>
                <p className="mt-1 text-sm text-slate-400">Latest company notices.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {loading ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-700" />
                  ))}
                </>
              ) : announcements.length === 0 ? (
                <p className="text-sm text-slate-400">No announcements at the moment.</p>
              ) : (
                announcements.map((note) => (
                  <article key={note.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-sm font-semibold text-white">{note.subject || note.alert_type || 'Update'}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-300">{note.message || 'No details available.'}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{new Date(note.sent_at).toLocaleDateString('en-GH')}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-border-soft bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">Upcoming leave</h3>
            <p className="mt-1 text-sm text-slate-400">Approved leave coming up.</p>
            <div className="mt-4 space-y-3">
              {upcomingLeave.length === 0 ? (
                <p className="text-sm text-slate-400">No leave scheduled.</p>
              ) : (
                upcomingLeave.map((l, i) => (
                  <div key={`${l.start_date}-${i}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white capitalize">{l.leave_type}</p>
                      <span className="text-slate-400">{l.days_requested} days</span>
                    </div>
                    <p className="mt-2 text-slate-400">{l.start_date} → {l.end_date}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border-soft bg-white/5 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Loan summary</h3>
                <p className="mt-1 text-sm text-slate-400">Active loan information.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <span>Active loans</span>
                <span>{loanSummary.activeCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <span>Outstanding</span>
                <span>{formatGhs(loanSummary.outstanding)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <span>Next deduction</span>
                <span>{loanSummary.nextDeduction ? formatGhs(loanSummary.nextDeduction) : '—'}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
