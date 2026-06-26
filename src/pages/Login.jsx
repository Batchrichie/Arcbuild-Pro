import { useState, useEffect, useLayoutEffect, useRef } from 'react'
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
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = window.localStorage.getItem('ab_login_theme')
      if (stored === 'light') return false
      if (stored === 'dark')  return true
    } catch { /* ignore */ }
    return true // default dark
  })
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const brandPanelRef = useRef(null)
  const h1Ref = useRef(null)
  const taglineRef = useRef(null)

  useLayoutEffect(() => {
    document.body.classList.toggle('ab-light-mode', !isDark)
    return () => document.body.classList.remove('ab-light-mode')
  }, [isDark])

  // Parallax — desktop only
  useEffect(() => {
    const panel = brandPanelRef.current
    if (!panel) return
    const onMove = (e) => {
      if (window.innerWidth < 1024) return
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
      document.body.classList.toggle('ab-light-mode', !next)
      try { window.localStorage.setItem('ab_login_theme', next ? 'dark' : 'light') } catch { /* ignore */ }
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
      showToast('Signing you in…', 'success')
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

  const pills = [
    { icon: 'mdi:crane',           label: 'Construction' },
    { icon: 'mdi:office-building', label: 'Real Estate' },
    { icon: 'mdi:bridge',          label: 'Infrastructure' },
    { icon: 'mdi:handshake',       label: 'Consulting' },
  ]

  return (
    <div className="ab-login">
      <div className="ab-noise-overlay" />

      {/* Theme toggle — fixed top-right on all breakpoints */}
      <button
        type="button"
        onClick={toggleTheme}
        className="ab-theme-toggle"
        aria-label="Toggle theme"
        aria-pressed={!isDark}
      >
        <div className="ab-toggle-knob">
          <span className="iconify ab-moon-icon" data-icon="mdi:moon-waning-crescent" data-width="12" />
          <span className="iconify ab-sun-icon"  data-icon="mdi:white-balance-sunny"  data-width="12" />
        </div>
      </button>

      <div className="ab-layout">

        {/* ── BRAND PANEL ─────────────────────────────── */}
        <div ref={brandPanelRef} className="ab-brand-panel">

          {/* Top: logo */}
          <div className="ab-brand-top ab-reveal ab-delay-1">
            <div className="ab-logo-mark" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <polygon points="16,2 30,28 2,28" fill="#f97316" opacity="0.95"/>
                <polygon points="16,10 24,26 8,26" fill="rgba(0,0,0,0.3)"/>
              </svg>
            </div>
            <span className="ab-logo-text">ARCBUILD PRO</span>
          </div>

          {/* Middle: headline */}
          <div className="ab-brand-middle">
            <div className="ab-reveal ab-delay-2">
              <h1 ref={h1Ref} className="ab-brand-h1">MODULO</h1>
              <p className="ab-brand-sub">DEVELOPMENT LTD</p>
            </div>
            <div className="ab-reveal ab-delay-3">
              <div className="ab-divider-accent" />
              <p ref={taglineRef} className="ab-tagline">
                Construction finance for Ghana's builders.
              </p>
            </div>
          </div>

          {/* Bottom: pills + copyright */}
          <div className="ab-brand-bottom ab-reveal ab-delay-4">
            <div className="ab-pills">
              {pills.map(({ icon, label }) => (
                <span key={label} className="ab-category-pill">
                  <span className="iconify" data-icon={icon} data-width="12" />
                  {label}
                </span>
              ))}
            </div>
            <p className="ab-copyright">© 2025 {COMPANY.name}. All rights reserved.</p>
          </div>
        </div>

        {/* ── FORM PANEL ──────────────────────────────── */}
        <div className="ab-form-panel">
          <div className="ab-form-inner">

            {/* Accent dot */}
            <div className="ab-reveal ab-delay-1 ab-dot-row">
              <div className="ab-accent-dot" />
            </div>

            {/* Heading */}
            <div className="ab-reveal ab-delay-2">
              <h2 className="ab-heading">Sign in</h2>
              <p className="ab-subheading">Welcome back. Enter your credentials to continue.</p>
            </div>

            {/* Alerts */}
            {searchParams.get('reason') === 'session_expired' && (
              <div className="ab-alert ab-alert--warning ab-reveal ab-delay-2" role="alert">
                <span className="iconify" data-icon="mdi:alert-circle" data-width="16" />
                <span>Your session expired. Please sign in again.</span>
              </div>
            )}
            {error && (
              <div className="ab-alert ab-alert--error ab-reveal" role="alert">
                <span className="iconify" data-icon="mdi:alert-circle" data-width="16" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="ab-form">

              {/* Email */}
              <div className="ab-field ab-reveal ab-delay-3">
                <label htmlFor="ab-email" className="ab-field-label">Email address</label>
                <div className="ab-input-wrap">
                  <span className="ab-input-icon">
                    <span className="iconify" data-icon="mdi:email-outline" data-width="17" />
                  </span>
                  <input
                    id="ab-email"
                    type="email"
                    className="ab-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@modulo.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="ab-field ab-reveal ab-delay-4">
                <label htmlFor="ab-password" className="ab-field-label">Password</label>
                <div className="ab-input-wrap">
                  <span className="ab-input-icon">
                    <span className="iconify" data-icon="mdi:lock-outline" data-width="17" />
                  </span>
                  <input
                    id="ab-password"
                    type={showPassword ? 'text' : 'password'}
                    className="ab-input ab-input--password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="ab-eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span
                      className="iconify"
                      data-icon={showPassword ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}
                      data-width="17"
                    />
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="ab-check-row ab-reveal ab-delay-5">
                <label className="ab-check-label">
                  <input type="checkbox" className="ab-checkbox" defaultChecked />
                  <span>Keep me signed in</span>
                </label>
                <Link to="/forgot-password" className="ab-forgot-link">Forgot password?</Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="ab-submit-btn ab-reveal ab-delay-6"
                disabled={loading}
                aria-busy={loading}
              >
                {loading && (
                  <svg className="ab-spinner" viewBox="0 0 24 24" fill="none">
                    <circle className="ab-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Divider */}
            <div className="ab-divider ab-reveal ab-delay-7">
              <div className="ab-divider-line" />
              <span className="ab-divider-text">or continue with</span>
              <div className="ab-divider-line" />
            </div>

            {/* SSO */}
            <div className="ab-sso-row ab-reveal ab-delay-7">
              <button type="button" className="ab-sso-btn">
                <span className="iconify" data-icon="mdi:google"    data-width="16" />
                Google
              </button>
              <button type="button" className="ab-sso-btn">
                <span className="iconify" data-icon="mdi:microsoft" data-width="16" />
                Microsoft
              </button>
            </div>

            {/* Footer */}
            <p className="ab-footer-text ab-reveal ab-delay-8">
              No account?{' '}
              <a href="#" className="ab-signup-link">Contact your administrator</a>
            </p>

          </div>
        </div>
      </div>

      {/* Toast */}
      <div
        className="ab-toast"
        role="status"
        aria-live="polite"
        style={{
          opacity: toast.show ? 1 : 0,
          transform: toast.show
            ? 'translateX(-50%) translateY(0)'
            : 'translateX(-50%) translateY(12px)',
          pointerEvents: toast.show ? 'auto' : 'none',
        }}
      >
        <span
          className="iconify"
          data-icon={toast.type === 'error' ? 'mdi:alert-circle' : 'mdi:check-circle'}
          data-width="18"
          style={{ color: toast.type === 'error' ? '#ef4444' : '#22c55e', flexShrink: 0 }}
        />
        <span className="ab-toast-text">{toast.message}</span>
      </div>
    </div>
  )
}