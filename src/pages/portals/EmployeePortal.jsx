import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function EmployeePortal() {
  const { profile, signOut } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [metrics, setMetrics] = useState({
    activeAssignments: 0,
    completedTasks: 0,
    hoursLogged: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEmployeeData() {
      setLoading(true)
      try {
        const { data: assignmentData } = await supabase
          .from('project_assignments')
          .select('*')
          .eq('employee_id', profile?.id)
          .order('created_at', { ascending: false })

        setAssignments(assignmentData ?? [])
        setMetrics({
          activeAssignments: assignmentData?.filter(a => a.status === 'active').length || 0,
          completedTasks: assignmentData?.filter(a => a.status === 'completed').length || 0,
          hoursLogged: assignmentData?.reduce((sum, a) => sum + (Number(a.hours_allocated) || 0), 0) || 0,
        })
      } catch (error) {
        console.warn('Employee data load failed', error)
      } finally {
        setLoading(false)
      }
    }

    if (profile?.id) loadEmployeeData()
  }, [profile?.id])

  const stats = [
    {
      label: 'Active Assignments',
      value: metrics.activeAssignments,
      highlight: 'text-orange-300',
    },
    {
      label: 'Completed Tasks',
      value: metrics.completedTasks,
      highlight: 'text-green-300',
    },
    {
      label: 'Hours Allocated',
      value: metrics.hoursLogged,
      highlight: 'text-blue-300',
    },
  ]

  return (
    <div className="portal-shell">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="portal-sidebar rounded-4xl border border-white/10 p-6 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(249,115,22,0.12)] px-4 py-3 text-sm font-semibold text-orange-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-slate-950">AB</span>
                <span>ArcBuild Pro</span>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Employee workspace</p>
              <p className="text-3xl font-semibold text-white">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}.</p>
              <p className="text-sm leading-6 text-slate-400">Track your assignments, projects, and time allocation.</p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Navigation</div>
                <div className="mt-4 space-y-3">
                  <a href="#assignments" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-orange-400/30 hover:bg-[rgba(249,115,22,0.08)]">My assignments</a>
                  <a href="#overview" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-blue-400/30 hover:bg-[rgba(56,138,221,0.08)]">Overview</a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Employee</p>
                    <p className="mt-2 font-semibold text-white">{profile?.full_name ?? 'Team member'}</p>
                    <p className="text-sm text-slate-400">{profile?.email ?? 'employee@arcbuild.com'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-orange-400/40 hover:bg-[rgba(249,115,22,0.16)]"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <main className="portal-main space-y-8">
            <section className="grid gap-4 sm:grid-cols-3">
              {stats.map((item) => (
                <div key={item.label} className="kpi-card">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className={`mt-4 text-3xl font-semibold ${item.highlight}`}>{item.value}</p>
                </div>
              ))}
            </section>

            <section id="assignments" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Workload</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">My Assignments</h2>
              </div>
              {loading ? (
                <div className="text-center text-slate-400">Loading assignments...</div>
              ) : assignments.length === 0 ? (
                <div className="text-center text-slate-400">No assignments yet</div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{assignment.role || 'Assigned Role'}</h3>
                          <p className="mt-1 text-sm text-slate-400">Hours: {assignment.hours_allocated || 0}h</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          assignment.status === 'active' ? 'bg-green-500/20 text-green-300' :
                          assignment.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {assignment.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section id="overview" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Summary</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Work Distribution</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <p className="text-sm text-slate-400">Active this month</p>
                  <p className="mt-2 text-3xl font-semibold text-orange-300">{metrics.activeAssignments}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <p className="text-sm text-slate-400">Total hours allocated</p>
                  <p className="mt-2 text-3xl font-semibold text-blue-300">{metrics.hoursLogged}h</p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
