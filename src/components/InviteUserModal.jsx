import { useEffect, useMemo, useState } from 'react'
import Modal from './ui/Modal'
import { ROLE_INVITE_OPTIONS, ROLE_LABELS } from '../constants/permissions'
import { supabase } from '../lib/supabase'

export default function InviteUserModal({ open, onClose, callerRole, onSuccess }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)

  const isCallerRoleReady = typeof callerRole !== 'undefined'
  const options = useMemo(() => (callerRole ? ROLE_INVITE_OPTIONS[callerRole] : []), [callerRole])

  useEffect(() => {
    if (!isCallerRoleReady) return
    setRole((prev) => prev || (callerRole === 'ceo' ? 'admin' : 'accountant'))
  }, [callerRole, isCallerRoleReady])

  const handleSubmit = async () => {
    setError(null)
    setSuccessMessage(null)

    if (!email.trim()) {
      setError('Email is required.')
      return
    }

    if (!role) {
      setError('Role is required.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        email: email.trim().toLowerCase(),
        role,
        full_name: fullName.trim() || undefined,
      }

      const { data, error: invokeError } = await supabase.functions.invoke('invite-user', {
        body: payload,
      })

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to invite user.')
      }

      const result = typeof data === 'string' ? JSON.parse(data) : data
      if (!result?.success) {
        throw new Error(result?.error || result?.message || 'Failed to invite user.')
      }

      setSuccessMessage(`Invite sent to ${email.trim()}`)
      onSuccess?.(result)
      setTimeout(() => {
        setEmail('')
        setFullName('')
        setError(null)
        setSuccessMessage(null)
        onClose?.()
      }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite User" size="md">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-border-soft bg-surface py-3 px-4 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            placeholder="user@example.com"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-2xl border border-border-soft bg-surface py-3 px-4 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-2xl border border-border-soft bg-surface py-3 px-4 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            disabled={!isCallerRoleReady}
          >
            <option value="" disabled>
              {isCallerRoleReady ? 'Select role' : 'Loading roles…'}
            </option>
            {options.map((option) => (
              <option key={option} value={option}>{ROLE_LABELS[option] || option}</option>
            ))}
          </select>
          {!isCallerRoleReady && (
            <p className="mt-2 text-sm text-slate-400">Loading your permissions before inviting a user…</p>
          )}
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {successMessage && <p className="text-sm text-emerald-300">{successMessage}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border-soft px-4 py-2 text-sm text-slate-300 hover:border-amber-400/40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          {loading ? 'Inviting…' : 'Send invite'}
        </button>
      </div>
    </Modal>
  )
}
