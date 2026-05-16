/**
 * PortalPlaceholder
 * Temporary component used by all 6 portal routes.
 * Will be replaced with full portal UI in Phase 4.
 */
export function PortalPlaceholder({ label, profile, signOut, navigate, color }) {
  const colors = {
    amber:   'border-amber-500 text-amber-500',
    emerald: 'border-emerald-500 text-emerald-500',
    sky:     'border-sky-500 text-sky-500',
    violet:  'border-violet-500 text-violet-500',
    orange:  'border-orange-500 text-orange-500',
    teal:    'border-teal-500 text-teal-500',
  }
  const accent = colors[color] ?? colors.amber

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
      <div className="max-w-sm w-full">
        <div className={`w-8 h-px mb-8 ${accent.split(' ')[0].replace('text-', 'bg-').replace('border-', 'bg-')}`}
          style={{ backgroundColor: 'currentColor' }}
        />
        <p className="text-stone-600 text-xs tracking-[0.25em] uppercase mb-2">
          ArcBuild Pro
        </p>
        <h1 className={`text-4xl font-black tracking-tight mb-2 ${accent.split(' ')[1]}`}>
          {label}
        </h1>
        <h2 className="text-stone-100 text-4xl font-black tracking-tight mb-6">
          Portal
        </h2>
        {profile && (
          <div className="border border-stone-800 p-4 mb-8">
            <p className="text-stone-400 text-sm mb-1">Signed in as</p>
            <p className="text-stone-100 font-semibold">{profile.full_name}</p>
            <p className="text-stone-600 text-xs mt-1">{profile.role}</p>
          </div>
        )}
        <p className="text-stone-600 text-xs leading-relaxed mb-8">
          Phase 4 will replace this screen with the full {label.toLowerCase()} dashboard,
          including all modules and features defined in the development plan.
        </p>
        <button
          onClick={handleSignOut}
          className="text-stone-500 text-xs tracking-widest uppercase hover:text-stone-300 transition-colors"
        >
          ← Sign out
        </button>
      </div>
    </div>
  )
}
