/**
 * Shared Tailwind class strings for portal UI (semantic tokens).
 * Import in components instead of hardcoding slate-* / white/*.
 */

export const inputCls =
  'w-full min-w-0 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20'

/** Touch-friendly fields for mobile forms (readable text, adequate tap height). */
export const inputClsTouch =
  'w-full min-w-0 min-h-11 rounded-xl border border-border-soft bg-surface-2 px-4 py-3 text-base text-text-primary focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20'

export const selectClsTouch =
  'w-full min-w-0 min-h-11 rounded-xl border border-border-soft bg-surface-2 px-4 py-3 text-base text-text-primary focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20'

/** @deprecated Use ScrollableSelect instead of native <select> */
export const selectCls = inputCls

/** Currency / debit / credit — text input avoids clipped number spinners */
export const amountInputCls =
  'input-amount w-full min-w-0 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-base tabular-nums text-text-primary focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20'

export const inputClsRounded =
  'w-full min-w-0 rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-text-primary focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20'

export const cardInsetCls = 'rounded-2xl border border-border-soft bg-panel p-4'

export const cardElevatedCls = 'rounded-4xl border border-border-soft bg-surface shadow-card'

export const tableWrapCls = 'portal-table-scroll portal-table-wrap overflow-x-auto'

export const btnGhostCls =
  'min-touch rounded-full border border-border-soft bg-panel px-4 py-2 text-sm text-text-muted-strong transition hover:bg-surface-overlay'

export const textPrimary = 'text-text-primary'
export const textMuted = 'text-text-muted'
export const textMutedStrong = 'text-text-muted-strong'

/** Invoice list row actions — order: View → PDF → workflow */
export const invoiceActionViewCls =
  'inline-flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-surface-overlay'

export const invoiceActionPdfCls =
  'inline-flex items-center justify-center rounded-lg border border-amber-600/40 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/70'

export const invoiceActionPrimaryCls =
  'inline-flex items-center justify-center rounded-lg border border-indigo-600/40 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700'

export const invoiceActionSubmitCls =
  'inline-flex items-center justify-center rounded-lg border border-sky-600/40 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700'

export const invoiceActionMutedCls =
  'inline-flex items-center justify-center rounded-lg border border-border-soft bg-surface-3 px-3 py-1.5 text-xs font-semibold text-text-muted-strong transition hover:bg-surface-overlay'
