import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ApprovalQueue from '../../components/ApprovalQueue'
import GeneralLedger from '../../components/GeneralLedger'
import FinancialStatements from '../../components/FinancialStatements'

export default function CeoPortal() {
  const { profile, signOut } = useAuth()
  const [metrics, setMetrics] = useState({
    revenue: 0,
    pendingApprovals: 0,
    netProfit: 0,
    activeProjects: 0,
  })
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  useEffect(() => {
    async function loadMetrics() {
      setLoadingMetrics(true)
      try {
        const [{ data: revenueData }, { data: approvalData }, { data: projectData }] = await Promise.all([
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
