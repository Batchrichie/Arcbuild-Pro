import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function ClientPortal() {
  const { profile, signOut } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadClientData() {
      setLoading(true)
      try {
        const [{ data: invoiceData }, { data: projectData }] = await Promise.all([
          supabase
            .from('invoices')
            .select('*')
            .eq('client_id', profile?.id)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('projects')
            .select('*')
            .eq('client_id', profile?.id)
            .order('created_at', { ascending: false })
            .limit(10),
        ])

        setInvoices(invoiceData ?? [])
        setProjects(projectData ?? [])
      } catch (error) {
        console.warn('Client data load failed', error)
      } finally {
        setLoading(false)
      }
    }

    if (profile?.id) loadClientData()
  }, [profile?.id])

  const stats = [
    {
      label: 'Total Invoices',
      value: invoices.length,
      highlight: 'text-teal-300',
    },
    {
      label: 'Active Projects',
      value: projects.filter(p => p.status === 'active').length,
      highlight: 'text-cyan-300',
    },
    {
      label: 'Paid Invoices',
      value: invoices.filter(i => i.status === 'paid').length,
      highlight: 'text-green-300',
    },
  ]

  return (
    <div className="portal-shell">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="portal-sidebar rounded-4xl border border-white/10 p-6 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(20,184,166,0.12)] px-4 py-3 text-sm font-semibold text-teal-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500 text-slate-950">AB</span>
                <span>ArcBuild Pro</span>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
              <p className="portal-eyebrow uppercase tracking-[0.28em] text-slate-500">Client Portal</p>
              <p className="text-3xl font-semibold text-white">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}.</p>
              <p className="text-sm leading-6 text-slate-400">View your projects, invoices, and payment status in one place.</p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Quick links</div>
                <div className="mt-4 space-y-3">
                  <a href="#projects" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-teal-400/30 hover:bg-[rgba(20,184,166,0.08)]">Projects</a>
                  <a href="#invoices" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-[rgba(34,211,238,0.08)]">Invoices</a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="portal-eyebrow uppercase tracking-[0.2em] text-slate-500">Account</p>
                    <p className="mt-2 font-semibold text-white">{profile?.full_name ?? 'Client'}</p>
                    <p className="text-sm text-slate-400">{profile?.email ?? 'client@arcbuild.com'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-teal-400/40 hover:bg-[rgba(20,184,166,0.16)]"
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
                  <p className="portal-eyebrow uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className={`mt-4 text-3xl font-semibold ${item.highlight}`}>{item.value}</p>
                </div>
              ))}
            </section>

            <section id="projects" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Your work</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Active Projects</h2>
              </div>
              {loading ? (
                <div className="text-center text-slate-400">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="text-center text-slate-400">No projects yet</div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{project.name}</h3>
                          <p className="mt-1 text-sm text-slate-400">{project.description}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          project.status === 'active' ? 'bg-green-500/20 text-green-300' :
                          project.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section id="invoices" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Billing</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Your Invoices</h2>
              </div>
              {loading ? (
                <div className="text-center text-slate-400">Loading invoices...</div>
              ) : invoices.length === 0 ? (
                <div className="text-center text-slate-400">No invoices</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Invoice #</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-white">{invoice.invoice_number}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-teal-300">{invoice.gross_total_ghs.toLocaleString()} GHS</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              invoice.status === 'paid' ? 'bg-green-500/20 text-green-300' :
                              invoice.status === 'pending_approval' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-slate-500/20 text-slate-300'
                            }`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">{new Date(invoice.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
