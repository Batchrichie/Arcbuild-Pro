import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center rounded-full border border-border-soft bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 ${className}`}
    >
      {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
    </button>
  )
}
