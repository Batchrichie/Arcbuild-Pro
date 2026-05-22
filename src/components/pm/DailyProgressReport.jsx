import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { usePmProject } from '../../context/PmProjectContext'

const WEATHER_OPTIONS = ['Clear', 'Overcast', 'Rain', 'Heavy Rain', 'Storm']

export default function DailyProgressReport() {
  const { profile } = useAuth()
  const { selectedProjectId } = usePmProject()
  const [reports, setReports] = useState([])
  const [expanded, setExpanded] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    report_date: new Date().toISOString().split('T')[0],
    weather: 'Clear',
    workers_on_site: '',
    work_completed: '',
    materials_received: '',
    issues_delays: '',
  })

  const load = useCallback(async () => {
    if (!selectedProjectId) return
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', selectedProjectId)
      .eq('document_type', 'daily_report')
      .order('document_date', { ascending: false })

    setReports(data ?? [])
  }, [selectedProjectId])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!selectedProjectId || !profile?.id) return
    setSubmitting(true)
    const payload = {
      weather: form.weather,
      workers_on_site: Number(form.workers_on_site) || 0,
      work_completed: form.work_completed,
      materials_received: form.materials_received,
      issues_delays: form.issues_delays,
    }
    const { error } = await supabase.from('documents').insert({
      related_type: 'project',
      related_id: selectedProjectId,
      project_id: selectedProjectId,
      document_type: 'daily_report',
      file_name: `daily_report_${form.report_date}.json`,
      file_url: `daily-report://${selectedProjectId}/${form.report_date}`,
      description: `Daily report — ${form.report_date}`,
      document_date: form.report_date,
      content: payload,
      uploaded_by: profile.id,
    })
    setSubmitting(false)
    if (error) {
      alert(error.message)
      return
    }
    setForm({
      report_date: new Date().toISOString().split('T')[0],
      weather: 'Clear',
      workers_on_site: '',
      work_completed: '',
      materials_received: '',
      issues_delays: '',
    })
    load()
  }

  if (!selectedProjectId) {
    return <p className="text-sm text-slate-500">Select a project to submit daily reports.</p>
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-4">
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border-soft bg-white/5 p-4">
        <h3 className="font-semibold text-white">Daily progress log</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-400">
            Date
            <input
              type="date"
              required
              value={form.report_date}
              onChange={(e) => setForm({ ...form, report_date: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-slate-400">
            Weather
            <select
              value={form.weather}
              onChange={(e) => setForm({ ...form, weather: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-white"
            >
              {WEATHER_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm text-slate-400">
          Workers on site
          <input
            type="number"
            min="0"
            value={form.workers_on_site}
            onChange={(e) => setForm({ ...form, workers_on_site: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-white"
          />
        </label>
        {[
          ['work_completed', 'Work completed today'],
          ['materials_received', 'Materials received'],
          ['issues_delays', 'Issues or delays'],
        ].map(([key, label]) => (
          <label key={key} className="block text-sm text-slate-400">
            {label}
            <textarea
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-white"
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={submitting}
          className="min-touch w-full rounded-full bg-cyan-500 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </form>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Previous reports</h3>
        {reports.length === 0 ? (
          <p className="text-sm text-slate-500">No reports yet.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => {
              const open = expanded[r.id]
              const c = r.content || {}
              return (
                <li key={r.id} className="rounded-xl border border-border-soft bg-white/5">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                    className="min-touch flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white"
                  >
                    {r.document_date || r.description}
                    <span className="text-slate-400">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <div className="border-t border-border-soft px-4 py-3 text-sm text-slate-300 space-y-2">
                      <p>Weather: {c.weather}</p>
                      <p>Workers: {c.workers_on_site}</p>
                      <p>Work: {c.work_completed}</p>
                      <p>Materials: {c.materials_received}</p>
                      <p>Issues: {c.issues_delays}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
