import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const REDIRECT_PATH_BY_ROLE = {
  employee: '/employee',
  client: '/client',
  project_manager: '/pm',
  accountant: '/accountant',
  hr_manager: '/hr',
  ceo: '/ceo',
}

export default function AuthConfirm() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Verifying your invite link…')
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    const redirectToRole = async (session) => {
      if (!session?.user) {
        if (mounted) {
          setError('No user session found. Please sign in manually.')
          setStatus(null)
        }
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      if (profileError) {
        if (mounted) {
          setError(profileError.message)
          setStatus(null)
        }
        return
      }

      const role = profile?.role
      const target = REDIRECT_PATH_BY_ROLE[role] ?? '/login'

      if (mounted) {
        setStatus('Access granted. Redirecting…')
        setError(null)
      }

      navigate(target, { replace: true })
    }

    const handleConfirm = async () => {
      setStatus('Verifying your invite link…')
      setError(null)

      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (mounted) {
            setError('Invalid or expired invite link. Please request a new one.')
            setStatus(null)
          }
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (mounted) {
          setError('No valid session found. Please request a new invite.')
          setStatus(null)
        }
        return
      }

      await redirectToRole(session)
    }

    handleConfirm()

    return () => {
      mounted = false
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Portal Invite</p>
          <h1 className="mt-4 text-2xl font-semibold text-white">Confirming your access</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Please wait while we verify your Supabase invite link and send you to the right portal.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            <p className="font-semibold">⚠ Invite verification failed</p>
            <p className="mt-2">{error}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/80 p-4 text-sm text-slate-300">
            <p>{status}</p>
          </div>
        )}
      </div>
    </div>
  )
}
