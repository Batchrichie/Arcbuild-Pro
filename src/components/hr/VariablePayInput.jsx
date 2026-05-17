import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'
import { loadVariablePay, saveVariablePay, computeOvertimeAmount } from '../../lib/payroll-variables'

const cls = 'w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-white'

export default function VariablePayInput() {
  const [runs, setRuns] = useState([])
  const [runId, setRunId] = useState('')
  const [employees, setEmployees] = useState([])
  const [inputs, setInputs] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadRuns = useCallback(async () => {
    const { data } = await supabase
      .from('payroll_runs')
      .select('id, pay_period_month, pay_period_year, period_start, period_end, status, notes')
      .eq('status', 'draft')
      .order('period_end', { ascending: false })
    setRuns(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  const loadEmployees = useCallback(async () => {
    if (!runId) return
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('id, employee_number, basic_salary, profiles:profile_id(full_name)')
      .eq('is_active', true)
      .order('employee_number')
    setEmployees(data ?? [])
    const stored = loadVariablePay(runId)
    setInputs(stored.inputs ?? {})
    setSubmitted(stored.submitted ?? false)
    setLoading(false)
  }, [runId])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const setField = (empId, field, value) => {
    setInputs((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: value },
    }))
  }

  const handleSave = () => {
    saveVariablePay(runId, { inputs, submitted, submittedAt: null })
    setError(null)
  }

  const handleSubmit = async () => {
    if (!runId) return
    const stamp = new Date().toISOString()
    const run = runs.find((r) => r.id === runId)
    const noteLine = `[HR ${stamp}] Variable pay submitted for accountant review.`
    const notes = run?.notes ? `${run.notes}\n${noteLine}` : noteLine
    const { error: err } = await supabase.from('payroll_runs').update({ notes }).eq('id', runId)
    if (err) {
      setError(err.message)
      return
    }
    saveVariablePay(runId, { inputs, submitted: true, submittedAt: stamp })
    setSubmitted(true)
    loadRuns()
  }

  const periodLabel = (r) => {
    if (r.period_start && r.period_end) return `${r.period_start} → ${r.period_end}`
    return `${r.pay_period_month}/${r.pay_period_year}`
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Payroll status allows: draft, reviewed, approved, posted only — variable submission is recorded in run notes.
      </p>
      {error && <p className="text-sm text-red-300">{error}</p>}

      <select className={cls + ' max-w-md'} value={runId} onChange={(e) => setRunId(e.target.value)}>
        <option value="">Select draft payroll run</option>
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {periodLabel(r)}
          </option>
        ))}
      </select>

      {!runId ? (
        <p className="text-sm text-slate-500">Choose a draft run to enter variable pay.</p>
      ) : loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <>
          {submitted && (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
              Submitted to accountant — read-only.
            </p>
          )}
          <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">Employee</th>
                  <th className="px-3 py-3">Basic</th>
                  <th className="px-3 py-3">OT hours</th>
                  <th className="px-3 py-3">OT rate</th>
                  <th className="px-3 py-3">OT amount</th>
                  <th className="px-3 py-3">Bonus</th>
                  <th className="px-3 py-3">Deductions</th>
                  <th className="px-3 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const inp = inputs[emp.id] || {}
                  const otAmt = computeOvertimeAmount(inp.overtime_hours, inp.overtime_rate)
                  return (
                    <tr key={emp.id} className="border-b border-white/5">
                      <td className="px-3 py-3 text-white">{emp.profiles?.full_name ?? emp.employee_number}</td>
                      <td className="px-3 py-3 text-slate-400">{formatGhs(emp.basic_salary)}</td>
                      <td className="px-3 py-2">
                        <input disabled={submitted} type="number" className={cls} value={inp.overtime_hours ?? ''} onChange={(e) => setField(emp.id, 'overtime_hours', e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input disabled={submitted} type="number" className={cls} value={inp.overtime_rate ?? ''} onChange={(e) => setField(emp.id, 'overtime_rate', e.target.value)} />
                      </td>
                      <td className="px-3 py-3 text-violet-200">{formatGhs(otAmt)}</td>
                      <td className="px-3 py-2">
                        <input disabled={submitted} type="number" className={cls} value={inp.bonus_amount ?? ''} onChange={(e) => setField(emp.id, 'bonus_amount', e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input disabled={submitted} type="number" className={cls} value={inp.other_deductions ?? ''} onChange={(e) => setField(emp.id, 'other_deductions', e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input disabled={submitted} className={cls} value={inp.notes ?? ''} onChange={(e) => setField(emp.id, 'notes', e.target.value)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!submitted && (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleSave} className="rounded-full bg-violet-500/80 px-5 py-2.5 text-sm font-semibold text-white">
                Save Variables
              </button>
              <button type="button" onClick={handleSubmit} className="rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white">
                Submit to Accountant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
