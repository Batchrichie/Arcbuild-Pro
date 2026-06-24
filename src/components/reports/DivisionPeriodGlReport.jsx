import { useEffect, useMemo, useState } from 'react'
import { formatGhs } from '../../lib/formatGhs'
import { parseDbError } from '../../lib/dbErrorMessage'
import { inputCls as clsInput } from '../../lib/portal-classes'
import {
  getDivisionFilterOptions,
  getGlByDivisionPeriod,
  groupGlByDivisionPeriod,
} from '../../services/divisionPeriodReportService'

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

function StatementBlock({ title, block }) {
  if (!block?.lines?.length) return null
  return (
    <div className="rounded-2xl border border-border-soft bg-portal-input p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-portal-info">{title}</h4>
        <span className="text-sm font-semibold text-portal-primary">GHS {formatGhs(block.total)}</span>
      </div>
      <div className="portal-table-scroll overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-portal-muted">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Account</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {block.lines.map((line) => (
              <tr key={`${line.account_code}-${line.amount}`} className="border-t border-border-soft">
                <td className="px-2 py-2 text-portal-muted">{line.account_code}</td>
                <td className="px-2 py-2 text-portal-primary">{line.account_name}</td>
                <td className="px-2 py-2 text-portal-muted">{line.account_type || '—'}</td>
                <td className="px-2 py-2 text-right tabular-nums text-portal-primary">GHS {formatGhs(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DivisionPeriodGlReport() {
  const now = new Date()
  const [divisions, setDivisions] = useState([])
  const [divisionId, setDivisionId] = useState('')
  const [fiscalYear, setFiscalYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getDivisionFilterOptions().then(setDivisions).catch((err) => setError(parseDbError(err)))
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getGlByDivisionPeriod({
          divisionId: divisionId || undefined,
          fiscalYear,
          month,
        })
        setRows(data)
      } catch (err) {
        setError(parseDbError(err))
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [divisionId, fiscalYear, month])

  const grouped = useMemo(() => groupGlByDivisionPeriod(rows), [rows])

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <p className="text-sm uppercase tracking-[0.22em] text-portal-muted">GL reporting</p>
        <h2 className="mt-2 text-2xl font-semibold text-portal-primary">Division & period GL report</h2>
        <p className="mt-2 text-sm text-portal-muted">
          Posted GL by division and fiscal period from <code className="text-portal-info">gl_by_division_period</code>, grouped by financial statement.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Division</span>
            <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} className={clsInput}>
              <option value="">All divisions</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>{division.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Fiscal year</span>
            <input type="number" min="2020" max="2100" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))} className={clsInput} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Month</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={clsInput}>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-portal-danger bg-portal-danger p-4 text-sm text-portal-danger">{error}</div>}

      {loading ? (
        <p className="text-sm text-portal-muted">Loading division GL data…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-portal-input p-6 text-sm text-portal-muted">No posted GL rows for the selected filters.</div>
      ) : (
        grouped.map((division) => {
          const statementKeys = Object.keys(division.statements).sort((a, b) => {
            const rank = (name) => (name === 'Income Statement' ? 0 : name === 'Balance Sheet' ? 1 : 2)
            return rank(a) - rank(b)
          })

          return (
            <section key={`${division.division_id}-${division.fiscal_year}-${division.period_month}`} className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-portal-primary">{division.division_name}</h3>
                <p className="text-sm text-portal-muted">FY {division.fiscal_year} · Month {division.period_month}</p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {statementKeys.map((statement) => (
                  <StatementBlock key={statement} title={statement} block={division.statements[statement]} />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
