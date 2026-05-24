/**
 * Shared Tailwind class strings for portal UI (semantic tokens).
 * Import in components instead of hardcoding slate-* / white/*.
 */

export const inputCls =
  'w-full rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20'

export const inputClsRounded =
  'w-full rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-text-primary focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20'

export const cardInsetCls = 'rounded-2xl border border-border-soft bg-panel p-4'

export const cardElevatedCls = 'rounded-4xl border border-border-soft bg-surface shadow-card'

export const tableWrapCls = 'portal-table-scroll portal-table-wrap overflow-x-auto'

export const btnGhostCls =
  'min-touch rounded-full border border-border-soft bg-panel px-4 py-2 text-sm text-text-muted-strong transition hover:bg-surface-overlay'

export const textPrimary = 'text-text-primary'
export const textMuted = 'text-text-muted'
export const textMutedStrong = 'text-text-muted-strong'
