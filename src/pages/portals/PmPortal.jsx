import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from '../../context/AuthContext'
import { COMPANY } from '../../lib/company-config'
import logo from '../../assets/ModuloDevLogo.png'
import { PmProjectProvider, usePmProject } from '../../context/PmProjectContext'
import PmDashboard from '../../components/pm/PmDashboard'
import ThemeToggle from '../../components/ui/ThemeToggle'
import PortalSidebarFooter from '../../components/ui/PortalSidebarFooter'
import Modal from '../../components/ui/Modal'
import { Banknote, Camera, LayoutDashboard, MoreHorizontal, Target } from 'lucide-react'

// Lazy load heavy components
const SitePhotoUpload = lazy(() => import('../../components/pm/SitePhotoUpload'))
const IssueLog = lazy(() => import('../../components/pm/IssueLog'))
const DailyProgressReport = lazy(() => import('../../components/pm/DailyProgressReport'))
const ClientRegistry = lazy(() => import('../../pages/clients/ClientRegistry'))
const ProjectRegistry = lazy(() => import('../../pages/projects/ProjectRegistry'))
const MilestoneManager = lazy(() => import('../../components/MilestoneManager'))
const CostEntryForm = lazy(() => import('../../components/CostEntryForm'))
const ProjectCostLedger = lazy(() => import('../../components/ProjectCostLedger'))
const PaymentCertificateForm = lazy(() => import('../../components/PaymentCertificateForm'))
const ProjectFinanceDashboard = lazy(() => import('../../components/ProjectFinanceDashboard'))
const TimesheetApproval = lazy(() => import('../../components/TimesheetApproval'))

// Component skeleton loader
function PortalComponentLoader() {
  return (
    <div className="flex h-96 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-600">
      <div className="text-center">
        <div className="mb-3 inline-flex h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900 dark:border-slate-600 dark:border-t-white"></div>
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading panel...</p>
      </div>
    </div>
  )
}


const NAV_SECTIONS = [
  {
    title: 'MY PROJECTS',
    items: [
      { id: 'dashboard', label: 'Project Overview' },
      { id: 'budget', label: 'Budget vs Actual' },
      { id: 'project-list', label: 'All Projects' },
    ],
  },
  {
    title: 'MILESTONES',
    items: [
      { id: 'milestones', label: 'Milestone Tracker' },
      { id: 'mark-complete', label: 'Mark Complete' },
    ],
  },
  {
    title: 'COSTS',
    items: [
      { id: 'log-cost', label: 'Log Cost' },
      { id: 'cost-ledger', label: 'Cost Ledger' },
    ],
  },
  {
    title: 'SUBCONTRACTORS',
    items: [{ id: 'payment-cert', label: 'Payment Certificates' }],
  },
  {
    title: 'CLIENTS',
    items: [{ id: 'clients', label: 'Clients' }],
  },
  {
    title: 'DOCUMENTS',
    items: [
      { id: 'site-photos', label: 'Site Photos' },
      { id: 'reports', label: 'Reports' },
      { id: 'timesheet-approvals', label: 'Timesheet Approvals' },
      { id: 'issues', label: 'Issues & Risks' },
    ],
  },
]

const MOBILE_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'milestones', label: 'Milestones', icon: Target },
  { id: 'costs', label: 'Costs', icon: Banknote },
  { id: 'site', label: 'Site', icon: Camera },
  { id: 'more', label: 'More', icon: MoreHorizontal },
]

const VIEW_TITLES = {
  dashboard: 'Project Overview',
  budget: 'Budget vs Actual',
  'project-list': 'All Projects',
  milestones: 'Milestone Tracker',
  clients: 'Clients',
  'mark-complete': 'Mark Complete',
  'log-cost': 'Log Cost',
  'cost-ledger': 'Cost Ledger',
  'payment-cert': 'Payment Certificates',
  'site-photos': 'Site Photos',
  reports: 'Daily Reports',
  'timesheet-approvals': 'Timesheet Approvals',
  issues: 'Issues & Risks',
}

function PortalIcon({ icon: Icon, className = 'h-4 w-4' }) {
  return <Icon className={className} aria-hidden />
}

function viewFromMobileTab(tab, currentView) {
  const map = {
    overview: 'dashboard',
    milestones: 'milestones',
    costs: 'log-cost',
    site: 'site-photos',
  }
  return map[tab] || currentView
}

function mobileTabForView(view) {
  if (['dashboard', 'budget'].includes(view)) return 'overview'
  if (['milestones', 'mark-complete'].includes(view)) return 'milestones'
  if (['log-cost', 'cost-ledger'].includes(view)) return 'costs'
  if (['site-photos'].includes(view)) return 'site'
  if (['payment-cert', 'reports', 'issues'].includes(view)) return 'more'
  return 'overview'
}

function PmPortalContent() {
  const { profile, signOut } = useAuth()
  const { selectedProjectId } = usePmProject()
  const [activeView, setActiveView] = useState('dashboard')
  const [mobileTab, setMobileTab] = useState('overview')
  const [moreOpen, setMoreOpen] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [ledgerCategory, setLedgerCategory] = useState('')
  const [logCostOpen, setLogCostOpen] = useState(false)
  const [paymentCertOpen, setPaymentCertOpen] = useState(false)
  useEffect(() => {
    try { document.title = `${COMPANY.appName} — Project Manager` } catch { /* best effort */ }
  }, [])

  const navigate = (view) => {
    setActiveView(view)
    setMobileTab(mobileTabForView(view))
    setMoreOpen(false)
    setSheet(null)
  }

  const handleMobileTab = (tabId) => {
    if (tabId === 'more') {
      setMoreOpen(true)
      return
    }
    setMobileTab(tabId)
    setMoreOpen(false)
    navigate(viewFromMobileTab(tabId, activeView))
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <PmDashboard
            onLogCost={() => setSheet('cost')}
            onMarkMilestone={() => navigate('mark-complete')}
            onPaymentCert={() => navigate('payment-cert')}
            onOpenCostLedger={(cat) => {
              setLedgerCategory(cat)
              navigate('cost-ledger')
            }}
          />
        )
      case 'budget':
        return (
          <ProjectFinanceDashboard
            userRole="project_manager"
            currentUserProfileId={profile?.id}
            initialProjectId={selectedProjectId}
            hideProjectSelector
          />
        )
      case 'milestones':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <MilestoneManager
              userRole="project_manager"
              userId={profile?.id}
              projectId={selectedProjectId}
              hideProjectSelector
            />
          </Suspense>
        )
      case 'mark-complete':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <MilestoneManager
              userRole="project_manager"
              userId={profile?.id}
              projectId={selectedProjectId}
              hideProjectSelector
              inProgressOnly
            />
          </Suspense>
        )
      case 'log-cost':
        return (
          <div>
            <button type="button" onClick={() => setLogCostOpen(true)} className="rounded-lg bg-amber-500 px-4 py-2 text-white">Log cost</button>
            <Modal open={logCostOpen} onClose={() => setLogCostOpen(false)} title="Log cost" size="lg">
              <CostEntryForm userRole="project_manager" userId={profile?.id} defaultProjectId={selectedProjectId} />
            </Modal>
          </div>
        )
      case 'cost-ledger':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <ProjectCostLedger
              userRole="project_manager"
              userId={profile?.id}
              projectId={selectedProjectId}
              initialCostType={ledgerCategory}
              hideProjectSelector
            />
          </Suspense>
        )
      case 'project-list':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <ProjectRegistry />
          </Suspense>
        )
      case 'payment-cert':
        return (
          <div>
            <button type="button" onClick={() => setPaymentCertOpen(true)} className="rounded-lg bg-rose-500 px-4 py-2 text-white">Create certificate</button>
            <Modal open={paymentCertOpen} onClose={() => setPaymentCertOpen(false)} title="Payment certificate" size="lg">
              <PaymentCertificateForm userRole="project_manager" userId={profile?.id} />
            </Modal>
          </div>
        )
      case 'site-photos':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <SitePhotoUpload />
          </Suspense>
        )
      case 'timesheet-approvals':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <TimesheetApproval />
          </Suspense>
        )
      case 'reports':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <DailyProgressReport />
          </Suspense>
        )
      case 'issues':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <IssueLog />
          </Suspense>
        )
      case 'clients':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <ClientRegistry />
          </Suspense>
        )
      default:
        return null
    }
  }

  return (
    <div className="portal-shell min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:max-w-none lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="portal-sidebar hidden md:flex md:flex-col rounded-4xl border border-border-soft p-5 shadow-2xl">
            <div className="mb-6 inline-flex items-center gap-3 rounded-3xl bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-200">
              <img src={logo} alt={COMPANY.shortName} className="h-10 w-10 rounded-2xl object-cover" />
              {COMPANY.shortName}
            </div>
            <p className="portal-eyebrow text-slate-500">Project Manager</p>
            <p className="mt-1 font-semibold text-white">{profile?.full_name}</p>

            <nav className="mt-6 max-h-[calc(100vh-14rem)] space-y-5 overflow-y-auto">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="mb-1 text-[10px] lg:text-[11px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        className={`min-touch w-full rounded-xl px-3 py-2.5 text-left text-sm lg:text-[15px] ${
                          activeView === item.id
                            ? 'border border-cyan-400/20 bg-cyan-500/15 text-cyan-100'
                            : 'text-slate-200 hover:bg-white/5 hover:text-slate-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <PortalSidebarFooter
              onSignOut={signOut}
              signOutClassName="text-slate-300 hover:border-cyan-400/40"
            />
          </aside>

          <main className="portal-main portal-main-with-tabs min-w-0 w-full overflow-x-hidden pb-24 lg:pb-0">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl lg:text-3xl font-semibold text-white truncate">{VIEW_TITLES[activeView]}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button type="button" onClick={signOut} className="text-sm text-slate-400">
                  Sign out
                </button>
                <ThemeToggle className="self-start" />
              </div>
            </div>

            <div className="mb-4 hidden lg:block">
              <h2 className="text-2xl font-semibold text-white">{VIEW_TITLES[activeView]}</h2>
            </div>

            <div className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6 lg:p-8">{renderView()}</div>
          </main>
        </div>
      </div>

      <div className="portal-mobile-quick-actions md:hidden">
        <button type="button" onClick={() => setSheet('cost')} className="min-touch flex-1 rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25">
          Log a Cost
        </button>
        <button type="button" onClick={() => navigate('mark-complete')} className="min-touch flex-1 rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25">
          Mark Complete
        </button>
      </div>

      <nav className="portal-mobile-nav md:hidden">
        <div className="mx-auto flex max-w-lg justify-around px-1">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileTab(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center min-h-[3rem] py-2 text-xs font-medium ${
                mobileTab === tab.id ? 'text-cyan-300' : 'text-slate-500'
              }`}
            >
              <span className="text-base"><PortalIcon icon={tab.icon} /></span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {moreOpen && (
        <>
          <button type="button" className="portal-drawer-backdrop" onClick={() => setMoreOpen(false)} aria-label="Close" />
          <div className="portal-drawer-sheet">
            <h3 className="mb-3 text-lg font-semibold text-white">More</h3>
            <ThemeToggle className="mb-4 w-full justify-center md:hidden" />
            {[
              { id: 'payment-cert', label: 'Payment Certificates' },
              { id: 'reports', label: 'Daily Reports' },
              { id: 'issues', label: 'Issues & Risks' },
              { id: 'budget', label: 'Budget vs Actual' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className="min-touch mb-2 w-full rounded-xl border border-border-soft bg-white/5 px-4 py-3 text-left text-sm text-slate-200"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {sheet === 'cost' && (
        <>
          <button type="button" className="portal-drawer-backdrop" onClick={() => setSheet(null)} aria-label="Close" />
          <div className="portal-bottom-sheet max-h-[85vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-white">Log a Cost</h3>
            <CostEntryForm userRole="project_manager" userId={profile?.id} defaultProjectId={selectedProjectId} />
          </div>
        </>
      )}
    </div>
  )
}

export default function PmPortal() {
  return (
    <PmProjectProvider>
      <PmPortalContent />
    </PmProjectProvider>
  )
}
