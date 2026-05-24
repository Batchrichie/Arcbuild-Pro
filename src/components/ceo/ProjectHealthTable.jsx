import { formatGhsCompact } from '../../lib/formatGhs'

function budgetStatus(totalCosts, totalBudget) {
  const costs = Number(totalCosts) || 0
  const budget = Number(totalBudget) || 0
  if (budget <= 0) return { label: 'On Track', className: 'bg-emerald-500/20 text-emerald-300' }
  if (costs > budget) return { label: 'Over Budget', className: 'bg-red-500/20 text-red-300' }
  if (costs > budget * 0.9) return { label: 'At Risk', className: 'bg-amber-500/20 text-amber-300' }
  return { label: 'On Track', className: 'bg-emerald-500/20 text-emerald-300' }
}

export default function ProjectHealthTable({ projects, loading, onSelectProject }) {
  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl border border-border-soft bg-panel" />
  }

  if (!projects?.length) {
    return (
      <p className="rounded-2xl border border-border-soft bg-panel px-4 py-8 text-center text-sm text-text-muted">
        No active project finance data to display.
      </p>
    )
  }

  return (
    <div className="portal-table-scroll portal-table-wrap overflow-hidden rounded-2xl border border-border-soft">
      <table className="dark-table w-full min-w-[640px] text-sm">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-text-muted">Project</th>
            <th className="hidden px-4 py-3 text-left text-sm font-semibold uppercase text-text-muted sm:table-cell">Division</th>
            <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-text-muted">Completion</th>
            <th className="hidden px-4 py-3 text-left text-sm font-semibold uppercase text-text-muted md:table-cell">Budget</th>
            <th className="px-4 py-3 text-right text-sm font-semibold uppercase text-text-muted">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((row) => {
            const status = budgetStatus(row.total_costs_ghs, row.total_budget_ghs)
            const pct = Math.min(100, Math.max(0, Number(row.financial_completion_pct) || 0))
            return (
              <tr
                key={row.project_id}
                onClick={() => onSelectProject(row.project_id)}
                className="cursor-pointer transition hover:bg-surface-overlay"
              >
                <td className="px-4 py-3 font-medium text-text-primary">{row.project_name}</td>
                <td className="hidden px-4 py-3 text-text-muted-strong sm:table-cell">{row.division_name || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 min-w-[4rem] max-w-[6rem] overflow-hidden rounded-full bg-surface-overlay">
                      <div
                        className="h-full rounded-full bg-blue-400"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-text-muted">{pct.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-amber-200">
                  {formatGhsCompact(row.total_outstanding_ghs)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
