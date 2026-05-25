import { useTheme } from '../../context/ThemeContext'

function SunIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      />
    </svg>
  )
}

export default function ThemeToggle({ className = '', compact = false }) {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  const Icon = theme === 'dark' ? SunIcon : MoonIcon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border-soft bg-panel px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-overlay ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="hidden sm:inline">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      )}
      {!compact && <span className="sr-only sm:hidden">{label}</span>}
    </button>
  )
}
