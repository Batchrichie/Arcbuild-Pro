import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function TimesheetApproval() {
  const { user, profile } = useAuth()
  const [timesheets, setTimesheets] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPending()
  }, [])

  async function loadPending() {
    setLoading(true)
    const { data, error } = await supabase
      .from('timesheet_summary')
      .select('*')
      .eq('status', 'submitted')
      .order('date', { ascending: false })
      .limit(200)

    setLoading(false)
    if (error) {
      setMessage('Could not load submitted timesheets: ' + error.message)
      return
    }
    setTimesheets(data || [])
  }

  async function handleAction(timesheetId, action) {
    setMessage('')
    const rejectionReason = action === 'reject' ? window.prompt('Enter rejection reason:') : null
    if (action === 'reject' && !rejectionReason) {
      setMessage('Rejection reason is required.')
      return
    }

    setLoading(true)
    const { error } = await supabase.rpc('approve_timesheet', {
      timesheet_id_param: timesheetId,
      actor_uuid: user?.id,
      action_param: action,
      rejection_reason_param: rejectionReason,
    })

    setLoading(false)
    if (error) {
      setMessage('Failed to ' + action + ' timesheet: ' + error.message)
      return
    }

    setMessage('Timesheet ' + (action === 'approve' ? 'approved' : 'rejected') + '.')
    loadPending()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl border border-border-soft bg-slate-950/80 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Timesheet Approvals</h2>
            <p className="text-sm text-slate-400">Review and approve submitted employee timesheets.</p>
          </div>
          <button
            type="button"
            onClick={loadPending}
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200"
          >
            Refresh
          </button>
        </div>

        {profile?.role && (
          <p className="mt-4 text-sm text-slate-400">Signed in as {profile.full_name} ({profile.role})</p>
        )}

        {message && <p className="mt-4 text-sm text-orange-300">{message}</p>}
      </div>

      <div className="overflow-x-auto rounded-4xl border border-border-soft bg-slate-950/80 p-4">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {timesheets.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-slate-500">No submitted timesheets available.</td>
              </tr>
            ) : (
              timesheets.map((row) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-200">{row.date}</td>
                  <td className="px-4 py-3 text-slate-200">{row.employee_name}</td>
                  <td className="px-4 py-3 text-slate-200">{row.project_name || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-slate-200">{row.hours_worked}</td>
                  <td className="px-4 py-3 text-slate-200">{row.work_description}</td>
                  <td className="px-4 py-3 text-slate-200">{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAction(row.id, 'approve')}
                      className="rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAction(row.id, 'reject')}
                      className="rounded-full bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
