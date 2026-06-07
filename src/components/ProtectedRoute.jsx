import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleHomeRoutes } from '../lib/roleRoutes'

/**
 * ProtectedRoute
 *
 * Props:
 *   allowedRoles  string[]   Roles permitted to access this route.
 *   children      ReactNode  Component to render when access is granted.
 *
 * Behaviour:
 *   loading             → show spinner (session not yet resolved)
 *   no session          → redirect to /login
 *   role not allowed    → redirect to role home if valid, otherwise /unauthorized
 *   role allowed        → render children
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, role, loading, sessionExpired } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber border-t-transparent" />
          <span className="portal-eyebrow text-text-muted">
            Authenticating
          </span>
        </div>
      </div>
    )
  }

  if (!user) {
    const redirectPath = sessionExpired ? '/login?reason=session_expired' : '/login'
    return <Navigate to={redirectPath} replace />
  }

  if (!allowedRoles.includes(role)) {
    const homeRoute = roleHomeRoutes[role]
    if (homeRoute) {
      return <Navigate to={homeRoute} replace />
    }
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
