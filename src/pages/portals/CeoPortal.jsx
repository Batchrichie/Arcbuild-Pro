import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ApprovalQueue from '../../components/ApprovalQueue'
import GeneralLedger from '../../components/GeneralLedger'
import FinancialStatements from '../../components/FinancialStatements'
import ProjectFinanceDashboard from '../../components/ProjectFinanceDashboard'
import ProjectCostLedger from '../../components/ProjectCostLedger'
import MilestoneManager from '../../components/MilestoneManager'

export default function CeoPortal() {
  const { profile, signOut } = useAuth()
  const [metrics, setMetrics] = useState({
    revenue: 0,
    pendingApprovals: 0,
    netProfit: 0,
    activeProjects: 0,
  })
  const [payrollRuns, setPayrollRuns] = useState([])
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  useEffect(() => {
    async function loadMetrics() {
      setLoadingMetrics(true)
      try {
        const [{ data: revenueData }, { data: approvalData }, { data: projectData }, { data: payrollData }] = await Promise.all([
          supabase
            .from('invoices')
            .select('gross_total_ghs', { count: 'exact' })
            .in('status', ['approved', 'paid']),
          supabase
            .from('invoices')
            .select('id', { count: 'exact' })
            .eq('status', 'pending_approval'),
          supabase
            .from('projects')
            .select('id', { count: 'exact' })
            .eq('status', 'active'),
          supabase
            .from('payroll_runs')
            .select('*')
            .order('period_end', { ascending: false })
            .limit(10),
        ])

        const revenue = (revenueData ?? []).reduce((sum, item) => sum + Number(item.gross_total_ghs || 0), 0)
        const activeProjects = projectData?.length || 0
        const pendingApprovals = approvalData?.length || 0

        setMetrics({
          revenue,
          pendingApprovals,
          netProfit: Math.round(revenue * 0.25),
          activeProjects,
        })
        setPayrollRuns(payrollData || [])
      } catch (error) {
        console.warn('CEO metrics load failed', error)
      } finally {
        setLoadingMetrics(false)
      }
    }

    loadMetrics()
  }, [])

  const stats = [
    {
      label: 'Revenue',
      value: metrics.revenue,
      suffix: 'GHS',
      highlight: 'text-amber-300',
    },
    {
      label: 'Pending Approvals',
      value: metrics.pendingApprovals,
      highlight: 'text-teal-300',
    },
    {
      label: 'Net Profit',
      value: metrics.netProfit,
      suffix: 'GHS',
      highlight: 'text-cyan-300',
    },
    {
      label: 'Active Projects',
      value: metrics.activeProjects,
      highlight: 'text-blue-300',
    },
  ]

  return (
    <div className="portal-shell">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="portal-sidebar rounded-4xl border border-white/10 p-6 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(245,166,35,0.12)] px-4 py-3 text-sm font-semibold text-amber-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-slate-950">AB</span>
                <span>ArcBuild Pro</span>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">CEO Dashboard</p>
              <p className="text-3xl font-semibold text-white">Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}.</p>
              <p className="text-sm leading-6 text-slate-400">Monitor approvals, revenue performance, and project status from a single executive workspace.</p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Quick actions</div>
                <div className="mt-4 space-y-3">
                  <a href="#milestones" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-rose-400/30 hover:bg-[rgba(244,63,94,0.08)]">Milestones</a>
                  <a href="#project-finance" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-purple-400/30 hover:bg-[rgba(168,85,247,0.08)]">Project finance</a>
                  <a href="#cost-ledger" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-400/30 hover:bg-[rgba(16,185,129,0.08)]">Cost ledger</a>
                  <a href="#payroll" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-indigo-400/30 hover:bg-[rgba(99,102,241,0.08)]">Payroll</a>
                  <a href="#pending-approvals" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-amber-400/30 hover:bg-[rgba(245,166,35,0.08)]">Pending approvals</a>
                  <a href="#ledger" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-teal-400/30 hover:bg-[rgba(20,184,166,0.08)]">General ledger</a>
                  <a href="#financial-statements" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-blue-400/30 hover:bg-[rgba(56,138,221,0.08)]">Financial statements</a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">User</p>
                    <p className="mt-2 font-semibold text-white">{profile?.full_name ?? 'CEO'}</p>
                    <p className="text-sm text-slate-400">{profile?.email ?? 'executive@arcbuild.com'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-amber-400/40 hover:bg-[rgba(245,166,35,0.16)]"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <main className="portal-main space-y-8">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((item) => (
                <div key={item.label} className="kpi-card">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className={`mt-4 text-3xl font-semibold ${item.highlight}`}>{item.value.toLocaleString()}</p>
                  {item.suffix && <span className="text-sm text-slate-400">{item.suffix}</span>}
                </div>
              ))}
            </section>

            <section id="milestones" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Execution Tracking</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Project Milestones</h2>
                </div>
              </div>
              <MilestoneManager userRole="ceo" userId={profile?.id} readOnly={true} />
            </section>

            <section id="project-finance" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Financial Oversight</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Project Finance Dashboard</h2>
                </div>
              </div>
              <ProjectFinanceDashboard userRole="ceo" currentUserProfileId={profile?.id} />
            </section>

            <section id="cost-ledger" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Cost Tracking</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Project Cost Ledger</h2>
                </div>
              </div>
              <ProjectCostLedger userRole="ceo" userId={profile?.id} />
            </section>

            <section id="payroll" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">People Operations</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Payroll Summary</h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Period</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Gross Pay</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">PAYE</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">SSNIT (Employee)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">SSNIT (Employer)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Net Pay</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRuns.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-4 text-center text-sm text-slate-400">No payroll runs</td>
                      </tr>
                    ) : (
                      payrollRuns.map((run) => (
                        <tr key={run.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-white">
                            {new Date(run.period_start).toLocaleDateString('en-GH')} to{' '}
                            {new Date(run.period_end).toLocaleDateString('en-GH')}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-300">
                            {(run.total_gross_pay || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-300">
                            {(run.total_paye || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-300">
                            {(run.total_ssnit_employee || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-300">
                            {(run.total_ssnit_employer || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-teal-300">
                            {(run.total_net_pay || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                run.status === 'posted' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {run.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div id="pending-approvals" className="space-y-6 rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Executive queue</p>
                  <h1 className="mt-2 text-3xl font-semibold text-white">Approval pipeline</h1>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(29,158,117,0.14)] px-4 py-2 text-sm font-semibold text-teal-200">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-(--color-success)" />
                  {loadingMetrics ? 'Loading metrics…' : `${metrics.pendingApprovals} awaiting review`}
                </div>
              </div>
              <ApprovalQueue />
            </div>

            <section id="ledger" className="space-y-8 rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Finance operations</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">General ledger</h2>
                </div>
              </div>
              <GeneralLedger readOnly={true} />
            </section>

            <section id="financial-statements" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Reports</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Financial statements</h2>
                </div>
              </div>
              <FinancialStatements />
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
