import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useClient } from '../../context/ClientContext'
import { formatGhs, PROJECT_STATUS_STYLE, MILESTONE_STATUS_STYLE, publicStorageUrl } from '../../lib/client-utils'
import ClientLanding from './ClientLanding'

function financialCompletion(totalInvoiced, contractValue) {
  const cv = Number(contractValue) || 0
  const inv = Number(totalInvoiced) || 0
  if (cv <= 0) return 0
  return Math.min(100, Math.round((inv / cv) * 100))
}

export default function ClientProjects({ selectedProjectId, onSelectProject, onSwitchTab }) {
  const { clientId, loading: clientLoading } = useClient()
  const [projects, setProjects] = useState([])
  const [detail, setDetail] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [photos, setPhotos] = useState([])
  const [reports, setReports] = useState([])
  const [finance, setFinance] = useState({ invoiced: 0, paid: 0, outstanding: 0 })
  const [loading, setLoading] = useState(true)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overview, setOverview] = useState({
    activeProjects: 0,
    latestUpdate: null,
    unpaidAmount: 0,
    pendingDocuments: 0,
    latestPhoto: null,
  })

  const loadOverview = useCallback(
    async (projectRows) => {
      setOverviewLoading(true)
      const projectIds = projectRows.map((project) => project.id)
      if (!clientId || projectIds.length === 0) {
        setOverview({
          activeProjects: 0,
          latestUpdate: null,
          unpaidAmount: 0,
          pendingDocuments: 0,
          latestPhoto: null,
        })
        setOverviewLoading(false)
        return
      }

      const [invoiceRes, docsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('expected_receipt_ghs, status')
          .in('project_id', projectIds)
          .eq('status', 'sent'),
        supabase
          .from('documents')
          .select('id, file_url, file_name, document_type, document_date, description, content, project_id, created_at')
          .in('project_id', projectIds)
          .order('document_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      const invoices = invoiceRes.data ?? []
      const docs = docsRes.data ?? []
      const unpaidAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.expected_receipt_ghs || 0), 0)
      const pendingDocuments = docs.length
      const latestReport = docs.find((doc) => doc.document_type === 'daily_report')
      const latestPhoto = docs.find((doc) => doc.document_type === 'site_photo' && doc.file_url)

      const latestUpdate = latestReport
        ? {
            projectId: latestReport.project_id,
            text:
              (latestReport.content && typeof latestReport.content === 'object'
                ? latestReport.content.work_completed || latestReport.content.summary || latestReport.content.notes
                : latestReport.content) || latestReport.description || latestReport.file_name || 'Latest progress update available',
            date: latestReport.document_date
              ? new Date(latestReport.document_date).toLocaleDateString('en-GH')
              : latestReport.created_at
              ? new Date(latestReport.created_at).toLocaleDateString('en-GH')
              : '—',
          }
        : null

      setOverview({
        activeProjects: projectRows.filter((project) => project.status === 'active').length,
        latestUpdate,
        unpaidAmount,
        pendingDocuments,
        latestPhoto,
      })
      setOverviewLoading(false)
    },
    [clientId]
  )

  const loadProjects = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('id, name, status, contract_value, division:divisions(name)')
      .eq('client_id', clientId)
      .order('name')

    const rows = data ?? []
    // Fetch invoices for all projects in one request (avoid N+1)
    const { data: invAll } = await supabase
      .from('invoices')
      .select('gross_total_ghs,status,created_at,expected_receipt_ghs,project_id')
      .in('project_id', projectIds)
      .in('status', ['approved', 'sent', 'paid'])
      .limit(50)

    const invMap = {}
    ;(invAll || []).forEach((inv) => {
      if (!invMap[inv.project_id]) invMap[inv.project_id] = []
      invMap[inv.project_id].push(inv)
    })

    const withMeta = rows.map((p) => {
      const invoices = invMap[p.id] || []
      const totalInvoiced = invoices.reduce((s, i) => s + Number(i.gross_total_ghs || 0), 0)
      const lastInvoice = invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      return {
        ...p,
        totalInvoiced,
        completionPct: financialCompletion(totalInvoiced, p.contract_value),
        lastInvoiceDate: lastInvoice?.created_at ? new Date(lastInvoice.created_at).toLocaleDateString('en-GH') : '—',
      }
    })
    setProjects(withMeta)
    setLoading(false)
    await loadOverview(withMeta)
    return withMeta
  }, [clientId, loadOverview])

  const loadDetail = useCallback(
    async (projectId) => {
      if (!projectId) return
      const { data: project } = await supabase
        .from('projects')
        .select('id,name,status,contract_value,division:divisions(name),description')
        .eq('id', projectId)
        .single()

      const [ms, docs, inv] = await Promise.all([
        supabase.from('milestones').select('id,title,percentage_complete,status,due_date').eq('project_id', projectId).order('due_date', { ascending: true }).limit(50),
        supabase
          .from('documents')
          .select('id,file_url,file_name,document_type,document_date,description,content,project_id,created_at')
          .eq('project_id', projectId)
          .in('document_type', ['site_photo', 'daily_report'])
          .order('document_date', { ascending: false })
          .limit(50),
        supabase
          .from('invoices')
          .select('gross_total_ghs, status, expected_receipt_ghs')
          .eq('project_id', projectId)
          .in('status', ['approved', 'sent', 'paid'])
          .limit(50),
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

  const activeProjects = projects.filter((project) => project.status === 'active').length
  const latestUpdate = overview.latestUpdate
  const latestPhotoUrl = overview.latestPhoto ? publicStorageUrl(overview.latestPhoto.file_url) : null
  const progressText = latestUpdate?.text || 'No progress updates yet.'
  const progressDate = latestUpdate?.date || '—'
  const summaryItems = [
    {
      title: 'Active projects',
      value: overviewLoading ? '—' : activeProjects,
      description: 'Projects currently in progress',
      onClick: () => onSelectProject?.(null),
    },
    {
      title: 'Latest progress',
      value: overviewLoading ? 'Loading...' : progressDate,
      description: progressText,
      onClick: () => {
        if (latestUpdate?.projectId) onSelectProject?.(latestUpdate.projectId)
      },
    },
    {
      title: 'Amount due',
      value: overviewLoading ? '—' : formatGhs(overview.unpaidAmount),
      description: 'Sent invoices awaiting payment',
      onClick: () => onSwitchTab?.('invoices'),
    },
    {
      title: 'Documents to review',
      value: overviewLoading ? '—' : overview.pendingDocuments,
      description: 'Latest project documents awaiting your review',
      onClick: () => onSwitchTab?.('documents'),
    },
  ]

  const overviewSection = (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Client overview</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Your current project summary</h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            See active projects, recent progress, outstanding invoices, pending documents, and the latest site photo in one place.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
          <div className="grid gap-4 sm:grid-cols-2">
            {summaryItems.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={item.onClick}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-white"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{item.title}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onSwitchTab?.('documents')}
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-left transition hover:border-teal-300"
          >
            {latestPhotoUrl ? (
              <img src={latestPhotoUrl} alt="Latest site photo" className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full min-h-[12rem] items-center justify-center bg-slate-900 px-4 py-6 text-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300">Latest site photo</p>
                  <p className="mt-3 text-sm text-slate-300">No site photo available yet.</p>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4">
              <p className="text-sm font-semibold text-white">Latest site photo</p>
              <p className="mt-1 text-xs text-slate-300">Tap to view all documents</p>
            </div>
          </button>
        </div>
      </div>
    </section>
  )

  if (!clientId) {
    return <p className="text-slate-600">Your account is not linked to a client record. Contact Modulo Development Limited.</p>
  }

  if (!selectedProjectId && projects.length > 1) {
    return (
      <div className="space-y-8">
        <ClientLanding />
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
      </div>
    )
  }

  const project = detail || projects.find((p) => p.id === selectedProjectId)
  if (!project) {
    return <p className="text-slate-600">Select a project to view details.</p>
  }

  return (
    <div className="space-y-8">
      {overviewSection}
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
                    <img src={src} alt={doc.description || doc.file_name} className="aspect-square max-h-48 w-full object-cover" />
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
