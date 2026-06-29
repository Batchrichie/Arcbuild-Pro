import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { roleHomeRoutes } from '../lib/roleRoutes'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Finishing sign-in…')
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    const finalizeAuth = async () => {
      try {
        setStatus('Finishing sign-in…')
        setError(null)

        const params = new URLSearchParams(window.location.search)
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
        const hashParams = new URLSearchParams(hash)
        const accessToken = hashParams.get('access_token') || params.get('access_token')
        const refreshToken = hashParams.get('refresh_token') || params.get('refresh_token')
        const type = hashParams.get('type') || params.get('type')
        const code = params.get('code')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
        } else if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (setSessionError) {
            throw setSessionError
          }
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          throw sessionError
        }

        if (!session) {
          throw new Error('No active session was created from this link.')
        }

        const isPasswordFlow = type === 'invite' || type === 'recovery'

        if (mounted) {
          setStatus(isPasswordFlow ? 'Redirecting to password setup…' : 'Redirecting to your portal…')
        }

        if (isPasswordFlow) {
          navigate('/auth/update-password', { replace: true })
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (profileError) {
          throw profileError
        }

        const destination = profile?.role && roleHomeRoutes[profile.role]
          ? roleHomeRoutes[profile.role]
          : '/login'

        navigate(destination, { replace: true })
      } catch (err) {
        if (mounted) {
          setError(err?.message || 'We could not finish your sign-in. Please request a new invite link.')
          setStatus(null)
        }
      }
    }

    finalizeAuth()

    return () => {
      mounted = false
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent mx-auto mb-4 animate-spin" />
          <p className="text-stone-400 text-sm">{status || 'Processing your sign-in link…'}</p>
          {error && (
            <p className="mt-4 text-sm text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
