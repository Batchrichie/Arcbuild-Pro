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
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Spinner */}
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-stone-400 text-sm tracking-widest uppercase">
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
