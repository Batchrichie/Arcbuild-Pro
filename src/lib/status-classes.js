/** Theme-aware status badges (readable in light and dark mode). */

const TRACK = {
  'On Track': 'border border-emerald-600/35 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500/40',
  'At Risk': 'border border-amber-600/35 bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-500/40',
  'Over Budget': 'border border-red-600/35 bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200 dark:border-red-500/40',
}

export function trackStatusClassName(status) {
  return TRACK[status] ?? 'border border-border-soft bg-surface-2 text-text-primary'
}

export function budgetTrackStatus(totalCosts, totalBudget) {
  const costs = Number(totalCosts) || 0
  const budget = Number(totalBudget) || 0
  if (budget <= 0) return { label: 'On Track', className: trackStatusClassName('On Track') }
  if (costs > budget) return { label: 'Over Budget', className: trackStatusClassName('Over Budget') }
  if (costs > budget * 0.9) return { label: 'At Risk', className: trackStatusClassName('At Risk') }
  return { label: 'On Track', className: trackStatusClassName('On Track') }
}

export function budgetVarianceStatus(variancePct) {
  if (variancePct > 0) return { label: 'On Track', className: trackStatusClassName('On Track') }
  if (Math.abs(variancePct) > 10) return { label: 'Over Budget', className: trackStatusClassName('Over Budget') }
  return { label: 'At Risk', className: trackStatusClassName('At Risk') }
}

export const ACCOUNT_STATUS_BADGE = {
  Active: 'border border-emerald-600/40 bg-emerald-100 text-emerald-900 font-semibold dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-500/40',
  Inactive: 'border border-slate-400/40 bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-500/40',
}
