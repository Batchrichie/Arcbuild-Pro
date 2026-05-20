import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'
import {
  getProjects,
  getProjectStatus,
  createProject,
  updateProject,
} from '../../services/projectService'

const COMPLETION_METHODS = [
  { label: 'Cost-Based', value: 'cost' },
  { label: 'Milestone-Based', value: 'milestone' },
  { label: 'Manual', value: 'manual' },
]

const STATUS_LABELS = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_BADGE = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  on_hold: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  completed: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  cancelled: 'border-red-500/30 bg-red-500/10 text-red-300',
}

const PAGE_SIZE = 20

const EMPTY_FORM = {
  name: '',
  client_id: '',
  division_id: '',
  contract_value: 0,
  start_date: '',
  end_date: '',
  status: 'active',
  completion_method: 'cost',
  budget_cost: 0,
  recognition_notes: '',
}

export default function ProjectRegistry() {
  const { profile } = useAuth()
  const canEdit = ['ceo', 'accountant'].includes(profile?.role)
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [readOnly, setReadOnly] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadMeta()
  }, [])

  useEffect(() => {
    loadProjects()
  }, [search, statusFilter, divisionFilter])

  async function loadMeta() {
    setLoadingMeta(true)
    try {
      const [clientsRes, divisionsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .in('status', ['active', 'Active'])
          .order('name'),
        supabase
          .from('divisions')
          .select('id, name')
          .order('name'),
      ])

      if (clientsRes.error) throw clientsRes.error
      if (divisionsRes.error) throw divisionsRes.error

      setClients(clientsRes.data ?? [])
      setDivisions(divisionsRes.data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMeta(false)
    }
  }

  async function loadProjects() {
    setLoading(true)
    setError(null)
    try {
      const data = await getProjects({
        status: statusFilter || undefined,
        division_id: divisionFilter || undefined,
        search: search || undefined,
      })
      setProjects(data)
      setPage(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingProject(null)
    setReadOnly(false)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openProject(project, forceReadOnly = false) {
    setEditingProject(project)
    setReadOnly(forceReadOnly || !canEdit)
    setForm({
      name: project.name || '',
      client_id: project.client_id || '',
      division_id: project.division_id || '',
      contract_value: project.contract_value ?? 0,
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      status: project.status || 'active',
      completion_method: project.completion_method || 'cost',
      budget_cost: project.budget_cost ?? 0,
      recognition_notes: project.recognition_notes || '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    if (!form.name.trim()) {
      setFormError('Project name is required.')
      return
    }
    if (!form.client_id) {
      setFormError('Client is required.')
      return
    }
    if (!form.division_id) {
      setFormError('Division is required.')
      return
    }
    if (Number(form.contract_value) < 0 || form.contract_value === '') {
      setFormError('Contract value must be zero or greater.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        client_id: form.client_id,
        division_id: form.division_id,
        contract_value: Number(form.contract_value),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        completion_method: form.completion_method,
        budget_cost: Number(form.budget_cost) || 0,
        recognition_notes: form.recognition_notes,
      }

      if (editingProject) {
        await updateProject(editingProject.id, payload, profile.id)
      } else {
        await createProject(payload, profile.id)
      }

      setModalOpen(false)
      await loadProjects()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const paginatedProjects = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE))
  const statusOptions = getProjectStatus()

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Project Registry</h1>
          <p className="mt-1 text-sm text-slate-400">Manage projects, budgets, and status.</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            + Add New Project
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50 w-72"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
        >
          <option value="">All Statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
        <select
          value={divisionFilter}
          onChange={(e) => setDivisionFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
        >
          <option value="">All Divisions</option>
          {divisions.map((division) => (
            <option key={division.id} value={division.id}>{division.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm text-slate-300">
          <thead className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Project Name</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Division</th>
              <th className="px-4 py-3 text-right">Contract Value</th>
              <th className="px-4 py-3 text-left">Start Date</th>
              <th className="px-4 py-3 text-left">End Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading…</td>
              </tr>
            ) : paginatedProjects.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">No projects found.</td>
              </tr>
            ) : (
              paginatedProjects.map((project) => (
                <tr
                  key={project.id}
                  className="cursor-pointer border-b border-white/5 hover:bg-white/5 transition"
                  onClick={() => openProject(project, !canEdit)}
                >
                  <td className="px-4 py-3 font-medium text-white">{project.name}</td>
                  <td className="px-4 py-3">{project.client_name ?? '—'}</td>
                  <td className="px-4 py-3">{project.division_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{formatGhs(project.contract_value ?? 0)}</td>
                  <td className="px-4 py-3">{project.start_date || '—'}</td>
                  <td className="px-4 py-3">{project.end_date || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[project.status] ?? ''}`}>
                      {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openProject(project, false)
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition"
                      >
                        Edit
                      </button>
                    ) : (
                      <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">View</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40 hover:bg-white/5 transition"
          >
            Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40 hover:bg-white/5 transition"
          >
            Next
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4 overflow-y-auto max-h-[90vh]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{editingProject ? (readOnly ? 'Project Details' : 'Edit Project') : 'New Project'}</h2>
                <p className="mt-1 text-sm text-slate-400">{readOnly ? 'Read-only project details.' : 'Fill required fields to save the project.'}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{formError}</div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Project Name *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Client *</span>
                <select
                  value={form.client_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Division *</span>
                <select
                  value={form.division_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, division_id: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  <option value="">Select division</option>
                  {divisions.map((division) => (
                    <option key={division.id} value={division.id}>{division.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Contract Value</span>
                <input
                  type="number"
                  min="0"
                  value={form.contract_value}
                  onChange={(e) => setForm((prev) => ({ ...prev, contract_value: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Start Date</span>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>End Date</span>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Completion Method</span>
                <select
                  value={form.completion_method}
                  onChange={(e) => setForm((prev) => ({ ...prev, completion_method: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  {COMPLETION_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </label>
              {(form.completion_method === 'cost' || form.completion_method === 'milestone') && (
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Budget Cost</span>
                  <input
                    type="number"
                    min="0"
                    value={form.budget_cost}
                    onChange={(e) => setForm((prev) => ({ ...prev, budget_cost: e.target.value }))}
                    disabled={readOnly}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
                  />
                </label>
              )}
            </div>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Notes</span>
              <textarea
                value={form.recognition_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, recognition_notes: e.target.value }))}
                disabled={readOnly}
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
