import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Building2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ClientProvider, useClient } from '../../context/ClientContext'
import { COMPANY } from '../../lib/company-config'
import logo from '../../assets/ModuloDevLogo.png'
import ThemeToggle from '../../components/ui/ThemeToggle'
import EmptyState from '../../components/ui/EmptyState'
import { useTheme } from '../../context/ThemeContext'

// Lazy load client portal components
const ClientProjects = lazy(() => import('../../components/client/ClientProjects'))
const ClientInvoices = lazy(() => import('../../components/client/ClientInvoices'))
const ClientDocuments = lazy(() => import('../../components/client/ClientDocuments'))
const ClientMessages = lazy(() => import('../../components/client/ClientMessages'))

// Component skeleton loader
function PortalComponentLoader() {
  return (
    <div className="flex h-96 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50">
      <div className="text-center">
        <div className="mb-3 inline-flex h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900"></div>
        <p className="text-sm text-slate-600">Loading panel...</p>
      </div>
    </div>
  )
}


const NAV = [
  { id: 'projects', label: 'My Projects' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'documents', label: 'Documents' },
  { id: 'messages', label: 'Messages' },
]

function ClientPortalContent() {
  const { profile, signOut } = useAuth()
  const { client, email, loading } = useClient()
  const [tab, setTab] = useState('projects')
  const [menuOpen, setMenuOpen] = useState(false)
  const [projectId, setProjectId] = useState(null)

  const displayName = client?.name || profile?.full_name || 'Client'
  const { theme, setTheme } = useTheme()
  const previousThemeRef = useRef(theme)

  const render = () => {
    switch (tab) {
      case 'projects':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <ClientProjects selectedProjectId={projectId} onSelectProject={setProjectId} onSwitchTab={setTab} />
          </Suspense>
        )
      case 'invoices':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <ClientInvoices />
          </Suspense>
        )
      case 'documents':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <ClientDocuments />
          </Suspense>
        )
      case 'messages':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <ClientMessages />
          </Suspense>
        )
      default:
        return null
    }
  }

  useEffect(() => {
    previousThemeRef.current = theme
    setTheme('light')
    return () => setTheme(previousThemeRef.current)
  }, [setTheme])

  useEffect(() => {
    try { document.title = `${COMPANY.appName} — Client` } catch { /* best effort */ }
  }, [])

  return (
    <div className="portal-shell min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
            <img src={logo} alt={COMPANY.shortName} className="h-10 w-10 rounded-xl object-cover" />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{COMPANY.shortName}</p>
              <p className="text-xs text-slate-500">Client portal</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === item.id ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500">{email}</p>
            </div>
            <ThemeToggle className="inline-flex shrink-0" />
            <button type="button" onClick={signOut} className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 sm:block">
              Sign out
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 md:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <>
          <button type="button" className="fixed inset-0 z-50 bg-black/30 md:hidden" aria-label="Close" onClick={() => setMenuOpen(false)} />
          <div className="client-drawer fixed right-0 top-0 z-60 flex h-full w-[min(100%,280px)] flex-col bg-white p-6 shadow-xl md:hidden">
            <div className="mb-6 flex items-center justify-between">
              <p className="font-semibold text-slate-900">Menu</p>
              <button type="button" onClick={() => setMenuOpen(false)} className="text-slate-500">Close</button>
            </div>
            <p className="mb-4 text-sm font-medium text-slate-900">{displayName}</p>
            <div className="mb-4">
              <ThemeToggle className="w-full justify-center" />
            </div>
            <nav className="flex flex-col gap-2">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id)
                    setMenuOpen(false)
                  }}
                  className={`rounded-lg px-4 py-3 text-left text-sm lg:text-[15px] font-medium ${
                    tab === item.id ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <button type="button" onClick={signOut} className="mt-auto rounded-lg border border-slate-200 py-3 text-sm text-slate-600">
              Sign out
            </button>
          </div>
        </>
      )}

      <main className="w-full min-w-0 overflow-x-hidden pb-24 lg:pb-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {loading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
        ) : !client ? (
          <EmptyState
            icon={Building2}
            title="Client details are not available"
            description="Please check back once your client profile has loaded or contact your account administrator."
          />
        ) : (
          render()
        )}
      </main>
    </div>
  )
}

export default function ClientPortal() {
  return (
    <ClientProvider>
      <ClientPortalContent />
    </ClientProvider>
  )
}

