import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const EmployeeContext = createContext(null)

export function EmployeeProvider({ children }) {
  const { profile, user } = useAuth()
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!profile?.id) {
      setEmployee(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('employees')
      .select('*, division:division_id(name)')
      .eq('profile_id', profile.id)
      .maybeSingle()

    if (error) console.warn('Employee record load failed', error)
    setEmployee(data ?? null)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    reload()
  }, [reload])

  const value = useMemo(
    () => ({
      employee,
      profile,
      email: user?.email ?? '',
      loading,
      reloadEmployee: reload,
    }),
    [employee, profile, user?.email, loading, reload]
  )

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext)
  if (!ctx) throw new Error('useEmployee must be used within EmployeeProvider')
  return ctx
}
