import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import InvoiceList from '../../components/InvoiceList'
import InvoiceForm from '../../components/InvoiceForm'
import GeneralLedger from '../../components/GeneralLedger'
import FinancialStatements from '../../components/FinancialStatements'
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
import BankReconciliationStub from '../../components/accountant/BankReconciliationStub'
import TaxCentre from '../../components/tax/TaxCentre'
import JournalDrillDown from '../../components/accountant/JournalDrillDown'
import ManualJournalForm from '../../components/accounting/ManualJournalForm'
import ManualJournalList from '../../components/accounting/ManualJournalList'
import DebtorsLedger from '../../components/accounting/DebtorsLedger'
import AlertLog from '../../components/alerts/AlertLog'

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
      { id: 'general-ledger', label: 'General Ledger' },
      { id: 'debtors-ledger', label: 'Debtors Ledger' },
      { id: 'financial-statements', label: 'Financial Statements' },
      { id: 'trial-balance', label: 'Trial Balance' },
      { id: 'bank-reconciliation', label: 'Bank Reconciliation' },
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
    ],
  },
]

const MOBILE_TABS = [
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
    { id: 'bank-reconciliation', label: 'Bank' },
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
  'bank-reconciliation': 'Bank Reconciliation',
  'payroll-runs': 'Payroll Runs',
  'paye-schedule': 'PAYE Schedule',
  'ssnit-schedule': 'SSNIT Schedule',
  'project-finance': 'Project Finance',
  'cost-ledger': 'Cost Ledger',
  'tax-centre': 'Tax Centre',
  'alert-log': 'Alerts',
  'fx-rates': 'FX Rates',
  'asset-register': 'Asset Register',
  subcontractors: 'Subcontractors',
}

function viewFromMobileTab(tab, currentView) {
  const subs = MOBILE_SUB_NAV[tab]
  if (subs?.some((s) => s.id === currentView)) return currentView
  if (tab === 'invoices') return 'invoice-list'
  if (tab === 'ledger') return 'general-ledger'
  if (tab === 'payroll') return 'payroll-runs'
  if (tab === 'projects') return 'project-finance'
  return currentView
}

function mobileTabForView(view) {
  if (['invoice-list', 'create-invoice', 'milestone-queue'].includes(view)) return 'invoices'
  if (['general-ledger', 'journal-history', 'new-journal', 'financial-statements', 'trial-balance', 'bank-reconciliation'].includes(view))
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
  const [journalDrillId, setJournalDrillId] = useState(null)

  const navigate = (viewId) => {
    setActiveView(viewId)
    setMoreOpen(false)
    setMobileTab(mobileTabForView(viewId))
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
        return <InvoiceForm onSave={() => navigate('invoice-list')} />
      case 'milestone-queue':
        return <MilestoneInvoiceQueue userRole="accountant" userId={profile?.id} />
      case 'general-ledger':
        return <GeneralLedger />
      case 'financial-statements':
        return <FinancialStatements />
      case 'trial-balance':
        return <FinancialStatements defaultTab="trial" />
      case 'bank-reconciliation':
        return <BankReconciliationStub />
      case 'new-journal':
        return <ManualJournalForm />
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
      case 'project-finance':
        return <ProjectFinanceDashboard userRole="accountant" currentUserProfileId={profile?.id} />
      case 'cost-ledger':
        return <ProjectCostLedger userRole="accountant" userId={profile?.id} />
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
          <aside className="portal-sidebar hidden rounded-4xl border border-white/10 p-5 shadow-2xl shadow-black/20 lg:block">
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(20,184,166,0.12)] px-4 py-3 text-sm font-semibold text-teal-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500 text-slate-950">AB</span>
                <span>ArcBuild Pro</span>
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
              className="min-touch mt-6 w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:border-teal-400/40"
            >
              Sign Out
            </button>
          </aside>

          <main className="portal-main portal-main-with-tabs min-w-0 overflow-x-hidden">
            <div className="mb-4 flex items-center justify-between gap-4 lg:hidden">
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
              className={`flex min-h-[2.75rem] min-w-[3rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-sm font-medium ${
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
