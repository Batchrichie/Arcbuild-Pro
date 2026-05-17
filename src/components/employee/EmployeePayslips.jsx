import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useEmployee } from '../../context/EmployeeContext'
import { formatGhs } from '../../lib/formatGhs'
import Payslip from '../Payslip'

const STATUS_STYLE = {
  draft: 'bg-slate-500/20 text-slate-300',
  reviewed: 'bg-blue-500/20 text-blue-200',
  approved: 'bg-violet-500/20 text-violet-200',
  posted: 'bg-emerald-500/20 text-emerald-200',
}

export default function EmployeePayslips({ initialLineId, onClearInitial }) {
  const { employee } = useEmployee()
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!employee?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('payroll_lines')
      .select(
        `id, gross_pay, paye, ssnit_employee, loan_deduction, other_deductions, net_pay, created_at,
         payroll_runs(pay_period_month, pay_period_year, period_start, period_end, status)`
      )
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })

    setRows(data ?? [])
    setLoading(false)
  }, [employee?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (initialLineId && rows.length) {
      const match = rows.find((r) => r.id === initialLineId)
      if (match) setSelected(match)
      onClearInitial?.()
    }
  }, [initialLineId, rows, onClearInitial])

  const deductions = (row) =>
    Number(row.paye || 0) + Number(row.ssnit_employee || 0) + Number(row.loan_deduction || 0) + Number(row.other_deductions || 0)

  const periodLabel = (run) => {
    if (!run) return 'Pay period'
    if (run.period_start && run.period_end) return `${run.period_start} → ${run.period_end}`
    return `${run.pay_period_month}/${run.pay_period_year}`
  }

  if (selected) {
    return (
      <div className="space-y-4 pb-4">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="min-touch text-sm text-orange-300"
        >
          ← Back to payslips
        </button>
        <div className="overflow-hidden rounded-2xl">
          <Payslip payrollLineId={selected.id} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-500">No payslips yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="min-touch w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-orange-400/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{periodLabel(row.payroll_runs)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Gross {formatGhs(row.gross_pay)} · Deductions {formatGhs(deductions(row))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-orange-200">{formatGhs(row.net_pay)}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[row.payroll_runs?.status] || STATUS_STYLE.draft}`}>
                      {row.payroll_runs?.status ?? 'draft'}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
