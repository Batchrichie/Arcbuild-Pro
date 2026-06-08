import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useClient } from '../../context/ClientContext'
import { documentTypeLabel, publicStorageUrl } from '../../lib/client-utils'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'contract', label: 'Contracts' },
  { value: 'site_photo', label: 'Site Photos' },
  { value: 'daily_report', label: 'Daily Reports' },
  { value: 'other', label: 'Other' },
]

export default function ClientDocuments() {
  const { clientId } = useClient()
  const [docs, setDocs] = useState([])
  const [projects, setProjects] = useState({})
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const { data: projs } = await supabase.from('projects').select('id, name').eq('client_id', clientId)
    const projMap = {}
    ;(projs ?? []).forEach((p) => { projMap[p.id] = p.name })
    setProjects(projMap)

    const ids = Object.keys(projMap)
    if (ids.length === 0) {
      setDocs([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('documents')
      .select('id, file_name, file_url, project_id, document_type, document_date, created_at')
      .in('project_id', ids)
      .order('created_at', { ascending: false })
      .limit(50)

    setDocs(data ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    let list = docs
    if (filter === 'contract') list = docs.filter((d) => d.document_type === 'contract')
    else if (filter === 'site_photo') list = docs.filter((d) => d.document_type === 'site_photo')
    else if (filter === 'daily_report') list = docs.filter((d) => d.document_type === 'daily_report')
    else if (filter === 'other') list = docs.filter((d) => !['contract', 'site_photo', 'daily_report'].includes(d.document_type))

    const contracts = list.filter((d) => d.document_type === 'contract')
    const rest = list.filter((d) => d.document_type !== 'contract')
    return [...contracts, ...rest]
  }, [docs, filter])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setFilter(o.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              filter === o.value ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      ) : filtered.length === 0 ? (
        <p className="text-slate-500">No documents found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => {
            const href = publicStorageUrl(doc.file_url)
            const isPhoto = doc.document_type === 'site_photo'
            return (
              <article
                key={doc.id}
                className={`client-card ${doc.document_type === 'contract' ? 'ring-2 ring-teal-200' : ''}`}
              >
                {isPhoto && href && (
                  <img src={href} alt="" className="mb-3 aspect-video w-full rounded-lg object-cover" />
                )}
                <p className="text-xs font-semibold uppercase text-teal-700">
                  {documentTypeLabel(doc.document_type)}
                </p>
                <h3 className="mt-1 font-medium text-slate-900">{doc.file_name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {projects[doc.project_id] ?? 'Project'} · {doc.document_date || doc.created_at?.slice(0, 10)}
                </p>
                {href && !href.startsWith('daily-report://') && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-teal-700"
                  >
                    Download
                  </a>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
