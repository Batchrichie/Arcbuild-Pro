import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEmployee } from '../context/EmployeeContext'

export default function TimesheetEntry() {
  const { employee, loading: employeeLoading, reloadEmployee } = useEmployee()
  const [projects, setProjects] = useState([])
  const [timesheets, setTimesheets] = useState([])
  const [form, setForm] = useState({
    project_id: '',
    work_date: new Date().toISOString().slice(0, 10),
    week_start: new Date().toISOString().slice(0, 10),
    hours_worked: 8,
    work_description: '',
    billable: true,
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!employee) return
    loadProjects()
    loadTimesheets()
  }, [employee])

  async function loadProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id,name')
      .eq('status', 'active')
      .order('name', { ascending: true })

    if (error) {
      console.warn('Failed to load projects', error)
      return
    }
    setProjects(data || [])
    if (!form.project_id && data?.length) {
      setForm((prev) => ({ ...prev, project_id: data[0].id }))
    }
  }

  async function loadTimesheets() {
    const { data, error } = await supabase
      .from('timesheets')
      .select('id,project_id,work_date,week_start,hours_worked,work_description,description,billable,status,submitted_at,approved_at,rejected_reason')
      .eq('employee_id', employee.id)
      .order('work_date', { ascending: false })
      .limit(200)

    if (error) {
      console.warn('Failed to load timesheets', error)
      return
    }
    setTimesheets(data || [])
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSave(status) {
    if (!employee?.id) return
    if (!form.project_id) {
      setMessage('Select a project before saving.')
      return
    }
    setLoading(true)
    setMessage('')

    const payload = {
      employee_id: employee.id,
      project_id: form.project_id,
      work_date: form.work_date,
      week_start: form.week_start,
      hours_worked: Number(form.hours_worked) || 0,
      work_description: form.work_description || null,
      billable: form.billable,
      status,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    }

    const { error } = await supabase.from('timesheets').insert(payload)
    setLoading(false)

    if (error) {
      setMessage('Save failed: ' + error.message)
      return
    }

    setMessage(status === 'submitted' ? 'Timesheet submitted.' : 'Draft saved.')
    setForm((prev) => ({ ...prev, hours_worked: 8, work_description: '', billable: true }))
    loadTimesheets()
  }

  async function submitDraft(id) {
    setLoading(true)
    const { error } = await supabase
      .from('timesheets')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', id)

    setLoading(false)
    if (error) {
      setMessage('Unable to submit draft: ' + error.message)
      return
    }
    setMessage('Draft submitted.')
    loadTimesheets()
  }

  if (employeeLoading) {
    return <p className="text-slate-300">Loading employee details…</p>
  }

  if (!employee) {
    return <p className="text-slate-300">Employee record not found. Please contact HR.</p>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
        <h2 className="text-xl font-semibold text-white">Log a Timesheet</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            Project
            <select
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
              value={form.project_id}
              onChange={(e) => updateField('project_id', e.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            Work date
            <input
              type="date"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
              value={form.work_date}
              onChange={(e) => updateField('work_date', e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            Week start
            <input
              type="date"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
              value={form.week_start}
              onChange={(e) => updateField('week_start', e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            Hours worked
            <input
              type="number"
              min="0"
              max="24"
              step="0.25"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
              value={form.hours_worked}
              onChange={(e) => updateField('hours_worked', e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
            Description
            <textarea
              rows="3"
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"
              value={form.work_description}
              onChange={(e) => updateField('work_description', e.target.value)}
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.billable}
              onChange={(e) => updateField('billable', e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-500"
            />
            Billable
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave('draft')}
            className="inline-flex items-center justify-center rounded-full bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave('submitted')}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit timesheet
          </button>
          {message && <span className="text-sm text-slate-400">{message}</span>}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">My recent timesheets</h3>
            <p className="text-sm text-slate-500">View the last 200 entries and submit drafts.</p>
          </div>
          <button
            type="button"
            onClick={loadTimesheets}
            className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950/90">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {timesheets.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-sm text-slate-500">No timesheets yet.</td>
                </tr>
              ) : (
                timesheets.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-slate-200">{row.work_date}</td>
                    <td className="px-4 py-3 text-slate-200">{projects.find((p) => p.id === row.project_id)?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-slate-200">{row.hours_worked}</td>
                    <td className="px-4 py-3 text-slate-200 capitalize">{row.status}</td>
                    <td className="px-4 py-3 text-slate-400">{row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      {row.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => submitDraft(row.id)}
                          className="rounded-full bg-orange-500 px-3 py-1 text-sm font-semibold text-white"
                        >
                          Submit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
