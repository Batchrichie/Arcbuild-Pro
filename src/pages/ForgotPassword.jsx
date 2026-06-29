import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { COMPANY } from '../lib/company-config'
import logo from '../assets/ModuloDevLogo.png'
import ThemeToggle from '../components/ui/ThemeToggle'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <img src={logo} alt={COMPANY.shortName} className="w-10 h-10 rounded-3xl object-cover" />
            <span className="text-stone-200 font-bold tracking-widest text-xs uppercase">{COMPANY.shortName}</span>
          </div>

          <div className="mb-10">
            <h2 className="text-stone-100 text-3xl font-black tracking-tight mb-2">Check your email</h2>
            <p className="text-stone-400 text-sm">We've sent a password reset link to:</p>
            <p className="text-amber-500 font-semibold mt-2">{email}</p>
          </div>

          <div className="rounded-3xl border border-emerald-900/40 bg-emerald-950/40 p-4 mb-6">
            <p className="text-emerald-400 text-sm leading-relaxed">
              Click the link in your email to reset your password. The link will expire in 24 hours.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-stone-500 text-xs text-center">Didn't receive the email?</p>
            <button
              onClick={() => {
                setSuccess(false)
                setEmail('')
                setError(null)
              }}
              className="w-full bg-amber-500 text-stone-950 font-bold px-6 py-3 text-sm tracking-widest uppercase hover:bg-amber-400 active:bg-amber-600 transition-colors duration-150"
            >
              Try another email
            </button>

            <Link
              to="/login"
              className="block text-center text-stone-400 hover:text-stone-300 text-xs underline transition-colors"
            >
              Back to sign in
            </Link>
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
            Reset your<br />
            <span className="text-amber-500">password</span>
          </h1>
          <p className="text-stone-500 text-sm leading-relaxed max-w-xs">
            Enter your email address and we'll send you a link to reset your password.
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
              <p className="text-stone-600 text-xs tracking-[0.25em] uppercase mb-2">Account Recovery</p>
              <h2 className="text-stone-100 text-3xl font-black tracking-tight">Forgot password?</h2>
            </div>
            <ThemeToggle className="inline-flex shrink-0" />
          </div>

          {error && (
            <div className="mb-6 rounded-3xl border border-red-900/40 bg-red-950/40 p-4">
              <p className="text-red-400 text-sm leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-stone-500 text-xs tracking-[0.2em] uppercase">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-stone-900 border border-stone-800 text-stone-100 px-4 py-3 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors duration-150"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-amber-500 text-stone-950 font-bold px-6 py-3 text-sm tracking-widest uppercase hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <Link
            to="/login"
            className="mt-6 block text-center text-stone-400 hover:text-stone-300 text-xs underline transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
