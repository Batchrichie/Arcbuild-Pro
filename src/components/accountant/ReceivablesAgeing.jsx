import { formatGhsCompact } from '../../lib/formatGhs'

const BRACKETS = [
  { key: 'current', label: 'Current (0–30 days)' },
  { key: 'd31_60', label: '31–60 days' },
  { key: 'd61_90', label: '61–90 days' },
  { key: 'd90plus', label: '90+ days' },
]

function PanelShell({ title, subtitle, children }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 p-4">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
      {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

export default function ReceivablesAgeing({ data, loading }) {
  if (loading) {
    return (
      <PanelShell title="Receivables ageing">
        <div className="h-32 animate-pulse rounded-xl bg-white/5" />
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
              <span className="text-gray-500 dark:text-gray-400">{label}</span>
              <span className="text-right text-gray-700 dark:text-gray-200">
                <span className="font-semibold text-gray-900 dark:text-white">{row.count}</span>
                <span className="mx-1 text-slate-500">·</span>
                {formatGhsCompact(row.total)}
              </span>
            </li>
          )
        })}
      </ul>
    </PanelShell>
  )
}
