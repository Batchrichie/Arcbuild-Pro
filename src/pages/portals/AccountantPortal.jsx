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
import { COMPANY } from '../../lib/company-config'
import DebtorsLedger from '../../components/accounting/DebtorsLedger'
import AlertLog from '../../components/alerts/AlertLog'
import ManagementReports from '../../components/reports/ManagementReports'
import ProjectRegistry from '../../pages/projects/ProjectRegistry'
import ChartOfAccounts from '../accounts/ChartOfAccounts'

const NAV_SECTIONS = [
  {
    title: 'INVOICING',
    items: [
      { id: 'invoice-list', label: 'Invoice List' },
      { id: 'create-invoice', label: 'Create Invoice' },
      { id: 'milestone-queue', label: 'Milestone Queue' },
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
      { id: 'trial-balance', label: 'Trial Balance' },
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
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'invoices', label: 'Invoices', icon: '📄' },
  { id: 'ledger', label: 'Ledger', icon: '📒' },
  { id: 'payroll', label: 'Payroll', icon: '💼' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'more', label: 'More', icon: '⋯' },
]

const MOBILE_SUB_NAV = {
  invoices: [
    { id: 'invoice-list', label: 'List' },
    { id: 'create-invoice', label: 'Create' },
    { id: 'milestone-queue', label: 'Milestone' },
  ],
  ledger: [
    { id: 'general-ledger', label: 'GL' },
    { id: 'journal-history', label: 'Journals' },
    { id: 'financial-statements', label: 'Statements' },
    { id: 'trial-balance', label: 'Trial' },
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

const MORE_DRAWER_ITEMS = [
  { id: 'tax-centre', label: 'Tax Centre', icon: '🏛️' },
  { id: 'alert-log', label: 'Alerts', icon: '🚨' },
  { id: 'asset-register', label: 'Asset Register', icon: '🏗️' },
  { id: 'subcontractors', label: 'Subcontractors', icon: '👷' },
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'suppliers', label: 'Suppliers', icon: '🏢' },
  { id: 'fx-rates', label: 'FX Rates', icon: '💱' },
]

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  'invoice-list': 'Invoice List',
  'create-invoice': 'Create Invoice',
  'milestone-queue': 'Milestone Queue',
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
  if (['invoice-list', 'create-invoice', 'milestone-queue'].includes(view)) return 'invoices'
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
    } catch {}
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
      case 'general-ledger':
        return <GeneralLedger />
      case 'chart-of-accounts':
        return <ChartOfAccounts />
      case 'financial-statements':
        return <FinancialStatements />
      case 'management-reports':
        return <ManagementReports />
      case 'trial-balance':
        return <FinancialStatements defaultTab="trial" />
      case 'bank-accounts':
        return <BankAccountRegistry />
      case 'import-statement':
        return <BankStatementImport />
      case 'reconciliation':
        return <ReconciliationWorkspace onCreateJournal={(j) => navigate('new-journal')} />
      case 'new-journal':
        return (
          <div>
            <button type="button" onClick={() => setCreateJournalOpen(true)} className="rounded-lg bg-sky-500 px-4 py-2 text-white">New journal</button>
            <Modal open={createJournalOpen} onClose={() => setCreateJournalOpen(false)} title="New manual journal" size="xl">
              <ManualJournalForm />
            </Modal>
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
    <div className="portal-shell overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="portal-sidebar hidden rounded-4xl border border-white/10 p-5 shadow-2xl shadow-black/20 lg:block hover-animate panel-surface soft-gradient-overlay">
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(20,184,166,0.12)] px-4 py-3 text-sm font-semibold text-teal-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500 text-slate-950">AB</span>
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
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-teal-400/20'
              }`}
            >
              Dashboard
            </button>

            <nav className="mt-6 max-h-[calc(100vh-16rem)] space-y-6 overflow-y-auto pr-1">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{section.title}</p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        className={`min-touch w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          activeView === item.id
                            ? 'border-teal-400/40 bg-teal-500/12 text-teal-100'
                            : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <button
              type="button"
              onClick={signOut}
              className="min-touch mt-6 w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:border-teal-400/40 hover-animate"
            >
              Sign Out
            </button>
          </aside>

          <main className="portal-main portal-main-with-tabs min-w-0 overflow-x-hidden">
            <div className="mb-4 flex flex-col gap-3 lg:hidden">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="portal-eyebrow uppercase tracking-[0.2em] text-slate-500">Accountant</p>
                  <h1 className="text-xl font-semibold text-white">{VIEW_TITLES[activeView] || 'Workspace'}</h1>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="min-touch shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300"
                >
                  Sign out
                </button>
              </div>
              <ThemeToggle className="self-start" />
            </div>

            {showMobileSubNav && (
              <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
                {MOBILE_SUB_NAV[mobileTab].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`min-touch shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
                      activeView === item.id
                        ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                        : 'border-white/10 text-slate-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6 shadow-xl shadow-black/10">
              {activeView !== 'dashboard' && (
                <div className="mb-6 hidden lg:block">
                  <p className="portal-section-eyebrow uppercase tracking-[0.24em]">Workspace</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{VIEW_TITLES[activeView]}</h2>
                </div>
              )}
              {renderContent()}
            </div>
          </main>
        </div>
      </div>

      <nav className="portal-mobile-nav lg:hidden" aria-label="Accountant navigation">
        <div className="mx-auto flex max-w-lg justify-around px-1">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileTab(tab.id)}
              className={`flex min-h-11 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-sm font-medium hover-animate ${
                mobileTab === tab.id || (tab.id === 'more' && moreOpen) ? 'text-teal-300' : 'text-slate-500'
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {moreOpen && (
        <>
          <button type="button" className="portal-drawer-backdrop" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div className="portal-drawer-sheet lg:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">More</h3>
              <button type="button" onClick={() => setMoreOpen(false)} className="text-sm text-slate-400">
                Close
              </button>
            </div>
            <div className="grid gap-2">
              {MORE_DRAWER_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className="min-touch flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200"
                >
                  <span aria-hidden>{item.icon}</span>
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
