import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { LEAVE_TYPE_COLORS } from '../../lib/hr-config'

const STATUS_BADGE = {
  pending: 'bg-amber-500/20 text-amber-200',
  approved: 'bg-emerald-500/20 text-emerald-200',
  rejected: 'bg-red-500/20 text-red-300',
}

export default function LeaveApprovals() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('leave_requests')
      .select(
        'id, leave_type, start_date, end_date, days_requested, status, created_at, employees(employee_number, profiles:profile_id(full_name))'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const approve = async (id) => {
    if (!profile?.id) return
    const { error: err } = await supabase
      .from('leave_requests')
      .update({ status: 'approved', approved_by: profile.id })
      .eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  const confirmReject = async () => {
    if (!rejectId || !rejectReason.trim()) {
      setError('Rejection reason is required')
      return
    }
    // TODO Phase 5: persist rejection_reason column on leave_requests
    try {
      localStorage.setItem(`arcbuild_leave_rejection_${rejectId}`, rejectReason.trim())
    } catch {
      /* ignore */
    }
    const { error: err } = await supabase
      .from('leave_requests')
      .update({ status: 'rejected', approved_by: profile?.id })
      .eq('id', rejectId)
    if (err) setError(err.message)
    else {
      setRejectId(null)
      setRejectReason('')
      load()
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No pending leave requests.</p>
      ) : (
        <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">
                    {row.employees?.profiles?.full_name ?? row.employees?.employee_number}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${LEAVE_TYPE_COLORS[row.leave_type] || LEAVE_TYPE_COLORS.other}`}>
                      {row.leave_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{row.start_date}</td>
                  <td className="px-4 py-3 text-slate-400">{row.end_date}</td>
                  <td className="px-4 py-3 text-slate-400">{row.days_requested}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(row.created_at).toLocaleDateString('en-GH')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => approve(row.id)} className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">
                        Approve
                      </button>
                      <button type="button" onClick={() => setRejectId(row.id)} className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectId && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h4 className="font-semibold text-white">Rejection reason</h4>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            rows={3}
          />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={confirmReject} className="rounded-full bg-red-500 px-4 py-2 text-sm text-white">
              Confirm reject
            </button>
            <button type="button" onClick={() => setRejectId(null)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
