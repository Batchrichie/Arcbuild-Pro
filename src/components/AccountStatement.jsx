import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { formatGhs } from '../lib/formatGhs'

function formatAmount(value) {
  if (value == null || value === '') return '—'
  return formatGhs(value)
}

export default function AccountStatement({ accountCode, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const open = Boolean(accountCode)

  useEffect(() => {
    if (!accountCode) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    fetchStatement()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [accountCode])

  async function fetchStatement() {
    setLoading(true)
    const { data, error } = await supabase
      .from('account_running_balance')
      .select('*')
      .eq('account_code', accountCode)
      .order('entry_date', { ascending: true })
      .limit(1000)

    if (error) {
      console.error('account statement fetch', error)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  const opening = rows.length ? Number(rows[0].running_balance || 0) - Number(rows[0].amount || 0) : 0
  const closing = rows.length ? Number(rows[rows.length - 1].running_balance || 0) : 0
  const sparkData = rows.map((r) => Number(r.running_balance || 0))
  const trendMin = sparkData.length ? Math.min(...sparkData) : 0
  const trendMax = sparkData.length ? Math.max(...sparkData) : 0
  const hasTrendVariance = sparkData.length > 1 && trendMax !== trendMin
  const showSparkChart = hasTrendVariance

  if (!open) return null

  return createPortal(
    <>
      <button
        type="button"
        className="portal-slide-over-backdrop"
        aria-label="Close account statement"
        onClick={onClose}
      />
      <aside
        className="portal-slide-over-panel portal-slide-over-panel--structured p-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-statement-title"
      >
        <header className="shrink-0 border-b border-border-soft px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="portal-eyebrow text-text-muted">General ledger</p>
              <h2 id="account-statement-title" className="portal-h2 mt-1 truncate">
                Account {accountCode}
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                Opening <span className="font-semibold text-text-primary">{formatAmount(opening)}</span>
                {' · '}
                Closing <span className="font-semibold text-text-primary">{formatAmount(closing)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-touch shrink-0 rounded-full border border-border-soft bg-surface-2 px-4 py-2 text-sm font-semibold text-text-muted-strong transition hover:bg-surface-overlay"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4 sm:px-6">
          {showSparkChart && (
            <div className="shrink-0 rounded-xl border border-border-soft bg-surface-2 px-3 py-2">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">Balance trend</p>
              <svg width="100%" height={40} className="block text-teal-600 dark:text-teal-400" aria-hidden>
                {(() => {
                  const range = trendMax - trendMin || 1
                  const stepX = 100 / (sparkData.length - 1)
                  return sparkData.map((v, i) => {
                    const x = i * stepX
                    const y = 34 - ((v - trendMin) / range) * 30
                    return <circle key={i} cx={`${x}%`} cy={y} r="2" fill="currentColor" />
                  })
                })()}
              </svg>
            </div>
          )}
          {!showSparkChart && sparkData.length > 0 && !loading && (
            <p className="shrink-0 text-xs text-text-muted">
              Balance trend:{' '}
              <span className="font-medium text-text-primary">{formatAmount(closing)}</span>
              {sparkData.length === 1 ? ' (single entry)' : ' (unchanged across period)'}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-text-muted">Loading statement…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-8 text-center text-sm text-text-muted">
              No transactions for this account.
            </p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border-soft bg-surface-2">
              <table className="dark-table w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 z-10 bg-surface-2">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">JE</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Description</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Debit</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Credit</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Running</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.ledger_id} className="border-t border-border-soft hover:bg-surface-overlay/50">
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-primary">{r.entry_date?.split('T')[0]}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-amber-700 dark:text-amber-300">{r.entry_number}</td>
                      <td className="max-w-[12rem] truncate px-3 py-2.5 text-text-primary sm:max-w-none sm:whitespace-normal">{r.description}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-text-primary">{formatAmount(r.debit_amount)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-text-primary">{formatAmount(r.credit_amount)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-text-primary">{formatAmount(r.running_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-border-soft bg-surface-2 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-muted">Closing balance</span>
            <span className="text-lg font-bold text-text-primary">{formatAmount(closing)}</span>
          </div>
        </footer>
      </aside>
    </>,
    document.body
  )
}
