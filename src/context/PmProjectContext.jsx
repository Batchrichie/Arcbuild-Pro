import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'arcbuild_pm_selected_project'

const PmProjectContext = createContext(null)

export function PmProjectProvider({ children }) {
  const { profile } = useAuth()
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || ''
    } catch {
      return ''
    }
  })
  const [loading, setLoading] = useState(true)

  const loadProjects = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('project_assignments')
        .select('project_id, projects(id, name, status, division_id, divisions(name))')
        .eq('profile_id', profile.id)

      if (error) throw error
      const list = (data ?? []).map((row) => row.projects).filter(Boolean)
      setProjects(list)

      setSelectedProjectId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev
        const next = list[0]?.id || ''
        if (next) {
          try {
            sessionStorage.setItem(STORAGE_KEY, next)
          } catch {
            /* ignore */
          }
        }
        return next
      })
    } catch (err) {
      console.warn('PM projects load failed', err)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const selectProject = useCallback((projectId) => {
    setSelectedProjectId(projectId)
    try {
      sessionStorage.setItem(STORAGE_KEY, projectId)
    } catch {
      /* ignore */
    }
  }, [])

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  )

  const value = useMemo(
    () => ({
      projects,
      selectedProjectId,
      selectedProject,
      selectProject,
      loading,
      reloadProjects: loadProjects,
    }),
    [projects, selectedProjectId, selectedProject, selectProject, loading, loadProjects]
  )

  return <PmProjectContext.Provider value={value}>{children}</PmProjectContext.Provider>
}

export function usePmProject() {
  const ctx = useContext(PmProjectContext)
  if (!ctx) throw new Error('usePmProject must be used within PmProjectProvider')
  return ctx
}
