import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ClientProvider, useClient } from '../../context/ClientContext'
import ClientProjects from '../../components/client/ClientProjects'
import ClientInvoices from '../../components/client/ClientInvoices'
import ClientDocuments from '../../components/client/ClientDocuments'
import ClientMessages from '../../components/client/ClientMessages'

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

  const render = () => {
    switch (tab) {
      case 'projects':
        return <ClientProjects selectedProjectId={projectId} onSelectProject={setProjectId} />
      case 'invoices':
        return <ClientInvoices />
      case 'documents':
        return <ClientDocuments />
      case 'messages':
        return <ClientMessages />
      default:
        return null
    }
  }

  return (
    <div className="client-portal min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white">
              AB
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900">ArcBuild Pro</p>
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
          <div className="client-drawer fixed right-0 top-0 z-[60] flex h-full w-[min(100%,280px)] flex-col bg-white p-6 shadow-xl md:hidden">
            <div className="mb-6 flex items-center justify-between">
              <p className="font-semibold text-slate-900">Menu</p>
              <button type="button" onClick={() => setMenuOpen(false)} className="text-slate-500">Close</button>
            </div>
            <p className="mb-4 text-sm font-medium text-slate-900">{displayName}</p>
            <nav className="flex flex-col gap-2">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id)
                    setMenuOpen(false)
                  }}
                  className={`rounded-lg px-4 py-3 text-left text-sm font-medium ${
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

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
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
