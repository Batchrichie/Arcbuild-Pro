import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useClient } from '../../context/ClientContext'
import { formatGhs, PROJECT_STATUS_STYLE, MILESTONE_STATUS_STYLE, publicStorageUrl } from '../../lib/client-utils'

function financialCompletion(totalInvoiced, contractValue) {
  const cv = Number(contractValue) || 0
  const inv = Number(totalInvoiced) || 0
  if (cv <= 0) return 0
  return Math.min(100, Math.round((inv / cv) * 100))
}

export default function ClientProjects({ selectedProjectId, onSelectProject }) {
  const { clientId, loading: clientLoading } = useClient()
  const [projects, setProjects] = useState([])
  const [detail, setDetail] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [photos, setPhotos] = useState([])
  const [reports, setReports] = useState([])
  const [finance, setFinance] = useState({ invoiced: 0, paid: 0, outstanding: 0 })
  const [loading, setLoading] = useState(true)

  const loadProjects = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('id, name, status, contract_value, division:divisions(name)')
      .eq('client_id', clientId)
      .order('name')

    const rows = data ?? []
    const withMeta = await Promise.all(
      rows.map(async (p) => {
        const { data: inv } = await supabase
          .from('invoices')
          .select('gross_total_ghs, status, created_at')
          .eq('project_id', p.id)
          .in('status', ['approved', 'sent', 'paid'])
        const invoices = inv ?? []
        const totalInvoiced = invoices.reduce((s, i) => s + Number(i.gross_total_ghs || 0), 0)
        const lastInvoice = invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        return {
          ...p,
          totalInvoiced,
          completionPct: financialCompletion(totalInvoiced, p.contract_value),
          lastInvoiceDate: lastInvoice?.created_at
            ? new Date(lastInvoice.created_at).toLocaleDateString('en-GH')
            : '—',
        }
      })
    )
    setProjects(withMeta)
    setLoading(false)
    return withMeta
  }, [clientId])

  const loadDetail = useCallback(
    async (projectId) => {
      if (!projectId) return
      const { data: project } = await supabase
        .from('projects')
        .select('*, division:divisions(name)')
        .eq('id', projectId)
        .single()

      const [ms, docs, inv] = await Promise.all([
        supabase.from('milestones').select('*').eq('project_id', projectId).order('due_date', { ascending: true }),
        supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .in('document_type', ['site_photo', 'daily_report'])
          .order('document_date', { ascending: false }),
        supabase
          .from('invoices')
          .select('gross_total_ghs, status, expected_receipt_ghs')
          .eq('project_id', projectId)
          .in('status', ['approved', 'sent', 'paid']),
      ])

      const invoices = inv.data ?? []
      const invoiced = invoices.reduce((s, i) => s + Number(i.gross_total_ghs || 0), 0)
      const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.gross_total_ghs || 0), 0)
      const outstanding = invoices
        .filter((i) => i.status === 'sent')
        .reduce((s, i) => s + Number(i.expected_receipt_ghs || i.gross_total_ghs || 0), 0)

      setDetail(project)
      setMilestones(ms.data ?? [])
      setPhotos((docs.data ?? []).filter((d) => d.document_type === 'site_photo'))
      setReports((docs.data ?? []).filter((d) => d.document_type === 'daily_report'))
      setFinance({ invoiced, paid, outstanding })
    },
    []
  )

  useEffect(() => {
    if (!clientId || clientLoading) return
    loadProjects().then((rows) => {
      if (!rows?.length) return
      if (rows.length === 1) onSelectProject?.(rows[0].id)
      else if (selectedProjectId) loadDetail(selectedProjectId)
    })
  }, [clientId, clientLoading, loadProjects, selectedProjectId, onSelectProject, loadDetail])

  useEffect(() => {
    if (selectedProjectId) loadDetail(selectedProjectId)
  }, [selectedProjectId, loadDetail])

  if (clientLoading || loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
  }

  if (!clientId) {
    return <p className="text-slate-600">Your account is not linked to a client record. Contact ARCBUILD PRO.</p>
  }

  if (!selectedProjectId && projects.length > 1) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">My projects</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectProject(p.id)}
              className="client-card text-left transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PROJECT_STATUS_STYLE[p.status] || PROJECT_STATUS_STYLE.active}`}>
                  {p.status?.replace('_', ' ')}
                </span>
              </div>
              {p.division?.name && (
                <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p.division.name}</span>
              )}
              <p className="mt-3 text-sm text-slate-600">Contract {formatGhs(p.contract_value)}</p>
              <p className="text-sm text-slate-500">Last invoice: {p.lastInvoiceDate}</p>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Financial completion</span>
                  <span>{p.completionPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${p.completionPct}%` }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const project = detail || projects.find((p) => p.id === selectedProjectId)
  if (!project) {
    return <p className="text-slate-600">Select a project to view details.</p>
  }

  return (
    <div className="space-y-8">
      {projects.length > 1 && (
        <button type="button" onClick={() => onSelectProject(null)} className="text-sm font-medium text-teal-700">
          ← All projects
        </button>
      )}

      <header>
        <h2 className="text-2xl font-semibold text-slate-900">{project.name}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {project.division?.name && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{project.division.name}</span>
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${PROJECT_STATUS_STYLE[project.status] || ''}`}>
            {project.status?.replace('_', ' ')}
          </span>
        </div>
        <p className="mt-2 text-slate-600">Contract value: {formatGhs(project.contract_value)}</p>
      </header>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Progress</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {milestones.length === 0 ? (
            <p className="text-sm text-slate-500">No milestones defined yet.</p>
          ) : (
            milestones.map((m) => (
              <div
                key={m.id}
                className={`min-w-[10rem] shrink-0 rounded-xl border-2 p-3 ${MILESTONE_STATUS_STYLE[m.status] || MILESTONE_STATUS_STYLE.pending}`}
              >
                <p className="font-medium">{m.title}</p>
                <p className="mt-1 text-xs">{Number(m.percentage_complete || 0)}% complete</p>
                <p className="mt-1 text-xs capitalize">{m.status?.replace('_', ' ')}</p>
                {m.due_date && <p className="mt-1 text-xs opacity-80">Due {m.due_date}</p>}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total invoiced', value: formatGhs(finance.invoiced) },
          { label: 'Total paid', value: formatGhs(finance.paid) },
          { label: 'Outstanding', value: formatGhs(finance.outstanding) },
        ].map((c) => (
          <div key={c.label} className="client-card">
            <p className="text-xs uppercase text-slate-500">{c.label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{c.value}</p>
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Site photos</h3>
        {photos.length === 0 ? (
          <p className="text-sm text-slate-500">No site photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((doc) => {
              const src = publicStorageUrl(doc.file_url)
              return (
                <figure key={doc.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {src ? (
                    <img src={src} alt={doc.description || doc.file_name} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-slate-100 text-xs text-slate-500">No preview</div>
                  )}
                  <figcaption className="p-2 text-xs text-slate-500">{doc.document_date || doc.created_at?.slice(0, 10)}</figcaption>
                </figure>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Daily progress reports</h3>
        {reports.length === 0 ? (
          <p className="text-sm text-slate-500">No reports submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((doc) => {
              const c = doc.content || {}
              return (
                <li key={doc.id} className="client-card text-sm">
                  <p className="font-semibold text-slate-900">{doc.document_date || '—'}</p>
                  <p className="mt-1 text-slate-600">Weather: {c.weather ?? '—'}</p>
                  <p className="text-slate-600">Workers on site: {c.workers_on_site ?? '—'}</p>
                  <p className="mt-2 text-slate-700">{c.work_completed ?? '—'}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
