import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Role → portal route mapping
const ROLE_ROUTES = {
  ceo:             '/ceo',
  accountant:      '/accountant',
  project_manager: '/pm',
  hr_manager:      '/hr',
  employee:        '/employee',
  client:          '/client',
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Sign in
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      // 2. Fetch profile to read role
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

      // 3. Redirect to correct portal
      const destination = ROLE_ROUTES[profile.role] ?? '/unauthorized'
      navigate(destination, { replace: true })

    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex">

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 border-r border-stone-800 relative overflow-hidden">

        {/* Background texture lines */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 39px,
            #d6d3d1 39px,
            #d6d3d1 40px
          )`
        }} />

        {/* Top mark */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-500 flex items-center justify-center">
              <span className="text-stone-950 font-black text-xs tracking-tighter">AB</span>
            </div>
            <span className="text-stone-200 font-bold tracking-widest text-xs uppercase">
              ArcBuild Pro
            </span>
          </div>
        </div>

        {/* Centre statement */}
        <div className="relative z-10">
          <p className="text-stone-600 text-xs tracking-[0.3em] uppercase mb-8">
            Integrated Management System
          </p>
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

        {/* Bottom divisions strip */}
        <div className="relative z-10 flex gap-6">
          {['Construction', 'Architecture', 'Real Estate', 'Logistics'].map(d => (
            <div key={d} className="flex flex-col gap-1">
              <div className="w-6 h-px bg-amber-500" />
              <span className="text-stone-600 text-xs tracking-wide">{d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-8 h-8 bg-amber-500 flex items-center justify-center">
              <span className="text-stone-950 font-black text-xs">AB</span>
            </div>
            <span className="text-stone-200 font-bold tracking-widest text-xs uppercase">
              ArcBuild Pro
            </span>
          </div>

          {/* Form header */}
          <div className="mb-10">
            <p className="text-stone-600 text-xs tracking-[0.25em] uppercase mb-2">
              Portal Access
            </p>
            <h2 className="text-stone-100 text-3xl font-black tracking-tight">
              Sign in
            </h2>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 border border-red-900 bg-red-950/40 p-4">
              <p className="text-red-400 text-sm leading-relaxed">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="text-stone-500 text-xs tracking-[0.2em] uppercase"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@arcbuild.com"
                className="
                  bg-stone-900 border border-stone-800 text-stone-100
                  px-4 py-3 text-sm placeholder-stone-700
                  focus:outline-none focus:border-amber-500
                  transition-colors duration-150
                "
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="text-stone-500 text-xs tracking-[0.2em] uppercase"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="
                  bg-stone-900 border border-stone-800 text-stone-100
                  px-4 py-3 text-sm placeholder-stone-700
                  focus:outline-none focus:border-amber-500
                  transition-colors duration-150
                "
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="
                mt-2 bg-amber-500 text-stone-950 font-bold
                px-6 py-3 text-sm tracking-widest uppercase
                hover:bg-amber-400 active:bg-amber-600
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150
                flex items-center justify-center gap-3
              "
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
          </form>

          {/* Footer note */}
          <p className="mt-10 text-stone-700 text-xs text-center">
            Access is role-restricted. Contact your administrator<br />
            if you have not received your credentials.
          </p>
        </div>
      </div>
    </div>
  )
}
