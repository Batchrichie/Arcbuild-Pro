import ThemeToggle from './ThemeToggle'

/** Theme toggle + sign out for desktop portal sidebars (lg+). */
export default function PortalSidebarFooter({ onSignOut, signOutLabel = 'Sign Out', signOutClassName = '' }) {
  return (
    <div className="mt-auto w-full shrink-0 space-y-3 pt-4">
      <ThemeToggle className="w-full justify-center" />
      <button
        type="button"
        onClick={onSignOut}
        className={`min-touch w-full rounded-full border border-border-soft px-4 py-3 text-sm transition ${signOutClassName}`}
      >
        {signOutLabel}
      </button>
    </div>
  )
}
