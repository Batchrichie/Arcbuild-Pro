import { formatGhs } from '../../lib/formatGhs'

const TAX_ACCOUNTS = [
  { code: '2102', label: 'VAT Payable' },
  { code: '2103', label: 'NHIL Payable' },
  { code: '2104', label: 'GetFUND Payable' },
  { code: '2105', label: 'PAYE Payable' },
  { code: '2106', label: 'SSNIT Payable' },
]

export default function TaxDueAlerts({ balances, loading }) {
  if (loading) {
    return <div className="h-24 animate-pulse rounded-2xl border border-border-soft bg-panel" />
  }

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 sm:p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-200">Tax obligations</p>
      <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
        {TAX_ACCOUNTS.map(({ code, label }) => {
          const amount = balances[code] || 0
          const warn = amount > 0
          return (
            <li
              key={code}
              className={`text-sm ${warn ? 'font-semibold text-amber-200' : 'text-text-muted'}`}
            >
              {label}: GHS {formatGhs(amount)}
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-sm text-text-muted">Contact your accountant to file returns.</p>
    </div>
  )
}
