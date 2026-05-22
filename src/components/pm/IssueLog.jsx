import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { usePmProject } from '../../context/PmProjectContext'

const TYPE_STYLES = {
  issue: 'bg-red-500/20 text-red-300',
  risk: 'bg-amber-500/20 text-amber-300',
  observation: 'bg-blue-500/20 text-blue-300',
}

const SEVERITY_STYLES = {
  low: 'bg-slate-500/30 text-slate-300',
  medium: 'bg-yellow-500/20 text-yellow-200',
  high: 'bg-orange-500/20 text-orange-200',
  critical: 'bg-red-600/30 text-red-200',
}

const EMPTY_FORM = {
  title: '',
  description: '',
  issue_type: 'issue',
  severity: 'medium',
  due_date: '',
}

export default function IssueLog({ readOnly = false, allProjects = false }) {
  const { profile } = useAuth()
  const pmContext = usePmProject()
  const selectedProjectId = allProjects ? null : pmContext?.selectedProjectId
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [resolveId, setResolveId] = useState(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [error, setError] = useState(null)
  const [projectFilter, setProjectFilter] = useState('')

  const load = useCallback(async () => {
    if (!allProjects && !selectedProjectId) return
    setLoading(true)
    let query = supabase
      .from('issue_log')
      .select('*, projects(name)')
      .order('created_at', { ascending: false })

    if (!allProjects && selectedProjectId) {
      query = query.eq('project_id', selectedProjectId)
    }

    const { data, error: err } = await query

    if (err) {
      console.warn('Issue log load failed', err)
      setIssues([])
    } else {
      setIssues(data ?? [])
    }
    setLoading(false)
  }, [allProjects, selectedProjectId])

  useEffect(() => {
    load()
  }, [load])

  const addIssue = async (e) => {
    e.preventDefault()
    if (!selectedProjectId || !profile?.id) return
    setError(null)
    const { error: err } = await supabase.from('issue_log').insert({
      project_id: selectedProjectId,
      title: form.title,
      description: form.description || null,
      issue_type: form.issue_type,
      severity: form.severity,
      due_date: form.due_date || null,
      raised_by: profile.id,
      status: 'open',
    })
    if (err) {
      setError(err.message)
      return
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    load()
  }

  const resolveIssue = async () => {
    if (!resolveId) return
    const { error: err } = await supabase
      .from('issue_log')
      .update({
        status: 'resolved',
        resolved_date: new Date().toISOString().split('T')[0],
        resolution_notes: resolutionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resolveId)
    if (err) {
      setError(err.message)
      return
    }
    setResolveId(null)
    setResolutionNotes('')
    load()
  }

  const projectOptions = allProjects
    ? [...new Map(issues.map((i) => [i.project_id, i.projects?.name || 'Project'])).entries()]
    : []

  const filtered = projectFilter
    ? issues.filter((i) => i.project_id === projectFilter)
    : issues

  if (!allProjects && !selectedProjectId) {
    return <p className="text-sm text-slate-500">Select a project to view issues and risks.</p>
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-4">
      {allProjects && projectOptions.length > 0 && (
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white sm:max-w-xs"
        >
          <option value="">All projects</option>
          {projectOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="min-touch w-full rounded-full border border-cyan-400/30 bg-cyan-500/15 py-3 text-sm font-semibold text-cyan-100 sm:w-auto sm:px-6"
        >
          Add Issue / Risk
        </button>
      )}

      {showForm && !readOnly && (
        <form onSubmit={addIssue} className="space-y-3 rounded-2xl border border-border-soft bg-white/5 p-4">
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.issue_type}
              onChange={(e) => setForm({ ...form, issue_type: e.target.value })}
              className="rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="issue">Issue</option>
              <option value="risk">Risk</option>
              <option value="observation">Observation</option>
            </select>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <div className="flex gap-2">
            <button type="submit" className="min-touch flex-1 rounded-full bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="min-touch rounded-full border border-border-soft px-4 py-2.5 text-sm text-slate-300">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No issues logged.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li key={item.id} className="rounded-2xl border border-border-soft bg-white/5 p-4">
              <div className="flex flex-wrap gap-2">
                {allProjects && item.projects?.name && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{item.projects.name}</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TYPE_STYLES[item.issue_type]}`}>
                  {item.issue_type}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${SEVERITY_STYLES[item.severity]}`}>
                  {item.severity}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300 capitalize">{item.status}</span>
              </div>
              <h4 className="mt-2 font-semibold text-white">{item.title}</h4>
              {item.description && <p className="mt-1 text-sm text-slate-400">{item.description}</p>}
              <p className="mt-2 text-xs text-slate-500">{item.due_date ? `Due ${item.due_date}` : ''}</p>
              {!readOnly && ['open', 'in_progress'].includes(item.status) && (
                <button
                  type="button"
                  onClick={() => setResolveId(item.id)}
                  className="min-touch mt-3 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200"
                >
                  Resolve
                </button>
              )}
              {item.resolution_notes && (
                <p className="mt-2 text-sm text-emerald-200/90">Resolution: {item.resolution_notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {resolveId && !readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl border-t border-border-soft bg-slate-900 p-4 pb-8 lg:static lg:rounded-2xl lg:border">
          <h4 className="font-semibold text-white">Resolve issue</h4>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            className="mt-3 w-full rounded-xl border border-border-soft bg-slate-950 px-3 py-2 text-sm text-white"
            rows={3}
            placeholder="Resolution notes"
          />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={resolveIssue} className="min-touch flex-1 rounded-full bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950">
              Confirm resolve
            </button>
            <button type="button" onClick={() => setResolveId(null)} className="min-touch rounded-full border border-border-soft px-4 py-2.5 text-sm text-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}