import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // Supabase auth user object
  const [profile, setProfile] = useState(null)   // profiles table row
  const [role, setRole]       = useState(null)   // role string shortcut
  const [loading, setLoading] = useState(true)   // true until session resolved
  const [sessionExpired, setSessionExpired] = useState(false)

  // Fetch the profiles row for a given auth user id
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, user_id, full_name')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[AuthContext] Failed to fetch profile:', error.message)
      return null
    }
    return data
  }

  // Called whenever session changes (mount, login, logout, token refresh)
  async function handleSessionChange(session, event = null, error = null) {
    if (session?.user) {
      setUser(session.user)
      const profileData = await fetchProfile(session.user.id)
      setProfile(profileData)
      setRole(profileData?.role ? String(profileData.role).toLowerCase() : null)
      setSessionExpired(false)
    } else {
      setUser(null)
      setProfile(null)
      setRole(null)
      setSessionExpired(!!error)
    }
    setLoading(false)
  }

  useEffect(() => {
    async function initializeSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          setSessionExpired(true)
          handleSessionChange(null, null, error)
          return
        }
        handleSessionChange(session)
      } catch (err) {
        setSessionExpired(true)
        handleSessionChange(null, null, err)
      }
    }

    initializeSession()

    // Listen for login / logout / token refresh events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        handleSessionChange(session, event)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    // handleSessionChange(null) fires automatically via onAuthStateChange
  }

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, sessionExpired, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// Convenience hook — throws if used outside AuthProvider
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
