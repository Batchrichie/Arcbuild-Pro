import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  backfillMissingInvoiceJournals,
  correctReversedExpenseAccount,
  getGlIntegrityReport,
  runGlIntegrityRepair,
} from '../../services/glIntegrityService'
import { btnGhostCls } from '../../lib/portal-classes'
import { formatStatementAmount } from '../../lib/financialStatements'

export default function GlIntegrityBanner({ onRepaired }) {
  const { user } = useAuth()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [repairing, setRepairing] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getGlIntegrityReport()
      setReport(data)
    } catch (err) {
      console.error('GL integrity report failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRepair = async () => {
    if (!user?.id) return
    setRepairing(true)
    setMessage('')
    try {
      let result
      try {
        result = await runGlIntegrityRepair(user.id)
      } catch {
        const backfill = await backfillMissingInvoiceJournals(user.id)
        const util = await correctReversedExpenseAccount('6202', '1101', user.id, 'GL-FIX-6202')
        result = { backfill, utilities_correction: util }
      }

      const backfill = result?.backfill || result
      const util = result?.utilities_correction
      const revenueMap = backfill?.revenue_posting_map || result?.revenue_accounts_summary

      const parts = []
      if (backfill?.posted > 0) {
        parts.push(`Posted ${backfill.posted} invoice journal(s).`)
        if (revenueMap?.length) {
          console.table(revenueMap)
          parts.push(
            `Revenue COA credits: ${revenueMap
              .map((r) => `${r.invoice_number || r.revenue_account}→${r.revenue_account_credited || r.revenue_account}`)
              .join('; ')}`
          )
        }
      } else if (backfill?.errors?.length) {
        parts.push(`Invoice errors: ${backfill.errors.map((e) => `${e.invoice_number}: ${e.error}`).join('; ')}`)
      } else {
        parts.push('No missing invoice journals to backfill.')
      }

      if (util && !util?.skipped) {
        parts.push(`Utilities (6202) correction: ${util.success ? 'posted' : util.error || 'failed'}.`)
      }

      setMessage(parts.join(' '))
      await load()
      onRepaired?.()
    } catch (err) {
      setMessage(err.message || 'GL repair failed. Apply migrations 046–048 in Supabase, then retry.')
    } finally {
      setRepairing(false)
    }
  }

  if (loading || !report || report.balanced) return null

  const issues = Array.isArray(report.issues) ? report.issues : []

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
      <p className="text-sm font-semibold text-text-primary">General ledger needs attention</p>
      <p className="mt-2 text-sm text-text-muted">
        Trial balance difference:{' '}
        <strong className="text-text-primary">GHS {formatStatementAmount(Math.abs(report.difference || 0))}</strong>{' '}
        (Debits {formatStatementAmount(report.total_debits)} vs Credits {formatStatementAmount(report.total_credits)}).
        Financial statements cannot reconcile until the underlying journals are complete.
      </p>

      {issues.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-muted-strong">
          {issues.map((issue, idx) => (
            <li key={`${issue.code}-${idx}`}>{issue.message}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnGhostCls} onClick={handleRepair} disabled={repairing}>
          {repairing ? 'Repairing GL…' : 'Repair GL (invoices + utilities)'}
        </button>
        <button type="button" className={btnGhostCls} onClick={load} disabled={loading}>
          Re-check
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-teal-600 dark:text-teal-300">{message}</p>}

      <p className="mt-3 text-xs text-text-muted">
        Reversed manual journals (e.g. Utilities credited instead of debited) must be corrected in Journal History —
        reverse the entry and repost with debit expense, credit bank.
      </p>
    </div>
  )
}
