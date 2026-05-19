import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('arcbuild_theme')
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored)
        return
      }
    } catch {
      // ignore localStorage access failures
    }
  }, [])

  useEffect(() => {
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
