import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { liabilityBalance, formatGhs, formatGhsCompact } from '../../lib/formatGhs'
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
import ManualJournalList from '../../components/accounting/ManualJournalList'
import DebtorsLedger from '../../components/accounting/DebtorsLedger'
import AlertLog from '../../components/alerts/AlertLog'
import ClientRegistry from '../../pages/clients/ClientRegistry'
import ClientDetail from '../../pages/clients/ClientDetail'
import SupplierRegistry from '../../pages/suppliers/SupplierRegistry'
import SupplierDetail from '../../pages/suppliers/SupplierDetail'
import ProjectRegistry from '../../pages/projects/ProjectRegistry'
import PaymentsReceived from '../payments/PaymentsReceived'
import ChartOfAccounts from '../accounts/ChartOfAccounts'
import { COMPANY } from '../../lib/company-config'
import logo from '../../assets/ModuloDevLogo.png'
import ThemeToggle from '../../components/ui/ThemeToggle'
import PortalSidebarFooter from '../../components/ui/PortalSidebarFooter'
import KpiCard from '../../components/ui/KpiCard'
import {
  AlertTriangle,
  Banknote,
  Building2,
  ClipboardList,
  CreditCard,
  FileChartColumn,
  FileText,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MoreHorizontal,
  ReceiptText,
  ScrollText,
  Users,
} from 'lucide-react'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'approvals', label: 'Approvals', icon: ListChecks },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Building2 },
  { id: 'financials', label: 'Financials', icon: Banknote },
  { id: 'payments-received', label: 'Payments Received', icon: CreditCard },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: ReceiptText },
  { id: 'revenue', label: 'Revenue', icon: FileText },
  { id: 'banking', label: 'Banking', icon: Landmark },
  { id: 'journal-history', label: 'Journals', icon: ScrollText },
  { id: 'debtors-ledger', label: 'Debtors Ledger', icon: ClipboardList },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'tax-centre', label: 'Tax Centre', icon: Landmark },
  { id: 'reports', label: 'Reports', icon: FileChartColumn },
]

const DIVISION_NAMES = ['Construction', 'Architecture', 'Real Estate', 'Logistics']

function PortalIcon({ icon: Icon, className = 'h-4 w-4' }) {
  return <Icon className={className} aria-hidden />
}

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

function weekBounds(offset = 0) {
  const now = new Date()
  const date = new Date(now)
  const dayOfWeek = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7) + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const start = new Date(monday.setHours(0, 0, 0, 0))
  const end = new Date(sunday.setHours(23, 59, 59, 999))
  return { start: start.toISOString(), end: end.toISOString() }
}

function dayBounds(offset = 0) {
  const now = new Date()
  const day = new Date(now)
  day.setDate(now.getDate() + offset)
  const start = new Date(day.setHours(0, 0, 0, 0))
  const end = new Date(day.setHours(23, 59, 59, 999))
  return { start: start.toISOString(), end: end.toISOString() }
}

function getTimeframeBounds(timeframe, offset = 0) {
  if (timeframe === 'week') return weekBounds(offset)
  if (timeframe === 'day') return dayBounds(offset)
  return monthBounds(offset)
}

function getTimeframeLabels(timeframe) {
  if (timeframe === 'day') {
    return { current: 'Today', previous: 'Yesterday' }
  }
  if (timeframe === 'week') {
    return { current: 'This Week', previous: 'Last Week' }
  }
  return { current: 'This Month', previous: 'Last Month' }
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
  const [timeframe, setTimeframe] = useState('month')
  const [kpiMetrics, setKpiMetrics] = useState({})
  const [divisionData, setDivisionData] = useState({})
  const [projectHealth, setProjectHealth] = useState([])
  const [taxBalances, setTaxBalances] = useState({})
  const [slideOverProjectId, setSlideOverProjectId] = useState(null)
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
      const currentPeriod = getTimeframeBounds(timeframe)
      const previousPeriod = getTimeframeBounds(timeframe, -1)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)

      const [
        revenueCurrentRes,
        revenuePreviousRes,
        invoiceCurrentRes,
        invoicePreviousRes,
        timesheetCurrentRes,
        timesheetPreviousRes,
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
          .gte('created_at', currentPeriod.start)
          .lte('created_at', currentPeriod.end),
        supabase
          .from('invoices')
          .select('gross_total_ghs')
          .in('status', ['approved', 'sent', 'paid'])
          .gte('created_at', previousPeriod.start)
          .lte('created_at', previousPeriod.end),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', currentPeriod.start)
          .lte('created_at', currentPeriod.end),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', previousPeriod.start)
          .lte('created_at', previousPeriod.end),
        supabase
          .from('timesheets')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', currentPeriod.start)
          .lte('created_at', currentPeriod.end),
        supabase
          .from('timesheets')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', previousPeriod.start)
          .lte('created_at', previousPeriod.end),
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

      const revenueCurrent = sumInvoices(revenueCurrentRes.data)
      const revenuePrevious = sumInvoices(revenuePreviousRes.data)
      const invoiceCount = invoiceCurrentRes.count ?? 0
      const invoicePreviousCount = invoicePreviousRes.count ?? 0
      const timesheetCount = timesheetCurrentRes.count ?? 0
      const timesheetPreviousCount = timesheetPreviousRes.count ?? 0

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

      const timeframeLabels = getTimeframeLabels(timeframe)
      const taxMap = {}
      ;(taxRes.data ?? []).forEach((r) => {
        taxMap[r.account_code] = liabilityBalance(r.balance)
      })

      const projectRows = (projectsByDivRes.data ?? []).map((p) => ({
        division: p.division,
      }))

      const timeframeSuffix =
        timeframeLabels.current === 'Today'
          ? 'Today'
          : timeframeLabels.current === 'This Week'
          ? 'This Week'
          : 'This Month'
      const taxExposure = Object.values(taxMap).reduce((sum, value) => sum + Number(value || 0), 0)
      const revenueTrendPct = pctChange(revenueCurrent, revenuePrevious)
      const revenueTrendLabel = revenueTrendPct == null ? 'No prior period' : `${revenueTrendPct >= 0 ? '+' : ''}${revenueTrendPct.toFixed(1)}%`

      setKpiMetrics({
        revenueCurrent,
        revenueTrend: revenueTrendPct,
        revenueTrendLabel,
        revenueLabel: `Revenue ${timeframeSuffix}`,
        revenueSubLabel: `vs ${timeframeLabels.previous}`,
        invoiceCount,
        invoiceTrend: pctChange(invoiceCount, invoicePreviousCount),
        invoiceLabel: `Invoices ${timeframeSuffix}`,
        invoiceSubLabel: `vs ${timeframeLabels.previous}`,
        timesheetCount,
        timesheetTrend: pctChange(timesheetCount, timesheetPreviousCount),
        timesheetsLabel: `Timesheets ${timeframeSuffix}`,
        timesheetsSubLabel: `vs ${timeframeLabels.previous}`,
        outstandingReceivables,
        receivablesOverdue,
        receivablesTrend: null,
        cashPosition,
        cashTrend: null,
        taxExposure,
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
  }, [timeframe])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    const loadBankAccounts = async () => {
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
    loadBankAccounts()
  }, [])

  return (
    <div className="portal-shell min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:max-w-none lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          {/* Desktop sidebar */}
          <aside className="portal-sidebar hidden md:flex md:flex-col rounded-4xl border border-border-soft p-5 shadow-2xl shadow-black/20">
            <div className="mb-6 shrink-0">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-amber-bg px-4 py-3 text-sm font-semibold text-amber-200">
                <img src={logo} alt={COMPANY.shortName} className="h-10 w-10 rounded-2xl object-cover" />
                <span>{COMPANY.name}</span>
              </div>
            </div>

            <p className="portal-eyebrow uppercase tracking-[0.28em] text-slate-500">Executive</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {profile?.full_name ? profile.full_name : 'CEO'}
            </p>
            <p className="mt-1 text-sm text-slate-400">{profile?.email ?? ''}</p>

            <nav className="flex-1 overflow-y-auto space-y-2 max-h-[calc(100vh-16rem)] mt-8">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-touch w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'border-amber-400/40 bg-amber-bg text-amber-100'
                      : 'border-border-soft bg-white/5 text-slate-300 hover:border-amber-400/20'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <PortalSidebarFooter
              onSignOut={signOut}
              signOutClassName="border-border-soft bg-white/5 text-white hover:border-amber-400/40"
            />
          </aside>

          {/* Main */}
          <main className="portal-main portal-main-with-tabs min-w-0 w-full overflow-x-hidden pb-24 lg:pb-0 space-y-6 lg:space-y-8">
            {/* Mobile header */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="portal-eyebrow uppercase tracking-[0.2em] text-slate-500">CEO Command Centre</p>
                <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-white truncate">
                  {TABS.find((t) => t.id === activeTab)?.label ?? 'Dashboard'}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <ThemeToggle className="self-start" />
                <button
                  type="button"
                  onClick={signOut}
                  className="min-touch rounded-full border border-border-soft px-4 py-2 text-sm text-slate-300"
                >
                  Sign out
                </button>
              </div>
            </div>

            {activeTab === 'dashboard' && (
              <>
                <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 lg:p-8 shadow-sm">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="portal-section-eyebrow uppercase tracking-[0.24em] text-slate-500">Executive attention</p>
                      <h2 className="text-lg font-semibold text-white">Top priorities</h2>
                    </div>
                    <p className="text-sm text-slate-400">Click any tile to navigate to the relevant CEO view.</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <KpiCard
                      title="Cash position"
                      value={formatGhsCompact(kpiMetrics.cashPosition)}
                      loading={loading}
                      icon={Banknote}
                      accent="text-emerald-300"
                      actionLabel="View"
                      onClick={() => setActiveTab('banking')}
                    />
                    <KpiCard
                      title="Receivables risk"
                      value={formatGhsCompact(kpiMetrics.outstandingReceivables)}
                      loading={loading}
                      icon={AlertTriangle}
                      accent="text-amber-300"
                      actionLabel="Review"
                      onClick={() => setActiveTab('debtors-ledger')}
                    />
                    <KpiCard
                      title="Pending approvals"
                      value={String(kpiMetrics.pendingApprovals ?? 0)}
                      loading={loading}
                      icon={ListChecks}
                      accent="text-blue-300"
                      actionLabel="Approve"
                      onClick={() => setActiveTab('approvals')}
                    />
                    <KpiCard
                      title="Revenue trend"
                      value={kpiMetrics.revenueTrendLabel || '—'}
                      loading={loading}
                      icon={FileChartColumn}
                      accent="text-sky-300"
                      actionLabel="Explore"
                      onClick={() => setActiveTab('revenue')}
                    />
                    <KpiCard
                      title="Tax exposure"
                      value={formatGhsCompact(kpiMetrics.taxExposure)}
                      loading={loading}
                      icon={ReceiptText}
                      accent="text-violet-300"
                      actionLabel="Analyse"
                      onClick={() => setActiveTab('tax-centre')}
                    />
                  </div>
                </section>

                <KpiStrip
                  metrics={kpiMetrics}
                  loading={loading}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                />

                {/* Approvals: desktop only on dashboard scroll; mobile uses tab */}
                <section id="pending-approvals" className="hidden lg:block" aria-hidden={activeTab !== 'dashboard'}>
                  <SectionHeader title="Pending approvals" subtitle="Executive queue" />
                  <div className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
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
                <div className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6 lg:p-8">
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
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6 lg:p-8">
                <SectionHeader title="General ledger" subtitle="Read-only view" />
                <GeneralLedger readOnly />
              </section>
            )}

            {activeTab === 'payments-received' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <PaymentsReceived />
              </section>
            )}

            {activeTab === 'chart-of-accounts' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <ChartOfAccounts />
              </section>
            )}

            {activeTab === 'revenue' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <RevenueRecognitionDashboard />
              </section>
            )}

            {activeTab === 'banking' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6 lg:p-8">
                <SectionHeader title="Banking" subtitle="Bank accounts (read-only)" />
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm text-slate-200">
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
                          <tr key={a.id} className="border-t border-border-soft">
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
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Journal history" subtitle="Manual journal postings" />
                <ManualJournalList readOnly />
              </section>
            )}

            {activeTab === 'debtors-ledger' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Debtors Ledger" subtitle="Aged receivables" />
                <DebtorsLedger readOnly />
              </section>
            )}

            {activeTab === 'alerts' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Alerts" subtitle="Smart Alert System log" />
                <AlertLog readOnly />
              </section>
            )}

            {activeTab === 'tax-centre' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <TaxCentre readOnly />
              </section>
            )}

            {activeTab === 'clients' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Clients" subtitle="Client registry" />
                <ClientRegistry onViewClient={openClientDetail} />
              </section>
            )}

            {activeTab === 'client-detail' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
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
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <SectionHeader title="Suppliers" subtitle="Supplier registry" />
                <SupplierRegistry onViewSupplier={openSupplierDetail} />
              </section>
            )}

            {activeTab === 'supplier-detail' && (
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
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
              <section className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">
                <ManagementReports />
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="portal-mobile-nav md:hidden" aria-label="CEO navigation">
        <div className="mx-auto flex max-w-lg justify-around px-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileTab(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center min-h-[3rem] py-2 text-xs font-medium transition ${
                activeTab === tab.id ? 'text-amber-300' : 'text-slate-500'
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                <PortalIcon icon={tab.icon} />
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
              <MoreHorizontal className="h-4 w-4" aria-hidden />
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
          <div className="portal-drawer-sheet md:hidden">
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
            <ThemeToggle className="mb-4 w-full justify-center" />
            <div className="grid gap-2">
              {overflowTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id)
                    setMoreOpen(false)
                  }}
                  className="min-touch flex items-center gap-3 rounded-2xl border border-border-soft bg-white/5 px-4 py-3 text-left text-sm text-slate-200"
                >
                  <span aria-hidden><PortalIcon icon={tab.icon} /></span>
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
                className="min-touch rounded-full border border-border-soft px-4 py-2 text-sm text-slate-300"
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
