import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { COMPANY } from '../lib/company-config'
import { roleHomeRoutes } from '../lib/roleRoutes'
import '../styles/login.css'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const brandPanelRef = useRef(null)
  const h1Ref = useRef(null)
  const taglineRef = useRef(null)

  // Sync theme class with body
  useEffect(() => {
    document.body.classList.toggle('light-mode', !isDark)
    return () => document.body.classList.remove('light-mode')
  }, [isDark])

  // Parallax effect
  useEffect(() => {
    const panel = brandPanelRef.current
    if (!panel) return

    const onMove = (e) => {
      const rect = panel.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      if (h1Ref.current) {
        h1Ref.current.style.transition = 'transform 0.1s ease-out'
        h1Ref.current.style.transform = `translate(${x * -8}px, ${y * -5}px)`
      }
      if (taglineRef.current) {
        taglineRef.current.style.transition = 'transform 0.1s ease-out'
        taglineRef.current.style.transform = `translate(${x * -4}px, ${y * -3}px)`
      }
    }

    const onLeave = () => {
      if (h1Ref.current) {
        h1Ref.current.style.transition = 'transform 0.5s ease'
        h1Ref.current.style.transform = 'translate(0,0)'
      }
      if (taglineRef.current) {
        taglineRef.current.style.transition = 'transform 0.5s ease'
        taglineRef.current.style.transform = 'translate(0,0)'
      }
    }

    panel.addEventListener('mousemove', onMove)
    panel.addEventListener('mouseleave', onLeave)
    return () => {
      panel.removeEventListener('mousemove', onMove)
      panel.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  function showToast(message, type = 'success') {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev
      document.body.classList.toggle('light-mode', !next)
      return next
    })
  }

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

      showToast('Signing you in...', 'success')

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
    <div className="login-container min-h-screen overflow-x-hidden">
      <div className="noise-overlay" />

      <div className="split-layout flex min-h-screen">

        {/* ===== LEFT PANEL — Brand ===== */}
        <div
          ref={brandPanelRef}
          className="brand-panel w-[60%] relative hidden lg:flex lg:flex-col justify-between p-12 lg:p-16"
        >
          <div className="reveal delay-1">
            <h1
              ref={h1Ref}
              className="brand-h1 text-6xl lg:text-7xl font-black tracking-tighter leading-[0.9]"
            >
            MODULO 
            </h1>
            <p className="brand-sub text-lg lg:text-xl font-light tracking-[0.15em] mt-1 uppercase">
              DEVELOPMENT LTD
            </p>
          </div>

          <div className="reveal delay-3">
            <div className="w-24 h-px bg-orange-500 mb-6" />
            <p
              ref={taglineRef}
              className="tagline text-xl lg:text-2xl font-light max-w-md leading-relaxed"
            >
              Construction finance for Ghana's builders.
            </p>
          </div>

          <div className="reveal delay-5">
            <div className="category-grid grid grid-cols-2 gap-3 max-w-xs mb-10">
              {[
                { icon: 'mdi:crane', label: 'Construction' },
                { icon: 'mdi:office-building', label: 'Real Estate' },
                { icon: 'mdi:bridge', label: 'Infrastructure' },
                { icon: 'mdi:handshake', label: 'Consulting' },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="category-pill pill-border inline-flex items-center border rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.15em] pill-text"
                >
                  <span className="iconify pill-icon mr-2" data-icon={icon} data-width="14" />
                  {label}
                </span>
              ))}
            </div>
            <p className="copyright text-[10px] tracking-wide">
              © 2025 {COMPANY.name}. All rights reserved.
            </p>
          </div>
        </div>

        {/* ===== RIGHT PANEL — Login Form ===== */}
        <div className="right-panel-bg w-full lg:w-[40%] relative flex items-center justify-center form-glow">
          <div className="w-full max-w-sm px-8">

            {/* Theme Toggle */}
            <div className="reveal delay-1 flex justify-end mb-10">
              <button
                onClick={toggleTheme}
                className="theme-toggle"
                aria-label="Toggle theme"
                aria-pressed={!isDark}
                type="button"
              >
                <div className="toggle-knob">
                  <span className="iconify moon-icon" data-icon="mdi:moon-waning-crescent" data-width="12" />
                  <span className="iconify sun-icon" data-icon="mdi:white-balance-sunny" data-width="12" />
                </div>
              </button>
            </div>

            {/* Orange Dot */}
            <div className="reveal delay-2 flex justify-center mb-8">
              <div className="w-2 h-2 rounded-full bg-orange-500 shadow-lg shadow-orange-500/30" />
            </div>

            {/* Heading */}
            <div className="reveal delay-2 text-center mb-2">
              <h2 className="text-2xl font-medium tracking-tight">Sign in</h2>
            </div>
            <div className="reveal delay-3 text-center mb-10">
              <p className="form-hint text-sm font-light">
                Welcome back. Enter your credentials to continue.
              </p>
            </div>

            {/* Session Expired Alert */}
            {searchParams.get('reason') === 'session_expired' && (
              <div className="reveal delay-3 mb-6 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 flex items-center gap-2">
                <span className="iconify" data-icon="mdi:alert-circle" data-width="18" />
                <p className="text-orange-400 text-sm">Your session expired. Please sign in again.</p>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-2">
                <span className="iconify" data-icon="mdi:alert-circle" data-width="18" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>

              {/* Email */}
              <div className="reveal delay-3 mb-6">
                <label className="form-label block text-[10px] uppercase tracking-[0.15em] mb-2 font-medium">
                  Email address
                </label>
                <div className="relative">
                  <span className="iconify input-icon absolute left-3.5 top-1/2 -translate-y-1/2" data-icon="mdi:email-outline" data-width="18" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@arcbuild.com"
                    required
                    className="input-field w-full border rounded-lg pl-10 pr-4 py-3.5 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="reveal delay-4 mb-5">
                <label className="form-label block text-[10px] uppercase tracking-[0.15em] mb-2 font-medium">
                  Password
                </label>
                <div className="relative">
                  <span className="iconify input-icon absolute left-3.5 top-1/2 -translate-y-1/2" data-icon="mdi:lock-outline" data-width="18" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input-field w-full border rounded-lg pl-10 pr-11 py-3.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle absolute right-3.5 top-1/2 -translate-y-1/2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span
                      className="iconify"
                      data-icon={showPassword ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}
                      data-width="18"
                    />
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="reveal delay-5 flex items-center justify-between mb-8">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="custom-checkbox" defaultChecked />
                  <span className="text-xs form-hint">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-xs text-orange-500/70 hover:text-orange-500 transition-colors duration-200 hover:underline">
                  Forgot password?
                </Link>
              </div>

              {/* Sign In Button */}
              <div className="reveal delay-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-glow w-full h-12 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold uppercase tracking-[0.15em] text-white transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="reveal delay-7 flex items-center gap-4 my-8">
              <div className="flex-1 h-px divider-line" />
              <span className="divider-text text-[10px] uppercase tracking-[0.15em]">or</span>
              <div className="flex-1 h-px divider-line" />
            </div>

            {/* Social Login */}
            <div className="reveal delay-7 flex gap-3 mb-8">
              <button
                type="button"
                className="social-btn social-border flex-1 flex items-center justify-center gap-2.5 h-11 border rounded-lg bg-transparent social-text text-xs tracking-wide"
              >
                <span className="iconify" data-icon="mdi:google" data-width="16" />
                Google
              </button>
              <button
                type="button"
                className="social-btn social-border flex-1 flex items-center justify-center gap-2.5 h-11 border rounded-lg bg-transparent social-text text-xs tracking-wide"
              >
                <span className="iconify" data-icon="mdi:microsoft" data-width="16" />
                Microsoft
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="reveal delay-8 text-center">
              <p className="signup-text text-sm">
                Don&apos;t have an account?{' '}
                <a href="#" className="text-orange-500 hover:text-orange-400 font-medium transition-colors duration-200 underline underline-offset-2">
                  Contact your administrator
                </a>
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Toast */}
      <div
        className="toast-bg fixed bottom-8 left-1/2 -translate-x-1/2 z-60 border rounded-lg px-6 py-3.5 flex items-center gap-3 shadow-2xl shadow-black/20"
        style={{
          opacity: toast.show ? 1 : 0,
          transform: toast.show ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(16px)',
          pointerEvents: toast.show ? 'auto' : 'none',
          transition: 'all 0.5s ease',
        }}
      >
        <span
          className="iconify"
          data-icon={toast.type === 'error' ? 'mdi:alert-circle' : 'mdi:check-circle'}
          data-width="20"
          style={{ color: toast.type === 'error' ? '#ef4444' : '#22c55e' }}
        />
        <span className="text-sm" style={{ color: 'var(--toast-text, #d4d4d8)' }}>
          {toast.message}
        </span>
      </div>
    </div>
  )
}