import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import InvoiceList from '../../components/InvoiceList'
import SupplierRegistry from '../../pages/suppliers/SupplierRegistry'
import SupplierDetail from '../../pages/suppliers/SupplierDetail'
import ClientRegistry from '../../pages/clients/ClientRegistry'
import ClientDetail from '../../pages/clients/ClientDetail'
import InvoiceForm from '../../components/InvoiceForm'
import Modal from '../../components/ui/Modal'
import GeneralLedger from '../../components/GeneralLedger'
import FinancialStatements from '../../components/FinancialStatements'
import RevenueRecognitionDashboard from '../../pages/revenue/RevenueRecognitionDashboard'
import FxRateManager from '../../components/FxRateManager'
import PaymentsReceived from '../payments/PaymentsReceived'
import ProjectFinanceDashboard from '../../components/ProjectFinanceDashboard'
import ProjectCostLedger from '../../components/ProjectCostLedger'
import MilestoneInvoiceQueue from '../../components/MilestoneInvoiceQueue'
import PayrollRunManager from '../../components/PayrollRunManager'
import SubcontractorRegistry from '../../components/SubcontractorRegistry'
import AssetRegister from '../../components/AssetRegister'
import AccountantDashboard from '../../components/accountant/AccountantDashboard'
import PayeSchedule from '../../components/accountant/PayeSchedule'
import SsnitSchedule from '../../components/accountant/SsnitSchedule'
import BankAccountRegistry from '../../components/banking/BankAccountRegistry'
import BankStatementImport from '../../components/banking/BankStatementImport'
import ReconciliationWorkspace from '../../components/banking/ReconciliationWorkspace'
import TaxCentre from '../../components/tax/TaxCentre'
import JournalDrillDown from '../../components/accountant/JournalDrillDown'
import ManualJournalForm from '../../components/accounting/ManualJournalForm'
import ManualJournalList from '../../components/accounting/ManualJournalList'
import ThemeToggle from '../../components/ui/ThemeToggle'
import PortalSidebarFooter from '../../components/ui/PortalSidebarFooter'
import { COMPANY } from '../../lib/company-config'
import logo from '../../assets/ModuloDevLogo.png'
import DebtorsLedger from '../../components/accounting/DebtorsLedger'
import AlertLog from '../../components/alerts/AlertLog'
import ManagementReports from '../../components/reports/ManagementReports'
import ProjectRegistry from '../../pages/projects/ProjectRegistry'
import ChartOfAccounts from '../accounts/ChartOfAccounts'
import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  Building2,
  FileText,
  FolderKanban,
  HardHat,
  Landmark,
  LayoutDashboard,
  MoreHorizontal,
  ScrollText,
  Users,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    title: 'INVOICING',
    items: [
      { id: 'invoice-list', label: 'Invoice List' },
      { id: 'create-invoice', label: 'Create Invoice' },
      { id: 'milestone-queue', label: 'Milestone Queue' },
      { id: 'payments-received', label: 'Payments Received' },
    ],
  },
  {
    title: 'JOURNALS',
    items: [
      { id: 'new-journal', label: 'New Journal' },
      { id: 'journal-history', label: 'Journal History' },
    ],
  },
  {
    title: 'LEDGER & REPORTS',
    items: [
      { id: 'chart-of-accounts', label: 'Chart of Accounts' },
      { id: 'general-ledger', label: 'General Ledger' },
      { id: 'management-reports', label: 'Management Reports' },
      { id: 'debtors-ledger', label: 'Debtors Ledger' },
          { id: 'financial-statements', label: 'Financial Statements' },
          { id: 'revenue-recognition', label: 'Revenue Recognition' },
    ],
  },
  {
    title: 'BANKING',
    items: [
      { id: 'bank-accounts', label: 'Bank Accounts' },
      { id: 'import-statement', label: 'Import Statement' },
      { id: 'reconciliation', label: 'Reconciliation' },
    ],
  },
  {
    title: 'PAYROLL',
    items: [
      { id: 'payroll-runs', label: 'Payroll Runs' },
      { id: 'paye-schedule', label: 'PAYE Schedule' },
      { id: 'ssnit-schedule', label: 'SSNIT Schedule' },
    ],
  },
  {
    title: 'PROJECTS',
    items: [
      { id: 'projects', label: 'Projects' },
      { id: 'project-finance', label: 'Project Finance' },
      { id: 'cost-ledger', label: 'Cost Ledger' },
    ],
  },
  {
    title: 'TAX',
    items: [
      { id: 'tax-centre', label: 'Tax Centre' },
      { id: 'fx-rates', label: 'FX Rates' },
      { id: 'alert-log', label: 'Alerts' },
    ],
  },
  {
    title: 'ASSETS & SUBS',
    items: [
      { id: 'asset-register', label: 'Asset Register' },
      { id: 'subcontractors', label: 'Subcontractors' },
      { id: 'clients', label: 'Clients' },
      { id: 'suppliers', label: 'Suppliers' },
    ],
  },
]

const MOBILE_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'ledger', label: 'Ledger', icon: ScrollText },
  { id: 'payroll', label: 'Payroll', icon: BriefcaseBusiness },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'more', label: 'More', icon: MoreHorizontal },
]

const MOBILE_SUB_NAV = {
  invoices: [
    { id: 'invoice-list', label: 'List' },
    { id: 'create-invoice', label: 'Create' },
    { id: 'milestone-queue', label: 'Milestone' },
    { id: 'payments-received', label: 'Payments' },
  ],
  ledger: [
    { id: 'general-ledger', label: 'GL' },
    { id: 'new-journal', label: 'New Journal' },
    { id: 'journal-history', label: 'History' },
    { id: 'financial-statements', label: 'Statements' },
    { id: 'bank-accounts', label: 'Bank Accounts' },
    { id: 'import-statement', label: 'Import' },
    { id: 'reconciliation', label: 'Reconciliation' },
  ],
  payroll: [
    { id: 'payroll-runs', label: 'Runs' },
    { id: 'paye-schedule', label: 'PAYE' },
    { id: 'ssnit-schedule', label: 'SSNIT' },
  ],
  projects: [
    { id: 'project-finance', label: 'Finance' },
    { id: 'cost-ledger', label: 'Costs' },
  ],
}

function PortalIcon({ icon: Icon, className = 'h-4 w-4' }) {
  return <Icon className={className} aria-hidden />
}

const MORE_DRAWER_ITEMS = [
  { id: 'tax-centre', label: 'Tax Centre', icon: Landmark },
  { id: 'alert-log', label: 'Alerts', icon: AlertTriangle },
  { id: 'asset-register', label: 'Asset Register', icon: HardHat },
  { id: 'subcontractors', label: 'Subcontractors', icon: HardHat },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Building2 },
  { id: 'fx-rates', label: 'FX Rates', icon: Banknote },
]

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  'invoice-list': 'Invoice List',
  'create-invoice': 'Create Invoice',
  'milestone-queue': 'Milestone Queue',
  'payments-received': 'Payments Received',
  'new-journal': 'New Journal',
  'journal-history': 'Journal History',
  'debtors-ledger': 'Debtors Ledger',
  'general-ledger': 'General Ledger',
  'financial-statements': 'Financial Statements',
  'trial-balance': 'Trial Balance',
  'management-reports': 'Management Reports',
  'bank-accounts': 'Bank Accounts',
  'import-statement': 'Import Statement',
  'reconciliation': 'Reconciliation',
  'payroll-runs': 'Payroll Runs',
  'paye-schedule': 'PAYE Schedule',
  'ssnit-schedule': 'SSNIT Schedule',
  'projects': 'Projects',
  'project-finance': 'Project Finance',
  'cost-ledger': 'Cost Ledger',
  'tax-centre': 'Tax Centre',
  'alert-log': 'Alerts',
  'fx-rates': 'FX Rates',
  'asset-register': 'Asset Register',
  'clients': 'Clients',
  'suppliers': 'Suppliers',
  subcontractors: 'Subcontractors',
}

function viewFromMobileTab(tab, currentView) {
  const subs = MOBILE_SUB_NAV[tab]
  if (subs?.some((s) => s.id === currentView)) return currentView
  if (tab === 'dashboard') return 'dashboard'
  if (tab === 'invoices') return 'invoice-list'
  if (tab === 'ledger') return 'general-ledger'
  if (tab === 'payroll') return 'payroll-runs'
  if (tab === 'projects') return 'project-finance'
  return currentView
}

function mobileTabForView(view) {
  if (view === 'dashboard') return 'dashboard'
  if (['invoice-list', 'create-invoice', 'milestone-queue', 'payments-received'].includes(view)) return 'invoices'
  if (['general-ledger', 'journal-history', 'new-journal', 'financial-statements', 'trial-balance', 'bank-accounts', 'import-statement', 'reconciliation'].includes(view))
    return 'ledger'
  if (['payroll-runs', 'paye-schedule', 'ssnit-schedule'].includes(view)) return 'payroll'
  if (['project-finance', 'cost-ledger'].includes(view)) return 'projects'
  if (MORE_DRAWER_ITEMS.some((i) => i.id === view)) return 'more'
  return 'invoices'
}

export default function AccountantPortal() {
  const { profile, signOut } = useAuth()
  const [activeView, setActiveView] = useState('dashboard')
  const [mobileTab, setMobileTab] = useState('invoices')
  const [moreOpen, setMoreOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [journalDrillId, setJournalDrillId] = useState(null)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [createJournalOpen, setCreateJournalOpen] = useState(false)

  useEffect(() => {
    try {
      document.title = `${COMPANY.appName} — Accountant`
    } catch { /* best effort */ }
  }, [])

  const navigate = (viewId) => {
    if (viewId === 'suppliers') {
      setSelectedSupplierId(null)
      setActiveView(viewId)
      setMoreOpen(false)
      setMobileTab('more')
      return
    }

    if (viewId === 'clients') {
      setSelectedClientId(null)
      setActiveView(viewId)
      setMoreOpen(false)
      setMobileTab('more')
      return
    }

    setActiveView(viewId)
    setMoreOpen(false)
    setMobileTab(mobileTabForView(viewId))
  }

  const openSupplierDetail = (supplierId) => {
    setSelectedSupplierId(supplierId)
    setActiveView('supplier-detail')
    setMoreOpen(false)
    setMobileTab('more')
  }

  const openClientDetail = (clientId) => {
    setSelectedClientId(clientId)
    setActiveView('client-detail')
    setMoreOpen(false)
    setMobileTab('more')
  }

  const handleMobileTab = (tabId) => {
    if (tabId === 'more') {
      setMoreOpen(true)
      return
    }
    setMobileTab(tabId)
    setMoreOpen(false)
    setActiveView(viewFromMobileTab(tabId, activeView))
  }

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <AccountantDashboard
            onNavigate={navigate}
            onJournalSelect={setJournalDrillId}
          />
        )
      case 'invoice-list':
        return <InvoiceList />
      case 'create-invoice':
        return (
          <div>
            <button type="button" onClick={() => setCreateInvoiceOpen(true)} className="rounded-lg bg-emerald-500 px-4 py-2 text-white">Create invoice</button>
            <Modal open={createInvoiceOpen} onClose={() => setCreateInvoiceOpen(false)} title="Create invoice" size="xl">
              <InvoiceForm onSave={() => { setCreateInvoiceOpen(false); navigate('invoice-list') }} />
            </Modal>
          </div>
        )
      case 'milestone-queue':
        return <MilestoneInvoiceQueue userRole="accountant" userId={profile?.id} />
      case 'payments-received':
        return <PaymentsReceived />
      case 'general-ledger':
        return <GeneralLedger />
      case 'chart-of-accounts':
        return <ChartOfAccounts />
      case 'financial-statements':
        return <FinancialStatements defaultTab="trial" />
      case 'management-reports':
        return <ManagementReports />
      case 'trial-balance':
        return <FinancialStatements defaultTab="trial" />
      case 'bank-accounts':
        return <BankAccountRegistry />
      case 'import-statement':
        return <BankStatementImport />
      case 'reconciliation':
        return <ReconciliationWorkspace onCreateJournal={() => navigate('new-journal')} />
      case 'new-journal':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 md:hidden">Post a manual journal entry below.</p>
            <div className="md:hidden">
              <ManualJournalForm />
            </div>
            <div className="hidden lg:block">
              <button
                type="button"
                onClick={() => setCreateJournalOpen(true)}
                className="rounded-lg bg-sky-500 px-4 py-2 text-white hover:bg-sky-600"
              >
                New journal
              </button>
              <Modal open={createJournalOpen} onClose={() => setCreateJournalOpen(false)} title="New manual journal" size="xl">
                <ManualJournalForm />
              </Modal>
            </div>
          </div>
        )
      case 'journal-history':
        return <ManualJournalList />
      case 'debtors-ledger':
        return <DebtorsLedger readOnly={false} />
      case 'alert-log':
        return <AlertLog readOnly={false} />
      case 'payroll-runs':
        return (
          <div className="space-y-10">
            <PayrollRunManager userRole="accountant" userId={profile?.id} readOnly={false} />
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">PAYE Schedule</h3>
              <PayeSchedule />
            </div>
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">SSNIT Schedule</h3>
              <SsnitSchedule />
            </div>
          </div>
        )
      case 'paye-schedule':
        return <PayeSchedule />
      case 'ssnit-schedule':
        return <SsnitSchedule />
      case 'projects':
        return <ProjectRegistry />
      case 'project-finance':
        return <ProjectFinanceDashboard userRole="accountant" currentUserProfileId={profile?.id} />
      case 'revenue-recognition':
        return <RevenueRecognitionDashboard />
      case 'cost-ledger':
        return <ProjectCostLedger userRole="accountant" userId={profile?.id} />
      case 'clients':
        return <ClientRegistry onViewClient={openClientDetail} />
      case 'client-detail':
        return (
          <ClientDetail
            clientId={selectedClientId}
            onBack={() => {
              setSelectedClientId(null)
              setActiveView('clients')
              setMoreOpen(false)
              setMobileTab('more')
            }}
          />
        )
      case 'suppliers':
        return <SupplierRegistry onViewSupplier={openSupplierDetail} />
      case 'supplier-detail':
        return (
          <SupplierDetail
            supplierId={selectedSupplierId}
            onBack={() => {
              setSelectedSupplierId(null)
              setActiveView('suppliers')
              setMoreOpen(false)
              setMobileTab('more')
            }}
          />
        )
      case 'tax-centre':
        return <TaxCentre />
      case 'fx-rates':
        return <FxRateManager />
      case 'asset-register':
        return <AssetRegister readOnly={false} userRole="accountant" userId={profile?.id} />
      case 'subcontractors':
        return <SubcontractorRegistry readOnly={false} />
      default:
        return <AccountantDashboard onNavigate={navigate} onJournalSelect={setJournalDrillId} />
    }
  }

  const showMobileSubNav = MOBILE_SUB_NAV[mobileTab] && activeView !== 'dashboard'

  return (
    <div className="portal-shell min-h-screen w-full overflow-x-hidden">
      <div className="w-full px-6 py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="portal-sidebar hidden md:flex md:flex-col rounded-4xl border border-border-soft p-5 shadow-2xl shadow-black/20 hover-animate panel-surface">
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-success-bg px-4 py-3 text-sm font-semibold text-teal-200">
                <img src={logo} alt={COMPANY.shortName} className="h-10 w-10 rounded-2xl object-cover" />
                <span>{COMPANY.name}</span>
              </div>
            </div>

            <p className="portal-eyebrow uppercase tracking-[0.28em] text-slate-500">Accountant</p>
            <p className="mt-2 text-xl font-semibold text-white">{profile?.full_name ?? 'Finance team'}</p>

            <button
              type="button"
              onClick={() => navigate('dashboard')}
              className={`min-touch mt-6 w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                activeView === 'dashboard'
                  ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                  : 'border-border-soft bg-white/5 text-slate-300 hover:border-teal-400/20'
              }`}
            >
              Dashboard
            </button>

            <nav className="mt-6 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title} className="pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-45 text-slate-300">{section.title}</p>
                  <div className="mt-3 space-y-1">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        className={`min-touch w-full rounded-xl border-l-4 border-transparent px-3 py-2.5 text-left text-sm transition ${
                          activeView === item.id
                            ? 'border-teal-400 bg-white/5 text-teal-100'
                            : 'border-transparent text-slate-400 hover:border-slate-600 hover:bg-white/5 hover:text-slate-200'
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
              signOutClassName="border-border-soft bg-white/5 text-white hover:border-teal-400/40 hover-animate"
            />
          </aside>

          <main className="portal-main portal-main-with-tabs min-w-0 w-full overflow-x-hidden pb-24 lg:pb-0">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="portal-eyebrow uppercase tracking-[0.2em] text-slate-500">Accountant</p>
                <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-white truncate">{VIEW_TITLES[activeView] || 'Workspace'}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <ThemeToggle className="self-start" />
                <button
                  type="button"
                  onClick={signOut}
                  className="min-touch rounded-full border border-border-soft px-4 py-2 text-sm text-slate-300"
                >
                  Sign out
                </button>
              </div>
            </div>

            {showMobileSubNav && (
              <div className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:hidden">
                {MOBILE_SUB_NAV[mobileTab].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`min-touch shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
                      activeView === item.id
                        ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                        : 'border-border-soft text-slate-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            <div className="w-full rounded-3xl bg-gray-100 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
              {activeView !== 'dashboard' && (
                <>
                  <p className="portal-section-eyebrow uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Workspace</p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{VIEW_TITLES[activeView]}</h2>
                </>
              )}
              {renderContent()}
            </div>
          </main>
        </div>
      </div>

      <nav className="portal-mobile-nav md:hidden" aria-label="Accountant navigation">
        <div className="mx-auto flex max-w-lg justify-around px-1">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileTab(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center min-h-[3rem] py-2 text-xs font-medium ${
                mobileTab === tab.id || (tab.id === 'more' && moreOpen) ? 'text-teal-300' : 'text-slate-500'
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                <PortalIcon icon={tab.icon} />
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {moreOpen && (
        <>
          <button type="button" className="portal-drawer-backdrop" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div className="portal-drawer-sheet md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">More</h3>
              <button type="button" onClick={() => setMoreOpen(false)} className="text-sm text-slate-400">
                Close
              </button>
            </div>
            <ThemeToggle className="mb-4 w-full justify-center" />
            <div className="grid gap-2">
              {MORE_DRAWER_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className="min-touch flex items-center gap-3 rounded-2xl border border-border-soft bg-white/5 px-4 py-3 text-left text-sm text-slate-200"
                >
                  <span aria-hidden><PortalIcon icon={item.icon} /></span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {journalDrillId && <JournalDrillDown journalId={journalDrillId} onClose={() => setJournalDrillId(null)} />}
    </div>
  )
}
