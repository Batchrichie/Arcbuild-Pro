import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // Initialize from localStorage synchronously to avoid flicker on refresh.
  const [theme, setTheme] = useState(() => {
    try {
      const stored = window.localStorage.getItem('arcbuild_theme')
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      // ignore
    }
    return 'dark'
  })

  // Use layout effect so the body class update runs before paint,
  // preventing a flash between themes on reload.
  useLayoutEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    document.body.classList.toggle('theme-dark', theme === 'dark')
    try {
      window.localStorage.setItem('arcbuild_theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
