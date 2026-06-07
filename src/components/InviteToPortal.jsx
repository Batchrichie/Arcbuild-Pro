import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function InviteToPortal({
  email,
  inviteData = {},
  buttonText = 'Send portal invite',
  successMessage,
  className,
  onSuccess,
  onError,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const handleInvite = async () => {
    if (!email) {
      setError('No email available for invite.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = { email, ...inviteData }
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: JSON.stringify(payload),
      })

      if (error) {
        throw error
      }

      setSent(true)
      onSuccess?.(email, data)
    } catch (err) {
      const message = err?.message || 'Failed to send invite.'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  if (!email) {
    return <p className="text-sm text-slate-500">No email available for this invite.</p>
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleInvite}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {loading ? 'Sending…' : buttonText}
      </button>
      {sent && (
        <p className="mt-2 text-sm text-emerald-300">
          {successMessage ?? `Invite sent to ${email}`}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  )
}
