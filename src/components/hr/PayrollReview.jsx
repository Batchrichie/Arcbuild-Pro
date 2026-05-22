import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'

export default function PayrollReview() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payroll_runs')
      .select('id, status, pay_period_month, pay_period_year, period_start, period_end, total_gross_pay, total_net_pay, notes')
      .order('period_end', { ascending: false })
      .limit(12)
    setRuns(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Review payroll run status before accountant processing.</p>
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-border-soft">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Net</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border-soft">
                  <td className="px-4 py-3 text-white">
                    {r.period_start ? `${r.period_start} → ${r.period_end}` : `${r.pay_period_month}/${r.pay_period_year}`}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-400">{r.status}</td>
                  <td className="px-4 py-3">{formatGhs(r.total_gross_pay)}</td>
                  <td className="px-4 py-3">{formatGhs(r.total_net_pay)}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-500">{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
