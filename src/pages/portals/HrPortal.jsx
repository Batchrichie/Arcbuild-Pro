import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PayrollRunManager from '../../components/PayrollRunManager'

export default function HrPortal() {
  const { profile, signOut } = useAuth()
  const [employees, setEmployees] = useState([])
  const [activeSection, setActiveSection] = useState('dashboard')
  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    activeProjects: 0,
    averageUtilization: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHrData() {
      setLoading(true)
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'employee')
          .order('created_at', { ascending: false })

        setEmployees(profileData ?? [])
        setMetrics({
          totalEmployees: profileData?.length || 0,
          activeProjects: profileData?.filter(e => e.status === 'active').length || 0,
          averageUtilization: 75,
        })
      } catch (error) {
        console.warn('HR data load failed', error)
      } finally {
        setLoading(false)
      }
    }

    loadHrData()
  }, [])

  const stats = [
    {
      label: 'Total Employees',
      value: metrics.totalEmployees,
      highlight: 'text-violet-300',
    },
    {
      label: 'Active Team Members',
      value: metrics.activeProjects,
      highlight: 'text-purple-300',
    },
    {
      label: 'Avg Utilization',
      value: `${metrics.averageUtilization}%`,
      highlight: 'text-pink-300',
    },
  ]

  return (
    <div className="portal-shell">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="portal-sidebar rounded-4xl border border-white/10 p-6 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(139,92,246,0.12)] px-4 py-3 text-sm font-semibold text-violet-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500 text-slate-950">AB</span>
                <span>ArcBuild Pro</span>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">HR workspace</p>
              <p className="text-3xl font-semibold text-white">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}.</p>
              <p className="text-sm leading-6 text-slate-400">Manage team, monitor utilization, and view employee information.</p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Navigation</div>
                <div className="mt-4 space-y-3">
                  <button onClick={() => setActiveSection('dashboard')} className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-violet-400/30 hover:bg-[rgba(139,92,246,0.08)] text-left">Employee directory</button>
                  <button onClick={() => setActiveSection('metrics')} className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-purple-400/30 hover:bg-[rgba(147,51,234,0.08)] text-left">Team metrics</button>
                  <button onClick={() => setActiveSection('payroll')} className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-blue-400/30 hover:bg-[rgba(59,130,246,0.08)] text-left">Payroll Management</button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">HR Manager</p>
                    <p className="mt-2 font-semibold text-white">{profile?.full_name ?? 'Manager'}</p>
                    <p className="text-sm text-slate-400">{profile?.email ?? 'hr@arcbuild.com'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-violet-400/40 hover:bg-[rgba(139,92,246,0.16)]"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <main className="portal-main space-y-8">
            {activeSection === 'dashboard' && (
              <>
                <section className="grid gap-4 sm:grid-cols-3">
                  {stats.map((item) => (
                    <div key={item.label} className="kpi-card">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                      <p className={`mt-4 text-3xl font-semibold ${item.highlight}`}>{item.value}</p>
                    </div>
                  ))}
                </section>

                <section id="directory" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
                  <div className="mb-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Team</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Employee Directory</h2>
                  </div>
                  {loading ? (
                    <div className="text-center text-slate-400">Loading employees...</div>
                  ) : employees.length === 0 ? (
                    <div className="text-center text-slate-400">No employees</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employees.map((emp) => (
                            <tr key={emp.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="px-4 py-3 text-sm text-white">{emp.full_name}</td>
                              <td className="px-4 py-3 text-sm text-slate-400">{emp.email}</td>
                              <td className="px-4 py-3 text-sm text-slate-300 capitalize">{emp.role}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                  emp.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-300'
                                }`}>
                                  {emp.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            {activeSection === 'metrics' && (
              <section id="metrics" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
                <div className="mb-6">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Analytics</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Team Metrics</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-sm text-slate-400">Total headcount</p>
                    <p className="mt-2 text-3xl font-semibold text-violet-300">{metrics.totalEmployees}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-sm text-slate-400">Team utilization</p>
                    <p className="mt-2 text-3xl font-semibold text-purple-300">{metrics.averageUtilization}%</p>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'payroll' && (
              <section className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
                <PayrollRunManager userRole="hr" userId={profile?.id} />
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
