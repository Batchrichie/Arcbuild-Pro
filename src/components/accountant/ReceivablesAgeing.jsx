import { formatGhsCompact } from '../../lib/formatGhs'

const BRACKETS = [
  { key: 'current', label: 'Current (0–30 days)' },
  { key: 'd31_60', label: '31–60 days' },
  { key: 'd61_90', label: '61–90 days' },
  { key: 'd90plus', label: '90+ days' },
]

function PanelShell({ title, subtitle, children }) {
  return (
    <div className="rounded-3xl border border-portal-soft bg-portal-elevated dark:border-portal-soft dark:bg-portal-input p-4">
      <p className="text-sm font-semibold text-portal-primary dark:text-portal-primary">{title}</p>
      {subtitle && <p className="mt-0.5 text-sm text-portal-muted dark:text-portal-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

export default function ReceivablesAgeing({ data, loading }) {
  if (loading) {
    return (
      <PanelShell title="Receivables ageing">
        <div className="h-32 animate-pulse rounded-xl bg-portal-overlay" />
      </PanelShell>
    )
  }

  return (
    <PanelShell title="Receivables ageing" subtitle="Sent invoices">
      <ul className="space-y-3">
        {BRACKETS.map(({ key, label }) => {
          const row = data?.[key] || { count: 0, total: 0 }
          return (
            <li key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-portal-muted dark:text-portal-muted">{label}</span>
              <span className="text-right text-portal-primary dark:text-portal-primary">
                <span className="font-semibold text-portal-primary dark:text-portal-primary">{row.count}</span>
                <span className="mx-1 text-portal-muted">·</span>
                {formatGhsCompact(row.total)}
              </span>
            </li>
          )
        })}
      </ul>
    </PanelShell>
  )
}
