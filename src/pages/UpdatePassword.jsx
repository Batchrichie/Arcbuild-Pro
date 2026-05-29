import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { COMPANY } from '../lib/company-config'
import logo from '../assets/ModuloDevLogo.png'
import ThemeToggle from '../components/ui/ThemeToggle'

export default function UpdatePassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    // Check if user has a valid session (from the OTP verification)
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('Your session has expired. Please request a new password reset link.')
        }
        setSessionChecked(true)
      } catch (err) {
        setError('Unable to verify session.')
        setSessionChecked(true)
      }
    }

    checkSession()
  }, [])

  async function handleUpdatePassword(e) {
    e.preventDefault()
    setError(null)

    // Validation
    if (!password) {
      setError('Please enter a new password')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent mx-auto mb-4 animate-spin" />
            <p className="text-stone-400 text-sm">Checking session...</p>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <img src={logo} alt={COMPANY.shortName} className="w-10 h-10 rounded-3xl object-cover" />
            <span className="text-stone-200 font-bold tracking-widest text-xs uppercase">{COMPANY.shortName}</span>
          </div>

          <div className="rounded-3xl border border-emerald-900/40 bg-emerald-950/40 p-6 text-center mb-8">
            <div className="text-3xl mb-3">✓</div>
            <h2 className="text-emerald-300 text-lg font-semibold mb-2">Password Updated</h2>
            <p className="text-emerald-400 text-sm">
              Your password has been successfully reset. You'll be redirected to sign in shortly.
            </p>
          </div>

          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full bg-amber-500 text-stone-950 font-bold px-6 py-3 text-sm tracking-widest uppercase hover:bg-amber-400 transition-colors duration-150"
          >
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  if (error && !sessionChecked) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <img src={logo} alt={COMPANY.shortName} className="w-10 h-10 rounded-3xl object-cover" />
            <span className="text-stone-200 font-bold tracking-widest text-xs uppercase">{COMPANY.shortName}</span>
          </div>

          <div className="mb-6 rounded-3xl border border-red-900/40 bg-red-950/40 p-6">
            <h2 className="text-red-300 text-lg font-semibold mb-2">Error</h2>
            <p className="text-red-400 text-sm leading-relaxed mb-4">{error}</p>
            <button
              onClick={() => navigate('/forgot-password', { replace: true })}
              className="w-full bg-amber-500 text-stone-950 font-bold px-6 py-3 text-sm tracking-widest uppercase hover:bg-amber-400 transition-colors duration-150"
            >
              Request new reset link
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 border-r border-stone-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, #d6d3d1 39px, #d6d3d1 40px)`
        }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-3xl bg-amber-500 flex items-center justify-center text-sm font-black text-slate-950">
              MD
            </div>
            <span className="text-stone-200 font-bold tracking-widest text-xs uppercase">{COMPANY.shortName}</span>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-stone-600 text-xs tracking-[0.3em] uppercase mb-8">Integrated Management System</p>
          <h1 className="text-stone-100 font-black text-6xl leading-none tracking-tight mb-6">
            Set a new<br />
            <span className="text-amber-500">password</span>
          </h1>
          <p className="text-stone-500 text-sm leading-relaxed max-w-xs">
            Create a strong password to secure your account.
          </p>
        </div>

        <div className="relative z-10 flex gap-6">
          {['Construction', 'Architecture', 'Real Estate', 'Logistics'].map((d) => (
            <div key={d} className="flex flex-col gap-1">
              <div className="w-6 h-px bg-amber-500" />
              <span className="text-stone-600 text-xs tracking-wide">{d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <img src={logo} alt={COMPANY.shortName} className="w-10 h-10 rounded-3xl object-cover" />
            <span className="text-stone-200 font-bold tracking-widest text-xs uppercase">{COMPANY.shortName}</span>
          </div>

          <div className="mb-10 flex items-center justify-between gap-4">
            <div>
              <p className="text-stone-600 text-xs tracking-[0.25em] uppercase mb-2">Set New Password</p>
              <h2 className="text-stone-100 text-3xl font-black tracking-tight">Create password</h2>
            </div>
            <ThemeToggle className="inline-flex shrink-0" />
          </div>

          {error && (
            <div className="mb-6 rounded-3xl border border-red-900/40 bg-red-950/40 p-4">
              <p className="text-red-400 text-sm leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-stone-500 text-xs tracking-[0.2em] uppercase">New password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-3 pr-24 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-400 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="confirmPassword" className="text-stone-500 text-xs tracking-[0.2em] uppercase">Confirm password</label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-3 pr-24 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-400 transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-amber-500 text-stone-950 font-bold px-6 py-3 text-sm tracking-widest uppercase hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                  Updating…
                </>
              ) : (
                'Update password'
              )}
            </button>
          </form>

          <p className="mt-6 text-stone-500 text-xs text-center">
            Use a strong password with at least 8 characters, including letters, numbers, and symbols.
          </p>
        </div>
      </div>
    </div>
  )
}
