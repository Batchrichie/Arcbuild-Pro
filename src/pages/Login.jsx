import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { COMPANY } from '../lib/company-config'
import logo from '../assets/ModuloDevLogo.png'
import ThemeToggle from '../components/ui/ThemeToggle'
import { roleHomeRoutes } from '../lib/roleRoutes'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', authData.user.id)
        .single()

      if (profileError || !profile) {
        setError('Account found but profile is missing. Contact your administrator.')
        setLoading(false)
        return
      }

      const destination = roleHomeRoutes[profile.role] ?? '/unauthorized'
      navigate(destination, { replace: true })

    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
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
            Built for<br />
            <span className="text-amber-500">Ghana's</span><br />
            builders.
          </h1>
          <p className="text-stone-500 text-sm leading-relaxed max-w-xs">
            Construction · Architecture · Real Estate · Logistics.
            One system. Every number. Every project.
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
              <p className="text-stone-600 text-xs tracking-[0.25em] uppercase mb-2">Portal Access</p>
              <h2 className="text-stone-100 text-3xl font-black tracking-tight">Sign in</h2>
            </div>
            <ThemeToggle className="inline-flex shrink-0" />
          </div>

          {searchParams.get('reason') === 'session_expired' && (
            <div className="mb-6 rounded-3xl border border-amber-900/40 bg-amber-950/40 p-4">
              <p className="text-amber-200 text-sm leading-relaxed">
                Your session expired. Please sign in again to continue.
              </p>
            </div>
          )}

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
                placeholder="you@modulodevelopmentltd@yahoo.com"
                className="bg-stone-900 border border-stone-800 text-stone-100 px-4 py-3 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors duration-150"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-stone-500 text-xs tracking-[0.2em] uppercase">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-900 border border-stone-800 text-stone-100 px-4 py-3 pr-24 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="toggle-button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
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
                  Signing in
                </>
              ) : (
                'Sign in'
              )}
            </button>

            <div className="mt-4 text-center">
              <Link
                to="/forgot-password"
                className="text-stone-400 hover:text-stone-300 text-xs underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </form>

          <p className="mt-10 text-stone-700 text-xs text-center">Access is role-restricted. Contact your administrator<br />if you have not received your credentials.</p>
        </div>
      </div>
    </div>
  )
}
