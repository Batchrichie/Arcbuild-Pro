import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ProjectFinanceDashboard from '../../components/ProjectFinanceDashboard'
import ProjectCostLedger from '../../components/ProjectCostLedger'
import MilestoneManager from '../../components/MilestoneManager'

export default function PmPortal() {
  const { profile, signOut } = useAuth()
  const [projects, setProjects] = useState([])
  const [metrics, setMetrics] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    teamSize: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPmData() {
      setLoading(true)
      try {
        const { data: projectData } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)

        setProjects(projectData ?? [])
        setMetrics({
          totalProjects: projectData?.length || 0,
          activeProjects: projectData?.filter(p => p.status === 'active').length || 0,
          completedProjects: projectData?.filter(p => p.status === 'completed').length || 0,
          teamSize: projectData?.reduce((sum, p) => sum + (Number(p.team_size) || 0), 0) || 0,
        })
      } catch (error) {
        console.warn('PM data load failed', error)
      } finally {
        setLoading(false)
      }
    }

    loadPmData()
  }, [])

  const stats = [
    {
      label: 'Total Projects',
      value: metrics.totalProjects,
      highlight: 'text-sky-300',
    },
    {
      label: 'Active Projects',
      value: metrics.activeProjects,
      highlight: 'text-cyan-300',
    },
    {
      label: 'Completed',
      value: metrics.completedProjects,
      highlight: 'text-emerald-300',
    },
  ]

  return (
    <div className="portal-shell">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="portal-sidebar rounded-4xl border border-white/10 p-6 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(34,211,238,0.12)] px-4 py-3 text-sm font-semibold text-cyan-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500 text-slate-950">AB</span>
                <span>ArcBuild Pro</span>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Project Management</p>
              <p className="text-3xl font-semibold text-white">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}.</p>
              <p className="text-sm leading-6 text-slate-400">Oversee all projects, manage teams, and track milestones in real-time.</p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Quick access</div>
                <div className="mt-4 space-y-3">
                  <a href="#milestones" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-rose-400/30 hover:bg-[rgba(244,63,94,0.08)]">Milestones</a>
                  <a href="#project-finance" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-purple-400/30 hover:bg-[rgba(168,85,247,0.08)]">Project finance</a>
                  <a href="#cost-ledger" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-400/30 hover:bg-[rgba(16,185,129,0.08)]">Cost ledger</a>
                  <a href="#projects" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-sky-400/30 hover:bg-[rgba(34,211,238,0.08)]">All projects</a>
                  <a href="#overview" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-[rgba(34,211,238,0.08)]">Portfolio view</a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">PM</p>
                    <p className="mt-2 font-semibold text-white">{profile?.full_name ?? 'Project Manager'}</p>
                    <p className="text-sm text-slate-400">{profile?.email ?? 'pm@arcbuild.com'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-sky-400/40 hover:bg-[rgba(34,211,238,0.16)]"
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

            <section id="milestones" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Execution</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Project Milestones</h2>
                </div>
              </div>
              <MilestoneManager userRole="project_manager" userId={profile?.id} />
            </section>

            <section id="project-finance" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Financial Tracking</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Project Finance Dashboard</h2>
                </div>
              </div>
              <ProjectFinanceDashboard userRole="project_manager" currentUserProfileId={profile?.id} />
            </section>

            <section id="cost-ledger" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Cost Tracking</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Project Cost Ledger</h2>
                </div>
              </div>
              <ProjectCostLedger userRole="project_manager" userId={profile?.id} />
            </section>

            <section id="projects" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Portfolio</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Project Overview</h2>
              </div>
              {loading ? (
                <div className="text-center text-slate-400">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="text-center text-slate-400">No projects</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <div key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/20">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{project.name}</h3>
                          <p className="mt-2 text-sm text-slate-400">{project.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          project.status === 'active' ? 'bg-sky-500/20 text-sky-300' :
                          project.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {project.status}
                        </span>
                        <span className="text-sm text-slate-400">{project.team_size || 0} members</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section id="overview" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Metrics</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Portfolio Status</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <p className="text-sm text-slate-400">Success rate</p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-300">
                    {metrics.totalProjects > 0 ? Math.round((metrics.completedProjects / metrics.totalProjects) * 100) : 0}%
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <p className="text-sm text-slate-400">Total team capacity</p>
                  <p className="mt-2 text-3xl font-semibold text-sky-300">{metrics.teamSize}</p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
