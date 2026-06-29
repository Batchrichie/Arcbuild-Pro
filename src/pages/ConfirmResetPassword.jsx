import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getAuthParams(searchParams) {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const hashParams = new URLSearchParams(hash)
  const queryParams = new URLSearchParams(searchParams.toString())

  return {
    code: queryParams.get('code') || hashParams.get('code'),
    token_hash: queryParams.get('token_hash') || hashParams.get('token_hash') || queryParams.get('token') || hashParams.get('token'),
    token: queryParams.get('token') || hashParams.get('token'),
    type: queryParams.get('type') || hashParams.get('type'),
    access_token: queryParams.get('access_token') || hashParams.get('access_token'),
    refresh_token: queryParams.get('refresh_token') || hashParams.get('refresh_token'),
  }
}

export default function ConfirmResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const { code, token_hash, token, type, access_token, refresh_token } = getAuthParams(searchParams)

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            setError('Invalid or expired invite link. Please request a new one.')
            setLoading(false)
            return
          }
          navigate('/auth/update-password', { replace: true })
          return
        }

        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })

          if (sessionError) {
            setError(sessionError.message || 'Invalid or expired invite link. Please request a new one.')
            setLoading(false)
            return
          }

          navigate('/auth/update-password', { replace: true })
          return
        }

        if (!type || (!token_hash && !token)) {
          setError('Invalid or missing token. Please request a new password reset link.')
          setLoading(false)
          return
        }

        if (type !== 'invite' && type !== 'recovery') {
          setError('Unsupported auth flow. Please request a new link.')
          setLoading(false)
          return
        }

        const { error: verifyError } = await supabase.auth.verifyOtp({
          type,
          token_hash: token_hash || token,
        })

        if (verifyError) {
          setError(verifyError.message || 'Invalid or expired token. Please request a new password reset link.')
          setLoading(false)
          return
        }

        navigate('/auth/update-password', { replace: true })
      } catch (err) {
        setError(err.message || 'An error occurred. Please try again.')
        setLoading(false)
      }
    }

    verifyToken()
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 rounded-3xl border border-red-900/40 bg-red-950/40 p-6">
            <h2 className="text-red-300 text-lg font-semibold mb-2">Error</h2>
            <p className="text-red-400 text-sm leading-relaxed mb-4">{error}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-amber-500 text-stone-950 font-bold px-6 py-3 text-sm tracking-widest uppercase hover:bg-amber-400 transition-colors duration-150"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent mx-auto mb-4 animate-spin" />
          <p className="text-stone-400 text-sm">{loading ? 'Verifying your reset link...' : 'Redirecting...'}</p>
        </div>
      </div>
    </div>
  )
}
