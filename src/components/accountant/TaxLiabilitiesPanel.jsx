import { useState } from 'react'
import { formatGhs } from '../../lib/formatGhs'

const TAX_ITEMS = [
  { code: '2102', label: 'VAT Payable' },
  { code: '2103', label: 'NHIL Payable' },
  { code: '2104', label: 'GetFUND Payable' },
  { code: '2105', label: 'PAYE Payable' },
  { code: '2106', label: 'SSNIT Payable' },
]

export default function TaxLiabilitiesPanel({ balances, loading }) {
  const [filed, setFiled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('arcbuild_tax_filed') || '{}')
    } catch {
      return {}
    }
  })

  // TODO Phase 5: replace localStorage with tax_filings table for Mark as Filed persistence
  const markFiled = (code) => {
    const next = { ...filed, [code]: new Date().toISOString() }
    setFiled(next)
    localStorage.setItem('arcbuild_tax_filed', JSON.stringify(next))
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 p-4">
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 p-4">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">Tax liabilities</p>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Ledger balances</p>
      <ul className="mt-4 space-y-3">
        {TAX_ITEMS.map(({ code, label }) => {
          const amount = balances[code] || 0
          const warn = amount > 0 && !filed[code]
          const isFiled = Boolean(filed[code])
          return (
            <li key={code} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className={`text-sm ${warn ? 'font-semibold text-amber-200' : 'text-gray-500 dark:text-gray-400'}`}>
                {label}: GHS {formatGhs(amount)}
                {isFiled && <span className="ml-2 text-emerald-400">(Filed)</span>}
              </span>
              {amount > 0 && !isFiled && (
                <button
                  type="button"
                  onClick={() => markFiled(code)}
                  className="min-touch shrink-0 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1.5 text-sm font-medium text-teal-200 hover:bg-teal-500/20"
                >
                  Mark as Filed
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
