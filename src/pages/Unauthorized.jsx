import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { signOut, role } = useAuth()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
      <div className="max-w-sm w-full">
        <div className="w-8 h-px bg-red-500 mb-8" />
        <p className="text-stone-600 text-xs tracking-[0.25em] uppercase mb-2">Error 403</p>
        <h1 className="text-stone-100 text-4xl font-black tracking-tight mb-4">
          Access<br />denied.
        </h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-8">
          Your role{role ? ` (${role})` : ''} does not have permission
          to view this page. Contact your administrator if you believe
          this is an error.
        </p>
        <button
          onClick={handleSignOut}
          className="text-amber-500 text-xs tracking-widest uppercase hover:text-amber-400 transition-colors"
        >
          ← Sign out
        </button>
      </div>
    </div>
  )
}
