import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import HrDashboard from '../../components/hr/HrDashboard'
import EmployeeRegistry from '../../components/hr/EmployeeRegistry'
import VariablePayInput from '../../components/hr/VariablePayInput'
import PayrollReview from '../../components/hr/PayrollReview'
import LeaveCalendar from '../../components/hr/LeaveCalendar'
import LeaveApprovals from '../../components/hr/LeaveApprovals'
import LeaveBalances from '../../components/hr/LeaveBalances'
import ComplianceTracker from '../../components/hr/ComplianceTracker'
import EmployeeCostReport from '../../components/hr/EmployeeCostReport'
import HeadcountReport from '../../components/hr/HeadcountReport'

const NAV_SECTIONS = [
  {
    title: 'EMPLOYEES',
    items: [
      { id: 'dashboard', label: 'HR Dashboard' },
      { id: 'registry', label: 'Employee Registry' },
      { id: 'onboarding', label: 'Onboarding' },
      { id: 'compliance', label: 'Contracts & Compliance' },
    ],
  },
  {
    title: 'PAYROLL',
    items: [
      { id: 'variable-pay', label: 'Variable Pay Input' },
      { id: 'payroll-review', label: 'Payroll Review' },
    ],
  },
  {
    title: 'LEAVE',
    items: [
      { id: 'leave-calendar', label: 'Leave Calendar' },
      { id: 'leave-approvals', label: 'Leave Approvals' },
      { id: 'leave-balances', label: 'Leave Balances' },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { id: 'cost-report', label: 'Employee Cost Report' },
      { id: 'headcount', label: 'Headcount Report' },
    ],
  },
]

const MOBILE_TABS = [
  { id: 'employees', label: 'Employees', icon: '👥' },
  { id: 'payroll', label: 'Payroll', icon: '💼' },
  { id: 'leave', label: 'Leave', icon: '🏖️' },
  { id: 'reports', label: 'Reports', icon: '📊' },
  { id: 'more', label: 'More', icon: '⋯' },
]

const VIEW_TITLES = {
  dashboard: 'HR Dashboard',
  registry: 'Employee Registry',
  onboarding: 'Onboarding',
  compliance: 'Contracts & Compliance',
  'variable-pay': 'Variable Pay Input',
  'payroll-review': 'Payroll Review',
  'leave-calendar': 'Leave Calendar',
  'leave-approvals': 'Leave Approvals',
  'leave-balances': 'Leave Balances',
  'cost-report': 'Employee Cost Report',
  headcount: 'Headcount Report',
}

const MOBILE_MAP = {
  employees: 'dashboard',
  payroll: 'variable-pay',
  leave: 'leave-calendar',
  reports: 'cost-report',
}

const MORE_ITEMS = [
  { id: 'registry', label: 'Employee Registry' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'payroll-review', label: 'Payroll Review' },
  { id: 'leave-approvals', label: 'Leave Approvals' },
  { id: 'leave-balances', label: 'Leave Balances' },
  { id: 'headcount', label: 'Headcount' },
]

export default function HrPortal() {
  const { profile, signOut } = useAuth()
  const [activeView, setActiveView] = useState('dashboard')
  const [mobileTab, setMobileTab] = useState('employees')
  const [moreOpen, setMoreOpen] = useState(false)

  const navigate = (view) => {
    setActiveView(view)
    setMoreOpen(false)
  }

  const handleMobileTab = (tabId) => {
    if (tabId === 'more') {
      setMoreOpen(true)
      return
    }
    setMobileTab(tabId)
    setMoreOpen(false)
    if (MOBILE_MAP[tabId]) navigate(MOBILE_MAP[tabId])
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <HrDashboard onNavigate={navigate} />
      case 'registry':
        return <EmployeeRegistry />
      case 'onboarding':
        return (
          <div className="space-y-4 text-sm text-slate-300">
            <p>Use the four-step wizard in Employee Registry to onboard new staff.</p>
            <button type="button" onClick={() => navigate('registry')} className="rounded-full bg-violet-500 px-5 py-2.5 font-semibold text-white">
              Open Employee Registry
            </button>
          </div>
        )
      case 'compliance':
        return <ComplianceTracker />
      case 'variable-pay':
        return <VariablePayInput />
      case 'payroll-review':
        return <PayrollReview />
      case 'leave-calendar':
        return <LeaveCalendar />
      case 'leave-approvals':
        return <LeaveApprovals />
      case 'leave-balances':
        return <LeaveBalances />
      case 'cost-report':
        return <EmployeeCostReport />
      case 'headcount':
        return <HeadcountReport />
      default:
        return <HrDashboard onNavigate={navigate} />
    }
  }

  return (
    <div className="portal-shell overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="portal-sidebar hidden rounded-4xl border border-white/10 p-5 shadow-2xl lg:block">
            <div className="mb-6 inline-flex items-center gap-3 rounded-3xl bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-200">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500 text-slate-950">AB</span>
              ArcBuild Pro
            </div>
            <p className="portal-eyebrow text-slate-500">HR Manager</p>
            <p className="mt-1 font-semibold text-white">{profile?.full_name}</p>

            <nav className="mt-6 max-h-[calc(100vh-14rem)] space-y-5 overflow-y-auto">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        className={`min-touch w-full rounded-xl px-3 py-2.5 text-left text-sm ${
                          activeView === item.id
                            ? 'bg-violet-500/15 text-violet-100'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <button type="button" onClick={signOut} className="min-touch mt-6 w-full rounded-full border border-white/10 py-3 text-sm text-slate-300">
              Sign Out
            </button>
          </aside>

          <main className="portal-main portal-main-with-tabs min-w-0 overflow-x-hidden pb-24 lg:pb-8">
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <h1 className="text-xl font-semibold text-white">{VIEW_TITLES[activeView]}</h1>
              <button type="button" onClick={signOut} className="text-sm text-slate-400">Sign out</button>
            </div>
            {activeView !== 'dashboard' && (
              <div className="mb-4 hidden lg:block">
                <h2 className="text-2xl font-semibold text-white">{VIEW_TITLES[activeView]}</h2>
              </div>
            )}
            <div className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">{renderView()}</div>
          </main>
        </div>
      </div>

      <nav className="portal-mobile-nav lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileTab(tab.id)}
              className={`flex min-h-[2.75rem] flex-1 flex-col items-center justify-center py-2 text-xs font-medium ${
                mobileTab === tab.id ? 'text-violet-300' : 'text-slate-500'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
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
            {MORE_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
