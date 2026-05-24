import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
 *   role not allowed    → redirect to /unauthorized
 *   role allowed        → render children
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, role, loading } = useAuth()

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
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
