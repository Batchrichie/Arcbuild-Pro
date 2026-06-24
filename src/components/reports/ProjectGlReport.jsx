import { useEffect, useMemo, useState } from 'react'
import { formatGhs } from '../../lib/formatGhs'
import { parseDbError } from '../../lib/dbErrorMessage'
import { inputCls as clsInput } from '../../lib/portal-classes'
import {
  getGlByProject,
  getProjectFilterOptions,
  summarizeGlByProject,
} from '../../services/projectGlReportService'

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

function AccountTypeSection({ title, lines, total, accentClass }) {
  if (!lines.length) return null
  return (
    <div className="rounded-2xl border border-border-soft bg-portal-input p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className={`text-sm font-semibold uppercase tracking-[0.18em] ${accentClass}`}>{title}</h4>
        <span className="text-sm font-semibold text-portal-primary">GHS {formatGhs(total)}</span>
      </div>
      <div className="portal-table-scroll overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-portal-muted">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Account</th>
              <th className="px-2 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={`${line.account_code}-${line.amount}`} className="border-t border-border-soft">
                <td className="px-2 py-2 text-portal-muted">{line.account_code}</td>
                <td className="px-2 py-2 text-portal-primary">{line.account_name}</td>
                <td className="px-2 py-2 text-right tabular-nums text-portal-primary">GHS {formatGhs(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ProjectGlReport() {
  const now = new Date()
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getProjectFilterOptions().then(setProjects).catch((err) => setError(parseDbError(err)))
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getGlByProject({
          projectId: projectId || undefined,
          year,
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
  }, [projectId, year, month])

  const summaries = useMemo(() => summarizeGlByProject(rows), [rows])

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <p className="text-sm uppercase tracking-[0.22em] text-portal-muted">GL reporting</p>
        <h2 className="mt-2 text-2xl font-semibold text-portal-primary">Project GL report</h2>
        <p className="mt-2 text-sm text-portal-muted">Posted GL activity by project and period from <code className="text-portal-info">gl_by_project</code>.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Project</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={clsInput}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Year</span>
            <input type="number" min="2020" max="2100" value={year} onChange={(e) => setYear(Number(e.target.value))} className={clsInput} />
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
        <p className="text-sm text-portal-muted">Loading project GL data…</p>
      ) : summaries.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-portal-input p-6 text-sm text-portal-muted">No posted GL rows for the selected filters.</div>
      ) : (
        summaries.map((summary) => (
          <section key={`${summary.project_id}-${summary.period_year}-${summary.period_month}`} className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-portal-primary">{summary.project_name}</h3>
                <p className="text-sm text-portal-muted">
                  Period {summary.period_month}/{summary.period_year} · {summary.currency}
                </p>
              </div>
              <div className="grid gap-2 text-right text-sm sm:grid-cols-2">
                <p className="text-portal-success">Revenue: GHS {formatGhs(summary.totals.revenue)}</p>
                <p className="text-portal-danger">Expense: GHS {formatGhs(summary.totals.expense)}</p>
                <p className="text-portal-info">Asset: GHS {formatGhs(summary.totals.asset)}</p>
                <p className="font-semibold text-portal-primary">Net (Rev − Exp): GHS {formatGhs(summary.totals.net)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              <AccountTypeSection title="Revenue" lines={summary.revenue} total={summary.totals.revenue} accentClass="text-portal-success" />
              <AccountTypeSection title="Expense" lines={summary.expense} total={summary.totals.expense} accentClass="text-portal-danger" />
              <AccountTypeSection title="Asset" lines={summary.asset} total={summary.totals.asset} accentClass="text-portal-info" />
            </div>
          </section>
        ))
      )}
    </div>
  )
}
