import { Sparkles } from 'lucide-react'
import { formatGhsCompact } from '../../lib/formatGhs'
import EmptyState from '../ui/EmptyState'
import TimeframeToggle from '../ui/TimeframeToggle'

function TrendBadge({ trend }) {
  if (trend == null || Number.isNaN(trend)) return null
  const up = trend >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <span aria-hidden>{up ? '↑' : '↓'}</span>
      {Math.abs(trend).toFixed(1)}%
    </span>
  )
}

function KpiCard({ label, value, subLabel, colorClass, trend, alert }) {
  return (
    <div className={`kpi-card relative overflow-hidden ${alert ? 'ring-1 ring-red-400/40' : ''}`}>
      <p className="portal-kpi-label">{label}</p>
      <p className={`mt-3 text-2xl font-bold sm:text-3xl ${colorClass}`}>{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {subLabel && <span className="text-sm text-text-muted">{subLabel}</span>}
        <TrendBadge trend={trend} />
      </div>
    </div>
  )
}

export default function KpiStrip({ metrics, loading, timeframe, onTimeframeChange }) {
  if (loading) {
    return (
      <section className="space-y-4">
        <div className="h-11 w-full rounded-full bg-surface-overlay" />
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse">
              <div className="h-4 w-24 rounded bg-surface-overlay" />
              <div className="mt-4 h-8 w-32 rounded bg-surface-overlay" />
            </div>
          ))}
        </section>
      </section>
    )
  }

  const hasMetrics = metrics && Object.keys(metrics).length > 0

  if (!hasMetrics) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No KPI metrics available"
        description="Metrics are not available right now. Refresh or check back later after data has loaded."
      />
    )
  }

  const cards = [
    {
      label: metrics.revenueLabel || 'Revenue This Month',
      value: formatGhsCompact(metrics.revenueCurrent || 0),
      subLabel: metrics.revenueSubLabel || 'vs last month',
      colorClass: 'text-amber-300',
      trend: metrics.revenueTrend,
    },
    {
      label: metrics.invoiceLabel || 'Invoices Raised',
      value: String(metrics.invoiceCount ?? 0),
      subLabel: metrics.invoiceSubLabel || 'vs last period',
      colorClass: 'text-blue-300',
      trend: metrics.invoiceTrend,
    },
    {
      label: metrics.timesheetsLabel || 'Timesheets Submitted',
      value: String(metrics.timesheetCount ?? 0),
      subLabel: metrics.timesheetsSubLabel || 'vs last period',
      colorClass: 'text-emerald-300',
      trend: metrics.timesheetTrend,
    },
    {
      label: 'Outstanding Receivables',
      value: formatGhsCompact(metrics.outstandingReceivables),
      subLabel: metrics.receivablesOverdue ? 'Over 30 days overdue' : 'Sent invoices',
      colorClass: metrics.receivablesOverdue ? 'text-red-400' : 'text-text-primary',
      trend: metrics.receivablesTrend,
      alert: metrics.receivablesOverdue,
    },
    {
      label: 'Cash Position',
      value: formatGhsCompact(metrics.cashPosition),
      subLabel: 'Accounts 1101–1104',
      colorClass: 'text-emerald-300',
      trend: metrics.cashTrend,
    },
    {
      label: 'Active Projects',
      value: String(metrics.activeProjects),
      subLabel: 'In progress',
      colorClass: 'text-blue-300',
      trend: metrics.projectsTrend,
    },
    {
      label: 'Pending Approvals',
      value: String(metrics.pendingApprovals),
      subLabel: metrics.pendingApprovals > 0 ? 'Current queue' : 'Queue clear',
      colorClass: 'text-amber-300',
    },
    {
      label: 'Payroll This Month',
      value: formatGhsCompact(metrics.payrollThisMonth),
      subLabel: metrics.payrollPeriod || 'Latest posted run',
      colorClass: 'text-blue-300',
      trend: metrics.payrollTrend,
    },
  ]

  return (
    <section className="space-y-4">
      {typeof onTimeframeChange === 'function' ? (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">Filter revenue, invoice and timesheet metrics by timeframe.</p>
          <TimeframeToggle value={timeframe} onChange={onTimeframeChange} />
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </section>
    </section>
  )
}
