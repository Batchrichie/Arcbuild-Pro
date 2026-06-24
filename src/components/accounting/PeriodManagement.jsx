import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { closeAccountingPeriod, getAccountingPeriods } from '../../services/accountingPeriodService'
import { parseDbError } from '../../lib/dbErrorMessage'
import Modal from '../ui/Modal'
import { inputCls as clsInput } from '../../lib/portal-classes'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CAN_CLOSE_ROLES = new Set(['ceo', 'accountant', 'director'])

function StatusPill({ status }) {
  const closed = status === 'CLOSED'
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        closed
          ? 'badge-portal badge-portal-muted'
          : 'badge-portal badge-portal-success'
      }`}
    >
      {status}
    </span>
  )
}

export default function PeriodManagement() {
  const { role } = useAuth()
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [closing, setClosing] = useState(false)

  const canClose = CAN_CLOSE_ROLES.has(role)

  const loadPeriods = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAccountingPeriods()
      setPeriods(data)
    } catch (err) {
      setError(parseDbError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPeriods()
  }, [loadPeriods])

  const handleClose = async () => {
    if (!confirmTarget) return
    setClosing(true)
    setError('')
    setMessage('')
    try {
      await closeAccountingPeriod(confirmTarget.id)
      setMessage(`${MONTH_NAMES[confirmTarget.month - 1]} ${confirmTarget.year} has been closed. This action cannot be undone from the UI.`)
      setConfirmTarget(null)
      await loadPeriods()
    } catch (err) {
      setError(parseDbError(err))
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-portal-muted">Finance controls</p>
            <h2 className="mt-2 text-2xl font-semibold text-portal-primary">Accounting period management</h2>
            <p className="mt-2 max-w-2xl text-sm text-portal-muted">
              Close periods once month-end work is complete. Closed periods block new journal entries for that month.
              Reopening a closed period is not available in this interface — closing is permanent.
            </p>
          </div>
          <span className="badge-portal badge-portal-warning uppercase tracking-wider">
            One-way close
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-portal-danger bg-portal-danger p-4 text-sm text-portal-danger">{error}</div>
      )}
      {message && (
        <div className="rounded-2xl border border-portal-success bg-portal-success p-4 text-sm text-portal-success">{message}</div>
      )}

      <div className="rounded-4xl panel-surface p-4 shadow-xl shadow-black/10">
        <div className="portal-table-scroll overflow-x-auto rounded-3xl border border-border-soft bg-portal-input">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-xs uppercase tracking-[0.24em] text-portal-muted">
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Closed</th>
                <th className="px-4 py-3">Closed by</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4 text-portal-muted">Loading accounting periods…</td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-portal-muted">No accounting periods found.</td>
                </tr>
              ) : (
                periods.map((period) => {
                  const isClosed = period.status === 'CLOSED'
                  return (
                    <tr
                      key={period.id}
                      className={`border-t border-border-soft ${isClosed ? 'bg-portal-overlay' : 'hover:bg-portal-overlay'}`}
                    >
                      <td className="px-4 py-3 text-portal-primary">{period.year}</td>
                      <td className="px-4 py-3 text-portal-primary">
                        {MONTH_NAMES[(period.month || 1) - 1]} ({period.month})
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={period.status} />
                      </td>
                      <td className="px-4 py-3 text-portal-muted">
                        {period.closed_at ? new Date(period.closed_at).toLocaleString('en-GB') : '—'}
                      </td>
                      <td className="px-4 py-3 text-portal-muted">
                        {period.profiles?.full_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isClosed ? (
                          <span className="text-xs text-portal-muted" title="Closed periods cannot be reopened from the UI">
                            Locked — no reopen
                          </span>
                        ) : canClose ? (
                          <button
                            type="button"
                            onClick={() => setConfirmTarget(period)}
                            className="min-touch rounded-full border border-border-soft bg-portal-warning px-3 py-2 text-xs font-semibold text-portal-warning transition hover:bg-portal-warning"
                          >
                            Close period
                          </button>
                        ) : (
                          <span className="text-xs text-portal-muted">View only</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(confirmTarget)}
        onClose={() => !closing && setConfirmTarget(null)}
        title="Close accounting period"
        size="md"
      >
        {confirmTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-portal-warning bg-portal-warning p-4 text-sm text-portal-warning">
              You are about to close <strong>{MONTH_NAMES[confirmTarget.month - 1]} {confirmTarget.year}</strong>.
              New journal entries dated in this period will be blocked. This cannot be undone from the UI.
            </div>
            <label className="block space-y-2 text-sm text-portal-muted">
              <span className="text-xs uppercase tracking-[0.16em] text-portal-muted">Type CLOSE to confirm</span>
              <input type="text" className={clsInput} id="period-close-confirm" placeholder="CLOSE" />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={closing}
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl border border-border-soft px-4 py-2 text-sm text-portal-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={closing}
                onClick={() => {
                  const input = document.getElementById('period-close-confirm')
                  if (input?.value?.trim().toUpperCase() !== 'CLOSE') {
                    setError('Type CLOSE to confirm period closure.')
                    return
                  }
                  handleClose()
                }}
                className="rounded-xl border border-border-soft bg-portal-warning px-4 py-2 text-sm font-semibold text-portal-warning disabled:opacity-50"
              >
                {closing ? 'Closing…' : 'Close period permanently'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
