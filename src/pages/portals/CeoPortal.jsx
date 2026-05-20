import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { liabilityBalance, formatGhs } from '../../lib/formatGhs'
import ApprovalQueue from '../../components/ApprovalQueue'
import GeneralLedger from '../../components/GeneralLedger'
import ManagementReports from '../../components/reports/ManagementReports'
import ProjectFinanceDashboard from '../../components/ProjectFinanceDashboard'
import RevenueRecognitionDashboard from '../../pages/revenue/RevenueRecognitionDashboard'
import KpiStrip from '../../components/ceo/KpiStrip'
import DivisionPerformanceCards from '../../components/ceo/DivisionPerformanceCards'
import ProjectHealthTable from '../../components/ceo/ProjectHealthTable'
import TaxDueAlerts from '../../components/ceo/TaxDueAlerts'
import TaxCentre from '../../components/tax/TaxCentre'
import IssueLog from '../../components/pm/IssueLog'
import ManualJournalList from '../../components/accounting/ManualJournalList'
import DebtorsLedger from '../../components/accounting/DebtorsLedger'
import AlertLog from '../../components/alerts/AlertLog'
import ClientRegistry from '../../pages/clients/ClientRegistry'
import ClientDetail from '../../pages/clients/ClientDetail'
import SupplierRegistry from '../../pages/suppliers/SupplierRegistry'
import SupplierDetail from '../../pages/suppliers/SupplierDetail'
import ProjectRegistry from '../../pages/projects/ProjectRegistry'
import ChartOfAccounts from '../accounts/ChartOfAccounts'
import { COMPANY } from '../../lib/company-config'
import ThemeToggle from '../../components/ui/ThemeToggle'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'approvals', label: 'Approvals', icon: '✓' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'suppliers', label: 'Suppliers', icon: '🏢' },
  { id: 'financials', label: 'Financials', icon: '💰' },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: '🧾' },
  { id: 'revenue', label: 'Revenue', icon: '📑' },
  { id: 'banking', label: 'Banking', icon: '🏦' },
  { id: 'journal-history', label: 'Journals', icon: '📒' },
  { id: 'debtors-ledger', label: 'Debtors Ledger', icon: '📋' },
  { id: 'alerts', label: 'Alerts', icon: '🚨' },
  { id: 'tax-centre', label: 'Tax Centre', icon: '🏛️' },
  { id: 'reports', label: 'Reports', icon: '📈' },
]

const DIVISION_NAMES = ['Construction', 'Architecture', 'Real Estate', 'Logistics']

function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function monthBounds(offset = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function sumInvoices(rows, field = 'gross_total_ghs') {
  return (rows ?? []).reduce((s, r) => s + Number(r[field] || 0), 0)
}

function buildDivisionStats(incomeRows, projectRows) {
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const sixMonths = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    sixMonths.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GH', { month: 'short' }),
    })
  }

  const stats = {}
  DIVISION_NAMES.forEach((name) => {
    stats[name] = {
      revenueMonth: 0,
      revenueYtd: 0,
      activeProjects: 0,
      chartData: sixMonths.map((m) => ({ label: m.label, revenue: 0, monthKey: m.key })),
    }
  })

  ;(incomeRows ?? []).forEach((row) => {
    if (row.account_type !== 'revenue' || !row.division_name) return
    const name = row.division_name
    if (!stats[name]) return
    const amount = Number(row.amount) || 0
    const period = row.period_month ? String(row.period_month).slice(0, 7) : ''
    const periodDate = row.period_month ? new Date(row.period_month) : null

    if (period === currentMonthKey) {
      stats[name].revenueMonth += amount
    }
    if (periodDate && periodDate >= yearStart) {
      stats[name].revenueYtd += amount
    }

    const chartPoint = stats[name].chartData.find((c) => c.monthKey === period)
    if (chartPoint) chartPoint.revenue += amount
  })

  ;(projectRows ?? []).forEach((p) => {
    const divName = p.division?.name
    if (divName && stats[divName]) stats[divName].activeProjects += 1
  })

  Object.values(stats).forEach((s) => {
    s.chartData = s.chartData.map(({ label, revenue }) => ({ label, revenue }))
  })

  return stats
}

export default function CeoPortal() {
  const { profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [kpiMetrics, setKpiMetrics] = useState({})
  const [divisionData, setDivisionData] = useState({})
  const [projectHealth, setProjectHealth] = useState([])
  const [taxBalances, setTaxBalances] = useState({})
  const [slideOverProjectId, setSlideOverProjectId] = useState(null)
  const [projectsSubview, setProjectsSubview] = useState('health')
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankBalances, setBankBalances] = useState({})
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    try {
      document.title = `${COMPANY.appName} — CEO`
    } catch (err) {
      console.error(err)
    }
  }, [])

  const visibleTabs = TABS.slice(0, 4)
  const overflowTabs = TABS.slice(4)

  const openClientDetail = (clientId) => {
    setSelectedClientId(clientId)
    setActiveTab('client-detail')
    setMoreOpen(false)
  }

  const openSupplierDetail = (supplierId) => {
    setSelectedSupplierId(supplierId)
    setActiveTab('supplier-detail')
    setMoreOpen(false)
  }

  const handleMobileTab = (tabId) => {
    if (tabId === 'more') {
      setMoreOpen(true)
      return
    }

    setActiveTab(tabId)
    setMoreOpen(false)
  }

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const thisMonth = monthBounds(0)
      const lastMonth = monthBounds(-1)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)

      const [
        revenueThisRes,
        revenueLastRes,
        sentInvoicesRes,
        cashRes,
        activeProjectsRes,
        pendingRes,
        payrollRes,
        payrollLastRes,
        incomeRes,
        projectsByDivRes,
        healthRes,
        taxRes,
      ] = await Promise.all([
        supabase
          .from('invoices')
          .select('gross_total_ghs')
          .in('status', ['approved', 'sent', 'paid'])
          .gte('created_at', thisMonth.start)
          .lte('created_at', thisMonth.end),
        supabase
          .from('invoices')
          .select('gross_total_ghs')
          .in('status', ['approved', 'sent', 'paid'])
          .gte('created_at', lastMonth.start)
          .lte('created_at', lastMonth.end),
        supabase
          .from('invoices')
          .select('expected_receipt_ghs, created_at, due_date')
          .eq('status', 'sent'),
        supabase.from('balance_sheet').select('account_code, balance').in('account_code', ['1101', '1102', '1103', '1104']),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase
          .from('payroll_runs')
          .select('total_gross_pay, period_start, period_end')
          .eq('status', 'posted')
          .order('period_end', { ascending: false })
          .limit(1),
        supabase
          .from('payroll_runs')
          .select('total_gross_pay')
          .eq('status', 'posted')
          .order('period_end', { ascending: false })
          .range(1, 1),
        supabase
          .from('income_statement')
          .select('division_name, amount, period_month, account_type')
          .eq('account_type', 'revenue')
          .gte('period_month', sixMonthsAgo.toISOString()),
        supabase.from('projects').select('id, division:divisions(name)').eq('status', 'active'),
        supabase
          .from('project_finance_summary')
          .select('*')
          .order('total_outstanding_ghs', { ascending: false })
          .limit(10),
        supabase
          .from('balance_sheet')
          .select('account_code, balance')
          .in('account_code', ['2102', '2103', '2104', '2105', '2106']),
      ])

      const revenueThisMonth = sumInvoices(revenueThisRes.data)
      const revenueLastMonth = sumInvoices(revenueLastRes.data)

      const sentInvoices = sentInvoicesRes.data ?? []
      const outstandingReceivables = sentInvoices.reduce((s, r) => s + Number(r.expected_receipt_ghs || 0), 0)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const receivablesOverdue = sentInvoices.some((inv) => {
        const ref = inv.due_date || inv.created_at
        return ref && new Date(ref).getTime() < thirtyDaysAgo
      })

      const cashPosition = (cashRes.data ?? []).reduce((s, r) => s + Number(r.balance || 0), 0)

      const payrollRun = payrollRes.data?.[0]
      const payrollThisMonth = Number(payrollRun?.total_gross_pay || 0)
      const payrollLast = Number(payrollLastRes.data?.[0]?.total_gross_pay || 0)
      const payrollPeriod = payrollRun
        ? `${new Date(payrollRun.period_start).toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })}`
        : null

      const taxMap = {}
      ;(taxRes.data ?? []).forEach((r) => {
        taxMap[r.account_code] = liabilityBalance(r.balance)
      })

      const projectRows = (projectsByDivRes.data ?? []).map((p) => ({
        division: p.division,
      }))

      setKpiMetrics({
        revenueThisMonth,
        revenueTrend: pctChange(revenueThisMonth, revenueLastMonth),
        outstandingReceivables,
        receivablesOverdue,
        receivablesTrend: null,
        cashPosition,
        cashTrend: null,
        activeProjects: activeProjectsRes.count ?? 0,
        projectsTrend: null,
        pendingApprovals: pendingRes.count ?? 0,
        payrollThisMonth,
        payrollTrend: pctChange(payrollThisMonth, payrollLast),
        payrollPeriod,
      })

      setDivisionData(buildDivisionStats(incomeRes.data, projectRows))
      setProjectHealth(healthRes.data ?? [])
      setTaxBalances(taxMap)
    } catch (err) {
      console.warn('CEO dashboard load failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialize = async () => {
      await loadDashboardData()
      // load bank accounts for CEO banking read-only view
      try {
        const { data: accounts } = await supabase.from('bank_accounts').select('*').order('account_name')
        setBankAccounts(accounts || [])
        const codes = (accounts || []).map((a) => a.gl_account_code).filter(Boolean)
        if (codes.length) {
          const { data: rows } = await supabase
            .from('account_running_balance')
            .select('account_code,running_balance,entry_date')
            .in('account_code', [...new Set(codes)])
            .order('entry_date', { ascending: false })
          const grouped = {}
          ;(rows || []).forEach((r) => {
            if (!grouped[r.account_code]) grouped[r.account_code] = r.running_balance
          })
          setBankBalances(grouped)
        }
      } catch (err) {
        console.warn('Failed to load bank accounts for CEO view', err)
      }
    }
    initialize()
  }, [loadDashboardData])

  return (
    <div className="portal-shell overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Desktop sidebar */}
          <aside className="portal-sidebar hidden rounded-4xl border border-white/10 p-5 shadow-2xl shadow-black/20 lg:block">
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(245,166,35,0.12)] px-4 py-3 text-sm font-semibold text-amber-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-slate-950">AB</span>
                <span>{COMPANY.name}</span>
              </div>
            </div>

            <p className="portal-eyebrow uppercase tracking-[0.28em] text-slate-500">Executive</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {profile?.full_name ? profile.full_name : 'CEO'}
            </p>
            <p className="mt-1 text-sm text-slate-400">{profile?.email ?? ''}</p>

            <nav className="mt-8 space-y-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-touch w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'border-amber-400/40 bg-[rgba(245,166,35,0.12)] text-amber-100'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-amber-400/20'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={signOut}
              className="min-touch mt-8 w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:border-amber-400/40"
            >
              Sign Out
            </button>
          </aside>

          {/* Main */}
          <main className="portal-main portal-main-with-tabs min-w-0 overflow-x-hidden space-y-6 lg:space-y-8">
            {/* Mobile header */}
            <div className="flex items-center justify-between gap-4 lg:hidden">
              <div>
                <p className="portal-eyebrow uppercase tracking-[0.2em] text-slate-500">CEO Command Centre</p>
                <h1 className="text-xl font-semibold text-white">
                  {TABS.find((t) => t.id === activeTab)?.label ?? 'Dashboard'}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle className="self-start" />
                <button
                type="button"
                onClick={signOut}
                className="min-touch shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300"
              >
                Sign out
              </button>
              </div>
            </div>

            {activeTab === 'dashboard' && (
              <>
                <KpiStrip metrics={kpiMetrics} loading={loading} />

                {/* Approvals: desktop only on dashboard scroll; mobile uses tab */}
                <section id="pending-approvals" className="hidden lg:block" aria-hidden={activeTab !== 'dashboard'}>
                  <SectionHeader title="Pending approvals" subtitle="Executive queue" />
                  <div className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                    <ApprovalQueue />
                  </div>
                </section>

                <section id="divisions">
                  <SectionHeader title="Division performance" subtitle="Revenue by operating unit" />
                  <DivisionPerformanceCards divisionData={divisionData} loading={loading} />
                </section>

                <section id="project-health">
                  <SectionHeader title="Project health" subtitle="Top 10 by outstanding receivables" />
                  <ProjectHealthTable
                    projects={projectHealth}
                    loading={loading}
                    onSelectProject={setSlideOverProjectId}
                  />
                </section>

                <section id="tax-alerts">
                  <SectionHeader title="Tax due" subtitle="Ledger balances" />
                  <TaxDueAlerts balances={taxBalances} loading={loading} />
                </section>
              </>
            )}

            {activeTab === 'approvals' && (
              <section>
                <SectionHeader title="Pending approvals" subtitle="Review and approve invoices" />
                <div className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                  <ApprovalQueue />
                </div>
              </section>
            )}

            {activeTab === 'projects' && (
              <section className="space-y-6">
                <ProjectRegistry />
              </section>
            )}

            {activeTab === 'financials' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="General ledger" subtitle="Read-only view" />
                <GeneralLedger readOnly />
              </section>
            )}

            {activeTab === 'chart-of-accounts' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <ChartOfAccounts />
              </section>
            )}

            {activeTab === 'revenue' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <RevenueRecognitionDashboard />
              </section>
            )}

            {activeTab === 'banking' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Banking" subtitle="Bank accounts (read-only)" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-slate-200">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="px-3 py-3 text-left">Account</th>
                        <th className="px-3 py-3 text-left">Bank</th>
                        <th className="px-3 py-3 text-left">Account #</th>
                        <th className="px-3 py-3 text-left">Currency</th>
                        <th className="px-3 py-3 text-left">GL Code</th>
                        <th className="px-3 py-3 text-right">GL Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankAccounts.length === 0 ? (
                        <tr><td colSpan="6" className="p-4 text-center text-slate-400">No bank accounts registered.</td></tr>
                      ) : (
                        bankAccounts.map((a) => (
                          <tr key={a.id} className="border-t border-white/5">
                            <td className="px-3 py-3 text-slate-200">{a.account_name}</td>
                            <td className="px-3 py-3 text-slate-200">{a.bank_name}</td>
                            <td className="px-3 py-3 text-slate-200">{(a.account_number || '').slice(-4).padStart((a.account_number||'').length, '*')}</td>
                            <td className="px-3 py-3 text-slate-200">{a.currency}</td>
                            <td className="px-3 py-3 text-slate-200">{a.gl_account_code || '—'}</td>
                            <td className="px-3 py-3 text-right text-slate-200">{formatGhs(bankBalances[a.gl_account_code] ?? 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'journal-history' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Journal history" subtitle="Manual journal postings" />
                <ManualJournalList readOnly />
              </section>
            )}

            {activeTab === 'debtors-ledger' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Debtors Ledger" subtitle="Aged receivables" />
                <DebtorsLedger readOnly />
              </section>
            )}

            {activeTab === 'alerts' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Alerts" subtitle="Smart Alert System log" />
                <AlertLog readOnly />
              </section>
            )}

            {activeTab === 'tax-centre' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <TaxCentre readOnly />
              </section>
            )}

            {activeTab === 'clients' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Clients" subtitle="Client registry" />
                <ClientRegistry onViewClient={openClientDetail} />
              </section>
            )}

            {activeTab === 'client-detail' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <ClientDetail
                  clientId={selectedClientId}
                  onBack={() => {
                    setSelectedClientId(null)
                    setActiveTab('clients')
                    setMoreOpen(false)
                  }}
                />
              </section>
            )}

            {activeTab === 'suppliers' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Suppliers" subtitle="Supplier registry" />
                <SupplierRegistry onViewSupplier={openSupplierDetail} />
              </section>
            )}

            {activeTab === 'supplier-detail' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SupplierDetail
                  supplierId={selectedSupplierId}
                  onBack={() => {
                    setSelectedSupplierId(null)
                    setActiveTab('suppliers')
                    setMoreOpen(false)
                  }}
                />
              </section>
            )}

            {activeTab === 'reports' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <ManagementReports />
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="portal-mobile-nav lg:hidden" aria-label="CEO navigation">
        <div className="mx-auto flex max-w-lg justify-around px-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileTab(tab.id)}
              className={`flex min-h-11 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-sm font-medium transition ${
                activeTab === tab.id ? 'text-amber-300' : 'text-slate-500'
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleMobileTab('more')}
            className={`flex min-h-11 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-sm font-medium transition ${
              moreOpen ? 'text-amber-300' : 'text-slate-500'
            }`}
          >
            <span className="text-base leading-none" aria-hidden>
              ⋯
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            className="portal-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="portal-drawer-sheet lg:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">More</h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-sm text-slate-400"
              >
                Close
              </button>
            </div>
            <div className="grid gap-2">
              {overflowTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id)
                    setMoreOpen(false)
                  }}
                  className="min-touch flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200"
                >
                  <span aria-hidden>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Project finance slide-over */}
      {slideOverProjectId && (
        <>
          <button
            type="button"
            className="portal-slide-over-backdrop"
            aria-label="Close project detail"
            onClick={() => setSlideOverProjectId(null)}
          />
          <aside className="portal-slide-over-panel p-4 sm:p-6" role="dialog" aria-modal="true">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Project finance</h2>
              <button
                type="button"
                onClick={() => setSlideOverProjectId(null)}
                className="min-touch rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300"
              >
                Close
              </button>
            </div>
            <ProjectFinanceDashboard
              userRole="ceo"
              currentUserProfileId={profile?.id}
              initialProjectId={slideOverProjectId}
              hideProjectSelector
            />
          </aside>
        </>
      )}
    </div>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <p className="portal-section-eyebrow uppercase tracking-[0.24em]">{subtitle}</p>
      <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{title}</h2>
    </div>
  )
}
