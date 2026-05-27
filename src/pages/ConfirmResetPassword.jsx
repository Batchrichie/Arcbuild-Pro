import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ConfirmResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const token_hash = searchParams.get('token_hash')
        const type = searchParams.get('type')

        if (!token_hash || !type) {
          setError('Invalid or missing token. Please request a new password reset link.')
          setLoading(false)
          return
        }

        // Verify the OTP token
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type,
          token_hash,
        })

        if (verifyError) {
          setError(verifyError.message || 'Invalid or expired token. Please request a new password reset link.')
          setLoading(false)
          return
        }

        // Token is valid, redirect to password update page
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
