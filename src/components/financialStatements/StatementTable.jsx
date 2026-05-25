import { formatStatementAmount } from '../../lib/financialStatements'

export function StatementSectionHeader({ children }) {
  return (
    <p className="mt-6 mb-2 text-xs font-medium uppercase tracking-[0.2em] text-text-muted first:mt-0">
      {children}
    </p>
  )
}

export function StatementLine({ label, amount, bold = false, className = '' }) {
  const showAmount = amount != null && amount !== ''
  const n = Number(amount) || 0
  const isNegative = showAmount && n < 0
  const amountCls = isNegative
    ? 'text-red-500 dark:text-red-400'
    : 'text-text-primary'

  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-4 border-b border-border-soft/60 py-2.5 ${className}`}
    >
      <span className={`text-sm ${bold ? 'font-semibold text-text-primary' : 'text-text-muted-strong'}`}>
        {label}
      </span>
      {showAmount ? (
        <span className={`tabular-nums text-sm ${bold ? 'font-semibold' : ''} ${amountCls}`}>
          GHS {formatStatementAmount(amount)}
        </span>
      ) : (
        <span className="w-8" aria-hidden />
      )}
    </div>
  )
}

export function StatementSubLine({ label, amount }) {
  return <StatementLine label={label} amount={amount} className="pl-3" />
}

export function StatementTotal({ label, amount, ok = false }) {
  const n = Number(amount) || 0
  const isNegative = n < 0
  const amountCls = ok
    ? 'text-teal-600 dark:text-teal-300'
    : isNegative
      ? 'text-red-500 dark:text-red-400'
      : 'text-text-primary'

  return (
    <div className="mt-2 flex min-h-11 items-center justify-between gap-4 border-t-2 border-border-soft pt-3">
      <span className="text-sm font-semibold text-text-primary">{label}</span>
      <span className={`tabular-nums text-sm font-semibold ${amountCls}`}>
        GHS {formatStatementAmount(amount)}
        {ok ? ' ✓' : ''}
      </span>
    </div>
  )
}

export function StatementPanel({ title, children, actions }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface/80 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {title ? <h3 className="text-base font-semibold text-text-primary">{title}</h3> : <span />}
        {actions}
      </div>
      {children}
    </div>
  )
}

export function TrialBalanceTable({ rows, totals }) {
  return (
    <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-border-soft">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border-soft bg-surface-2/80 text-left text-xs uppercase tracking-[0.16em] text-text-muted">
            <th className="px-4 py-3">Account Code</th>
            <th className="px-4 py-3">Account Name</th>
            <th className="px-4 py-3 text-right">Debits</th>
            <th className="px-4 py-3 text-right">Credits</th>
            <th className="px-4 py-3 text-right">Net (Dr − Cr)</th>
            <th className="px-4 py-3">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.account_code} className="border-b border-border-soft/50 hover:bg-surface-overlay/40">
              <td className="px-4 py-2.5 font-mono text-text-muted-strong">{r.account_code}</td>
              <td className="px-4 py-2.5 text-text-primary">{r.account_name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-text-primary">
                {formatStatementAmount(r.total_debits)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-text-primary">
                {formatStatementAmount(r.total_credits)}
              </td>
              <td
                className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                  r.net_balance < 0 ? 'text-red-500 dark:text-red-400' : 'text-text-primary'
                }`}
              >
                {formatStatementAmount(r.net_balance)}
              </td>
              <td className="px-4 py-2.5 text-xs text-text-muted">{r.account_type}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border-soft bg-surface-2/80 font-semibold">
            <td colSpan={2} className="px-4 py-3 text-text-primary">
              Totals
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-text-primary">
              {formatStatementAmount(totals.debits)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-text-primary">
              {formatStatementAmount(totals.credits)}
            </td>
            <td
              className={`px-4 py-3 text-right tabular-nums ${
                totals.debits - totals.credits < 0 ? 'text-red-500' : 'text-text-primary'
              }`}
            >
              {formatStatementAmount(totals.debits - totals.credits)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
