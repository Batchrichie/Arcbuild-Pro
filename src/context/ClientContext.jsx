import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ClientContext = createContext(null)

export function ClientProvider({ children }) {
  const { profile, user } = useAuth()
  const clientId = profile?.client_id ?? null
  const [clientRecord, setClientRecord] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!clientId) {
      setClientRecord(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('clients').select('id, name, email, phone').eq('id', clientId).maybeSingle()
    if (error) console.warn('Client record load failed', error)
    setClientRecord(data ?? null)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    reload()
  }, [reload])

  const value = useMemo(
    () => ({
      clientId,
      client: clientRecord,
      profile,
      email: user?.email ?? clientRecord?.email ?? '',
      loading,
      reloadClient: reload,
    }),
    [clientId, clientRecord, profile, user?.email, loading, reload]
  )

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>
}

export function useClient() {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClient must be used within ClientProvider')
  return ctx
}
