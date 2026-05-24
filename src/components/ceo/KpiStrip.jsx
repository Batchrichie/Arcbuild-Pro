import { formatGhsCompact } from '../../lib/formatGhs'

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

export default function KpiStrip({ metrics, loading }) {
  if (loading) {
    return (
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kpi-card animate-pulse">
            <div className="h-4 w-24 rounded bg-surface-overlay" />
            <div className="mt-4 h-8 w-32 rounded bg-surface-overlay" />
          </div>
        ))}
      </section>
    )
  }

  const cards = [
    {
      label: 'Revenue This Month',
      value: formatGhsCompact(metrics.revenueThisMonth),
      subLabel: 'vs last month',
      colorClass: 'text-amber-300',
      trend: metrics.revenueTrend,
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
      subLabel: metrics.pendingApprovals > 0 ? 'Awaiting CEO action' : 'Queue clear',
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
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </section>
  )
}
