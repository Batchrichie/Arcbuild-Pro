import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { LEAVE_TYPE_COLORS } from '../../lib/hr-config'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthMatrix(year, month) {
  const first = new Date(year, month, 1)
  const startPad = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export default function LeaveCalendar() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [leave, setLeave] = useState([])
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [hiddenEmployees, setHiddenEmployees] = useState(new Set())
  const [hiddenDepts, setHiddenDepts] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const start = new Date(cursor.year, cursor.month, 1).toISOString().split('T')[0]
    const end = new Date(cursor.year, cursor.month + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('leave_requests')
      .select(
        'id, employee_id, leave_type, start_date, end_date, employees(department, profiles:profile_id(full_name))'
      )
      .eq('status', 'approved')
      .lte('start_date', end)
      .gte('end_date', start)
    setLeave(data ?? [])
    const emps = await supabase
      .from('employees')
      .select('id, department, profiles:profile_id(full_name)')
      .eq('is_active', true)
    setEmployees(emps.data ?? [])
    setDepartments([...new Set((emps.data ?? []).map((e) => e.department).filter(Boolean))])
    setLoading(false)
  }, [cursor.year, cursor.month])

  useEffect(() => {
    load()
  }, [load])

  const visibleLeave = leave.filter((l) => {
    if (hiddenEmployees.has(l.employee_id)) return false
    const dept = l.employees?.department
    if (dept && hiddenDepts.has(dept)) return false
    return true
  })

  const eventsByDay = useMemo(() => {
    const map = {}
    visibleLeave.forEach((l) => {
      const start = new Date(l.start_date)
      const end = new Date(l.end_date)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() !== cursor.month || d.getFullYear() !== cursor.year) continue
        const key = d.getDate()
        if (!map[key]) map[key] = []
        map[key].push(l)
      }
    })
    return map
  }, [visibleLeave, cursor.month, cursor.year])

  const weeks = monthMatrix(cursor.year, cursor.month)
  const monthLabel = new Date(cursor.year, cursor.month).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })

  const toggleEmp = (id) => {
    setHiddenEmployees((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleDept = (dept) => {
    setHiddenDepts((prev) => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept)
      else next.add(dept)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setCursor((c) => ({ year: c.month === 0 ? c.year - 1 : c.year, month: c.month === 0 ? 11 : c.month - 1 }))} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">Prev</button>
        <h3 className="text-lg font-semibold text-white">{monthLabel}</h3>
        <button type="button" onClick={() => setCursor((c) => ({ year: c.month === 11 ? c.year + 1 : c.year, month: c.month === 11 ? 0 : c.month + 1 }))} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">Next</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <p className="font-semibold text-white">Departments</p>
          {departments.map((d) => (
            <label key={d} className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={!hiddenDepts.has(d)} onChange={() => toggleDept(d)} />
              {d}
            </label>
          ))}
          <p className="pt-2 font-semibold text-white">Employees</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {employees.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-slate-400">
                <input type="checkbox" checked={!hiddenEmployees.has(e.id)} onChange={() => toggleEmp(e.id)} />
                {e.profiles?.full_name}
              </label>
            ))}
          </div>
        </aside>

        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead>
                <tr>
                  {WEEKDAYS.map((w) => (
                    <th key={w} className="border border-white/10 bg-white/5 px-2 py-2 text-slate-500">{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => (
                      <td key={di} className="min-h-[4.5rem] align-top border border-white/10 p-1">
                        {day && (
                          <>
                            <span className="text-slate-500">{day}</span>
                            <ul className="mt-1 space-y-0.5">
                              {(eventsByDay[day] ?? []).slice(0, 3).map((ev) => (
                                <li key={ev.id} className={`truncate rounded px-1 py-0.5 ${LEAVE_TYPE_COLORS[ev.leave_type] || LEAVE_TYPE_COLORS.other}`} title={ev.employees?.profiles?.full_name}>
                                  {ev.employees?.profiles?.full_name?.split(' ')[0]}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
