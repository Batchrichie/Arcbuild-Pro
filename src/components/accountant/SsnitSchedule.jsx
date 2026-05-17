import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'

function periodLabel(run) {
  if (!run) return ''
  const start = new Date(run.period_start).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
  const end = new Date(run.period_end).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${start} – ${end}`
}

function periodFileSlug(run) {
  if (!run) return 'period'
  const d = new Date(run.period_end)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function SsnitSchedule() {
  const [run, setRun] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: runs } = await supabase
          .from('payroll_runs')
          .select('*')
          .eq('status', 'posted')
          .order('period_end', { ascending: false })
          .limit(1)

        const posted = runs?.[0]
        if (!posted) {
          setRun(null)
          setLines([])
          return
        }
        setRun(posted)

        const { data: payrollLines } = await supabase
          .from('payroll_lines')
          .select(
            `basic_salary, ssnit_employee, ssnit_employer,
            employee:employees(id, ssnit_number, employee_number, profiles(full_name))`
          )
          .eq('payroll_run_id', posted.id)

        setLines(payrollLines ?? [])
      } catch (err) {
        console.warn('SSNIT schedule load failed', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const rows = useMemo(
    () =>
      lines.map((line) => {
        const emp = Number(line.ssnit_employee || 0)
        const er = Number(line.ssnit_employer || 0)
        return {
          name: line.employee?.profiles?.full_name || line.employee?.employee_number || 'Unknown',
          ssnit: line.employee?.ssnit_number || '—',
          basic: Number(line.basic_salary || 0),
          employee: emp,
          employer: er,
          total: emp + er,
        }
      }),
    [lines]
  )

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          basic: acc.basic + r.basic,
          employee: acc.employee + r.employee,
          employer: acc.employer + r.employer,
          total: acc.total + r.total,
        }),
        { basic: 0, employee: 0, employer: 0, total: 0 }
      ),
    [rows]
  )

  const exportCsv = () => {
    const header = [
      'Employee Name',
      'SSNIT Number',
      'Basic Salary',
      'Employee Contribution (5.5%)',
      'Employer Contribution (13%)',
      'Total Contribution',
    ]
    const csvRows = [
      header.join(','),
      ...rows.map((r) =>
        [r.name, r.ssnit, r.basic, r.employee, r.employer, r.total]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
      [
        'TOTAL',
        '',
        totals.basic.toFixed(2),
        totals.employee.toFixed(2),
        totals.employer.toFixed(2),
        totals.total.toFixed(2),
      ].join(','),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SSNIT_Schedule_${periodFileSlug(run)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
  }

  if (!run) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
        No posted payroll run found. Post a payroll run to generate the SSNIT schedule.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">Period: {periodLabel(run)}</p>
        <button type="button" onClick={exportCsv} className="min-touch btn border-teal-400/30 bg-teal-500/15 text-teal-100">
          Export CSV
        </button>
      </div>
      <div className="portal-table-scroll rounded-2xl border border-white/10">
        <table className="dark-table min-w-[800px] text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-slate-400">Employee</th>
              <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-slate-400">SSNIT No.</th>
              <th className="px-4 py-3 text-right text-sm font-semibold uppercase text-slate-400">Basic</th>
              <th className="px-4 py-3 text-right text-sm font-semibold uppercase text-slate-400">Employee (5.5%)</th>
              <th className="px-4 py-3 text-right text-sm font-semibold uppercase text-slate-400">Employer (13%)</th>
              <th className="px-4 py-3 text-right text-sm font-semibold uppercase text-slate-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-white">{r.name}</td>
                <td className="px-4 py-3 text-slate-300">{r.ssnit}</td>
                <td className="px-4 py-3 text-right text-slate-300">{formatGhs(r.basic)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{formatGhs(r.employee)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{formatGhs(r.employer)}</td>
                <td className="px-4 py-3 text-right font-medium text-teal-200">{formatGhs(r.total)}</td>
              </tr>
            ))}
            <tr className="border-t border-white/20 bg-white/5 font-semibold">
              <td className="px-4 py-3 text-white" colSpan={2}>
                Totals
              </td>
              <td className="px-4 py-3 text-right text-white">{formatGhs(totals.basic)}</td>
              <td className="px-4 py-3 text-right text-white">{formatGhs(totals.employee)}</td>
              <td className="px-4 py-3 text-right text-white">{formatGhs(totals.employer)}</td>
              <td className="px-4 py-3 text-right text-teal-200">{formatGhs(totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">Submit to SSNIT by the last working day of the month.</p>
    </div>
  )
}
