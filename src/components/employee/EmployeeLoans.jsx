import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useEmployee } from '../../context/EmployeeContext'
import { formatGhs } from '../../lib/formatGhs'
import { buildLoanSchedule } from '../../lib/employee-utils'

export default function EmployeeLoans() {
  const { employee } = useEmployee()
  const [active, setActive] = useState([])
  const [settled, setSettled] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!employee?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('staff_loans')
      .select('*')
      .eq('employee_id', employee.id)
      .order('start_date', { ascending: false })

    const rows = data ?? []
    setActive(rows.filter((r) => r.status === 'active'))
    setSettled(rows.filter((r) => r.status !== 'active'))
    setLoading(false)
  }, [employee?.id])

  useEffect(() => {
    load()
  }, [load])

  const progressPct = (loan) => {
    const total = Number(loan.loan_amount) || 0
    const out = Number(loan.outstanding_balance) || 0
    if (total <= 0) return 0
    return Math.min(100, Math.round(((total - out) / total) * 100))
  }

  return (
    <div className="space-y-6 pb-4">
      <p className="text-sm text-slate-400">Loan applications are managed by HR. Contact HR for new requests.</p>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : active.length === 0 && settled.length === 0 ? (
        <p className="text-sm text-slate-500">No staff loans on record.</p>
      ) : (
        <>
          {active.map((loan) => {
            const pct = progressPct(loan)
            const schedule = buildLoanSchedule(loan)
            const open = expandedId === loan.id
            return (
              <article key={loan.id} className="rounded-2xl border border-orange-400/20 bg-white/5 p-4">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p><span className="text-slate-500">Loan amount</span><br /><span className="font-semibold text-white">{formatGhs(loan.loan_amount)}</span></p>
                  <p><span className="text-slate-500">Outstanding</span><br /><span className="font-semibold text-orange-200">{formatGhs(loan.outstanding_balance)}</span></p>
                  <p><span className="text-slate-500">Monthly deduction</span><br /><span className="text-slate-300">{formatGhs(loan.monthly_deduction)}</span></p>
                  <p><span className="text-slate-500">Start date</span><br /><span className="text-slate-300">{loan.start_date}</span></p>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Repaid</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : loan.id)}
                  className="mt-4 text-sm text-orange-300"
                >
                  {open ? 'Hide schedule' : 'View repayment schedule'}
                </button>
                {open && schedule.length > 0 && (
                  <div className="portal-table-scroll mt-3 overflow-x-auto rounded-xl border border-border-soft">
                    <table className="w-full min-w-[400px] text-xs">
                      <thead>
                        <tr className="border-b border-border-soft text-left text-slate-500">
                          <th className="px-3 py-2">Month</th>
                          <th className="px-3 py-2">Opening</th>
                          <th className="px-3 py-2">Deduction</th>
                          <th className="px-3 py-2">Closing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((row, i) => (
                          <tr key={i} className="border-b border-border-soft">
                            <td className="px-3 py-2 text-slate-300">{row.month}</td>
                            <td className="px-3 py-2">{formatGhs(row.opening)}</td>
                            <td className="px-3 py-2">{formatGhs(row.deduction)}</td>
                            <td className="px-3 py-2">{formatGhs(row.closing)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            )
          })}

          {settled.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase text-slate-500">Settled loans</h3>
              <ul className="space-y-2 opacity-60">
                {settled.map((loan) => (
                  <li key={loan.id} className="rounded-xl border border-border-soft bg-white/5 px-4 py-3 text-sm text-slate-400">
                    {formatGhs(loan.loan_amount)} · {loan.status} · started {loan.start_date}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
