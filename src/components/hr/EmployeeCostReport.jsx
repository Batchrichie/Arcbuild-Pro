import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'

export default function EmployeeCostReport() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('id, employee_number, department, basic_salary, monthly_allowances, profiles:profile_id(full_name), division:division_id(name)')
      .eq('is_active', true)
      .order('employee_number')
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const total = rows.reduce((s, r) => s + Number(r.basic_salary || 0) + Number(r.monthly_allowances || 0), 0)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Monthly employment cost (basic + allowances).</p>
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <>
          <p className="text-lg font-semibold text-violet-200">Total: {formatGhs(total)}</p>
          <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-border-soft">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border-soft text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Basic</th>
                  <th className="px-4 py-3">Allowances</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const line = Number(r.basic_salary || 0) + Number(r.monthly_allowances || 0)
                  return (
                    <tr key={r.id} className="border-b border-border-soft">
                      <td className="px-4 py-3 text-white">{r.profiles?.full_name}</td>
                      <td className="px-4 py-3 text-slate-400">{r.department ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{r.division?.name ?? '—'}</td>
                      <td className="px-4 py-3">{formatGhs(r.basic_salary)}</td>
                      <td className="px-4 py-3">{formatGhs(r.monthly_allowances)}</td>
                      <td className="px-4 py-3 font-medium text-violet-200">{formatGhs(line)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
