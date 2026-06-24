import { useEffect, useMemo, useState } from 'react'
import { formatGhs } from '../../lib/formatGhs'
import { parseDbError } from '../../lib/dbErrorMessage'
import { getSubledgerGlReconciliation, partitionReconciliationRows } from '../../services/reconciliationReportService'

function statusBadgeClass(status) {
  const s = String(status || '').toUpperCase()
  if (s === 'ORPHAN') return 'bg-portal-danger text-portal-danger border-portal-danger'
  if (s === 'DISCREPANCY') return 'bg-portal-warning text-portal-warning border-portal-warning'
  if (s === 'MATCHED') return 'bg-portal-success text-portal-success border-portal-success'
  return 'bg-portal-overlay text-portal-muted border-portal-soft'
}

function ReconciliationTable({ rows, highlight = false }) {
  if (!rows.length) return null

  const sample = rows[0]
  const columns = Object.keys(sample).filter((key) => !key.startsWith('_'))

  return (
    <div className={`portal-table-scroll overflow-x-auto rounded-3xl border ${highlight ? 'border-portal-danger' : 'border-border-soft'} bg-portal-input`}>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border-soft text-left text-xs uppercase tracking-[0.2em] text-portal-muted">
            {columns.map((col) => (
              <th key={col} className="px-3 py-3 whitespace-nowrap text-portal-muted">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx} className="border-t border-border-soft hover:bg-portal-overlay">
              {columns.map((col) => {
                const value = row[col]
                if (col === 'reconciliation_status' || col === 'match_status') {
                  return (
                    <td key={col} className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(value)}`}>
                        {value}
                      </span>
                    </td>
                  )
                }
                if (col === 'period_status') {
                  const closed = String(value).toUpperCase() === 'CLOSED'
                  return (
                    <td key={col} className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${closed ? 'bg-portal-overlay text-portal-muted' : 'bg-portal-info text-portal-info'}`}>
                        {value || '—'}
                      </span>
                    </td>
                  )
                }
                if (typeof value === 'number' && /amount|balance|variance|total/i.test(col)) {
                  return (
                    <td key={col} className="px-3 py-3 tabular-nums text-portal-primary">
                      GHS {formatGhs(value)}
                    </td>
                  )
                }
                return (
                  <td key={col} className="px-3 py-3 text-portal-primary whitespace-nowrap">
                    {value == null || value === '' ? '—' : String(value)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SubledgerReconciliationReport() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getSubledgerGlReconciliation()
        setRows(data)
      } catch (err) {
        setError(parseDbError(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const { issues, matched } = useMemo(() => partitionReconciliationRows(rows), [rows])

  return (
    <div className="space-y-6">
      <div className="rounded-4xl border border-portal-info bg-portal-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-portal-info">Finance team only</p>
            <h2 className="mt-2 text-2xl font-semibold text-portal-primary">Subledger ↔ GL reconciliation</h2>
            <p className="mt-2 max-w-3xl text-sm text-portal-muted">
              Read-only diagnostic report from <code className="text-portal-info">v_subledger_gl_reconciliation</code>.
              ORPHAN and DISCREPANCY rows require investigation before period close. VOID entries are excluded at source.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-right text-sm">
            <span className="badge-portal badge-portal-danger">
              {issues.filter((r) => String(r.reconciliation_status || r.match_status).toUpperCase() === 'ORPHAN').length} ORPHAN
            </span>
            <span className="badge-portal badge-portal-warning">
              {issues.filter((r) => String(r.reconciliation_status || r.match_status).toUpperCase() === 'DISCREPANCY').length} DISCREPANCY
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-portal-danger bg-portal-danger/10 p-4 text-sm text-portal-danger">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-portal-muted">Loading reconciliation data…</p>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-portal-danger">Requires attention</h3>
              <span className="rounded-full bg-portal-danger/20 px-3 py-1 text-xs font-semibold text-portal-danger">
                {issues.length} row{issues.length === 1 ? '' : 's'}
              </span>
            </div>
            {issues.length === 0 ? (
              <div className="rounded-2xl border border-portal-success bg-portal-success/10 p-4 text-sm text-portal-success">
                No ORPHAN or DISCREPANCY rows — subledger and GL are aligned for all surfaced entries.
              </div>
            ) : (
              <ReconciliationTable rows={issues} highlight />
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-portal-primary">Matched / other rows</h3>
            {matched.length === 0 ? (
              <p className="text-sm text-portal-muted">No additional rows.</p>
            ) : (
              <ReconciliationTable rows={matched} />
            )}
          </section>
        </>
      )}
    </div>
  )
}
