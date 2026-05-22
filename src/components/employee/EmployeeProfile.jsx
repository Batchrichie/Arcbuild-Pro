import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useEmployee } from '../../context/EmployeeContext'
import { useAuth } from '../../context/AuthContext'
import { maskAccount, maskSsnit, maskTin } from '../../lib/employee-utils'

const inputCls = 'w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2.5 text-sm text-white'

const UPDATE_FIELDS = [
  'Full name',
  'Phone',
  'Bank name',
  'Bank account',
  'TIN',
  'SSNIT number',
]

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value || '—'}</p>
    </div>
  )
}

export default function EmployeeProfile() {
  const { employee, profile, email, loading } = useEmployee()
  const { profile: authProfile } = useAuth()
  const [showRequest, setShowRequest] = useState(false)
  const [req, setReq] = useState({ field: UPDATE_FIELDS[0], value: '', reason: '' })
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  const submitRequest = async (e) => {
    e.preventDefault()
    if (!authProfile?.id) return
    setError(null)
    setStatus(null)

    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('project_id')
      .eq('profile_id', authProfile.id)
      .limit(1)

    const projectId = assignments?.[0]?.project_id
    if (!projectId) {
      setError('No project assignment found — contact HR directly to update your profile.')
      return
    }

    const body = `[Profile update request]\nField: ${req.field}\nNew value: ${req.value}\nReason: ${req.reason}`

    const { error: err } = await supabase.from('messages').insert({
      project_id: projectId,
      sender_id: authProfile.id,
      message_body: body,
    })

    if (err) {
      setError(err.message)
      return
    }

    setStatus('Request sent to HR via project messages.')
    setShowRequest(false)
    setReq({ field: UPDATE_FIELDS[0], value: '', reason: '' })
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
  }

  if (!employee) {
    return <p className="text-sm text-slate-500">Employee record not found. Contact HR.</p>
  }

  return (
    <div className="space-y-6 pb-4">
      <section className="space-y-4 rounded-2xl border border-border-soft bg-white/5 p-4">
        <h3 className="font-semibold text-white">Personal</h3>
        <Field label="Full name" value={profile?.full_name} />
        <Field label="Email" value={email} />
        <Field label="Phone" value={profile?.phone} />
      </section>

      <section className="space-y-4 rounded-2xl border border-border-soft bg-white/5 p-4">
        <h3 className="font-semibold text-white">Employment</h3>
        <Field label="Employee number" value={employee.employee_number} />
        <Field label="Job title" value={employee.job_title} />
        <Field label="Department" value={employee.department} />
        <Field label="Division" value={employee.division?.name} />
        <Field label="Contract type" value={employee.contract_type} />
        <Field label="Hire date" value={employee.hire_date} />
      </section>

      <section className="space-y-4 rounded-2xl border border-border-soft bg-white/5 p-4">
        <h3 className="font-semibold text-white">Banking</h3>
        <Field label="Bank name" value={employee.bank_name} />
        <Field label="Account number" value={maskAccount(employee.bank_account)} />
      </section>

      <section className="space-y-4 rounded-2xl border border-border-soft bg-white/5 p-4">
        <h3 className="font-semibold text-white">Payroll identifiers</h3>
        <Field label="TIN" value={maskTin(employee.tin)} />
        <Field label="SSNIT number" value={maskSsnit(employee.ssnit_number)} />
      </section>

      {!showRequest ? (
        <button
          type="button"
          onClick={() => setShowRequest(true)}
          className="min-touch w-full rounded-full border border-orange-400/40 bg-orange-500/15 py-3 text-sm font-semibold text-orange-100"
        >
          Request update
        </button>
      ) : (
        <form onSubmit={submitRequest} className="space-y-3 rounded-2xl border border-border-soft bg-white/5 p-4">
          <h3 className="font-semibold text-white">Request profile update</h3>
          <select className={inputCls} value={req.field} onChange={(e) => setReq({ ...req, field: e.target.value })}>
            {UPDATE_FIELDS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <input required className={inputCls} placeholder="New value" value={req.value} onChange={(e) => setReq({ ...req, value: e.target.value })} />
          <textarea required className={inputCls} rows={3} placeholder="Reason" value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} />
          {error && <p className="text-sm text-red-300">{error}</p>}
          {status && <p className="text-sm text-emerald-300">{status}</p>}
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-full bg-orange-500 py-2.5 text-sm font-bold text-slate-950">Send to HR</button>
            <button type="button" onClick={() => setShowRequest(false)} className="rounded-full border border-border-soft px-4 py-2.5 text-sm text-slate-300">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
