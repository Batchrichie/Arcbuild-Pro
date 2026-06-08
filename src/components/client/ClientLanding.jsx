import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useClient } from '../../context/ClientContext'
import { formatGhs } from '../../lib/formatGhs'
import { publicStorageUrl } from '../../lib/client-utils'

export default function ClientLanding() {
  const { clientId } = useClient()

  const { data, isLoading } = useQuery({
    queryKey: ['client-overview', clientId],
    queryFn: async () => {
      if (!clientId) return null

      // Get all active projects
      const { data: projectsRes } = await supabase
        .from('projects')
        .select('id, name, status, contract_value')
        .eq('client_id', clientId)

      const projectIds = projectsRes?.map(p => p.id) || []
      const activeProjects = projectsRes?.filter(p => p.status === 'active').length || 0

      if (projectIds.length === 0) {
        return {
          activeProjects: 0,
          unpaidInvoices: [],
          unpaidTotal: 0,
          documentsCount: 0,
          latestUpdate: null,
          latestPhoto: null,
        }
      }

      // Get unpaid invoices and documents in parallel
      const [invoicesRes, docsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, expected_receipt_ghs, due_date, status, project_id')
          .in('project_id', projectIds)
          .eq('status', 'sent')
          .order('due_date', { ascending: true }),
        supabase
          .from('documents')
          .select('id, file_url, file_name, document_type, document_date, description, content, project_id, created_at')
          .in('project_id', projectIds)
          .order('document_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      const invoices = invoicesRes.data || []
      const docs = docsRes.data || []

      // Calculate days overdue for each invoice
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const invoicesWithOverdue = invoices
        .map(inv => {
          const dueDate = inv.due_date ? new Date(inv.due_date) : null
          dueDate?.setHours(0, 0, 0, 0)
          const daysOverdue = dueDate ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0
          return { ...inv, daysOverdue: Math.max(0, daysOverdue) }
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue)
        .slice(0, 3)

      const unpaidTotal = invoices.reduce((s, inv) => s + Number(inv.expected_receipt_ghs || 0), 0)

      const latestReport = docs.find(doc => doc.document_type === 'daily_report')
      const latestPhoto = docs.find(doc => doc.document_type === 'site_photo' && doc.file_url)

      const latestUpdate = latestReport
        ? {
            projectId: latestReport.project_id,
            text:
              (latestReport.content && typeof latestReport.content === 'object'
                ? latestReport.content.work_completed || latestReport.content.summary || latestReport.content.notes
                : latestReport.content) || latestReport.description || 'Latest progress update available',
            date: latestReport.document_date
              ? new Date(latestReport.document_date).toLocaleDateString('en-GH')
              : latestReport.created_at
              ? new Date(latestReport.created_at).toLocaleDateString('en-GH')
              : '—',
          }
        : null

      return {
        activeProjects,
        unpaidInvoices: invoicesWithOverdue,
        unpaidTotal,
        documentsCount: docs.length,
        latestUpdate,
        latestPhoto,
      }
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5,
  })

  const overview = data || {
    activeProjects: 0,
    unpaidInvoices: [],
    unpaidTotal: 0,
    documentsCount: 0,
    latestUpdate: null,
    latestPhoto: null,
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Welcome header */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
        <p className="text-sm text-teal-600">Welcome back</p>
        <h1 className="mt-1 text-3xl font-bold text-teal-900">Your projects at a glance</h1>
        <p className="mt-1 text-sm text-teal-700">{new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Overview row - responsive 2-up -> 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <OverviewCard
          label="Active projects"
          value={isLoading ? '—' : String(overview.activeProjects)}
          badge="green"
          loading={isLoading}
        />
        <OverviewCard
          label="Unpaid invoices"
          value={isLoading ? '—' : String(overview.unpaidInvoices.length)}
          detail={overview.unpaidTotal > 0 ? formatGhs(overview.unpaidTotal) : 'All paid'}
          badge={overview.unpaidInvoices.length > 0 ? 'red' : 'green'}
          loading={isLoading}
        />
        <OverviewCard
          label="Documents awaiting review"
          value={isLoading ? '—' : String(overview.documentsCount)}
          badge={overview.documentsCount > 0 ? 'amber' : 'green'}
          loading={isLoading}
        />
        <OverviewCard
          label="Latest progress update"
          value={overview.latestUpdate?.date || '—'}
          detail={overview.latestUpdate ? 'View details' : 'No updates yet'}
          badge="blue"
          loading={isLoading}
        />
      </div>

      {/* Latest progress update card */}
      {overview.latestUpdate && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Latest progress update</h3>
          <p className="mt-1 text-sm text-slate-500">{overview.latestUpdate.date}</p>
          <p className="mt-4 line-clamp-3 text-sm text-slate-700">{overview.latestUpdate.text}</p>
        </div>
      )}

      {/* Unpaid invoices list */}
      {overview.unpaidInvoices.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Unpaid invoices</h3>
          <p className="mt-1 text-sm text-slate-500">Most overdue invoices</p>
          <div className="mt-4 space-y-3">
            {overview.unpaidInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div>
                  <p className="font-medium text-slate-900">{inv.invoice_number}</p>
                  <p className="text-sm text-slate-500">{inv.due_date}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatGhs(inv.expected_receipt_ghs)}</p>
                  {inv.daysOverdue > 0 && (
                    <p className="text-sm font-semibold text-red-600">{inv.daysOverdue} days overdue</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest site photo */}
      {overview.latestPhoto && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Latest site photo</h3>
          <div className="mt-4 overflow-hidden rounded-lg">
            <img
              src={publicStorageUrl(overview.latestPhoto.file_url)}
              alt="Latest site photo"
              className="h-64 w-full object-cover"
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">{overview.latestPhoto.file_name}</p>
        </div>
      )}
    </div>
  )
}

function OverviewCard({ label, value, detail, badge, loading }) {
  const badgeColors = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className={`kpi-card ${loading ? 'animate-pulse' : ''}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
      <div className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badgeColors[badge]}`}>
        {badge === 'green' ? 'All set' : badge === 'red' ? 'Action needed' : badge === 'amber' ? 'Attention' : 'View'}
      </div>
    </div>
  )
}
