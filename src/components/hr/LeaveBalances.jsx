import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAnnualLeaveEntitlement } from '../../lib/hr-config'

export default function LeaveBalances() {
  const [rows, setRows] = useState([])
  const [entitlement, setEntitlement] = useState(21)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const annual = await fetchAnnualLeaveEntitlement()
    setEntitlement(annual)
    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const [empRes, leaveRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, employee_number, profiles:profile_id(full_name)')
        .eq('is_active', true)
        .order('employee_number'),
      supabase
        .from('leave_requests')
        .select('employee_id, days_requested, leave_type')
        .eq('status', 'approved')
        .eq('leave_type', 'annual')
        .gte('start_date', yearStart)
        .lte('end_date', yearEnd),
    ])

    const taken = {}
    ;(leaveRes.data ?? []).forEach((l) => {
      taken[l.employee_id] = (taken[l.employee_id] || 0) + (l.days_requested || 0)
    })

    setRows(
      (empRes.data ?? []).map((e) => {
        const used = taken[e.id] || 0
        return {
          id: e.id,
          name: e.profiles?.full_name ?? e.employee_number,
          entitlement: annual,
          taken: used,
          remaining: Math.max(0, annual - used),
        }
      })
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Annual entitlement from system_config (default 21 days per Ghana Labour Act).
      </p>
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Entitlement</th>
                <th className="px-4 py-3">Taken</th>
                <th className="px-4 py-3">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">{r.name}</td>
                  <td className="px-4 py-3 text-slate-400">{r.entitlement}</td>
                  <td className="px-4 py-3 text-slate-400">{r.taken}</td>
                  <td className={`px-4 py-3 font-medium ${r.remaining <= 3 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {r.remaining}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
