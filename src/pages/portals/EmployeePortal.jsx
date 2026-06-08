import { useState, useEffect, lazy, Suspense } from 'react'
import { COMPANY } from '../../lib/company-config'
import { useAuth } from '../../context/AuthContext'
import { EmployeeProvider } from '../../context/EmployeeContext'
import EmployeeHome from '../../components/employee/EmployeeHome'
import Modal from '../../components/ui/Modal'
import ThemeToggle from '../../components/ui/ThemeToggle'
import PortalSidebarFooter from '../../components/ui/PortalSidebarFooter'
import { Banknote, CircleDollarSign, ClipboardPenLine, Home, Palmtree, UserCircle } from 'lucide-react'

// Lazy load employee portal components
const EmployeePayslips = lazy(() => import('../../components/employee/EmployeePayslips'))
const EmployeeLeave = lazy(() => import('../../components/employee/EmployeeLeave'))
const EmployeeLoans = lazy(() => import('../../components/employee/EmployeeLoans'))
const EmployeeProfile = lazy(() => import('../../components/employee/EmployeeProfile'))
const TimesheetEntry = lazy(() => import('../../components/TimesheetEntry'))

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


const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'timesheets', label: 'Timesheets', icon: ClipboardPenLine },
  { id: 'payslips', label: 'Payslips', icon: CircleDollarSign },
  { id: 'leave', label: 'Leave', icon: Palmtree },
  { id: 'loans', label: 'Loans', icon: Banknote },
  { id: 'profile', label: 'Profile', icon: UserCircle },
]

const TITLES = {
  home: 'Home',
  timesheets: 'Timesheets',
  payslips: 'Payslips',
  leave: 'Leave',
  loans: 'Loans',
  profile: 'Profile',
}

function PortalIcon({ icon: Icon, className = 'h-5 w-5' }) {
  return <Icon className={className} aria-hidden />
}

function EmployeePortalContent() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('home')
  const [payslipLineId, setPayslipLineId] = useState(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [timesheetOpen, setTimesheetOpen] = useState(false)
  useEffect(() => {
    try { document.title = `${COMPANY.appName} — Employee` } catch { /* best effort */ }
  }, [])

  const goPayslip = (line) => {
    setPayslipLineId(line?.id ?? null)
    setTab('payslips')
  }

  const goTimesheets = () => {
    setTab('timesheets')
    setTimesheetOpen(true)
  }

  const goLeave = () => {
    setTab('leave')
    setLeaveOpen(true)
  }

  const render = () => {
    switch (tab) {
      case 'home':
        return <EmployeeHome onViewPayslip={goPayslip} onOpenTimesheet={goTimesheets} onOpenLeave={goLeave} />
      case 'payslips':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <EmployeePayslips initialLineId={payslipLineId} onClearInitial={() => setPayslipLineId(null)} />
          </Suspense>
        )
      case 'leave':
        return (
          <div>
            <button type="button" onClick={() => setLeaveOpen(true)} className="rounded-lg bg-cyan-500 px-4 py-2 text-white">Apply for leave</button>
            <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Leave application" size="md">
              <Suspense fallback={<PortalComponentLoader />}>
                <EmployeeLeave />
              </Suspense>
            </Modal>
          </div>
        )
      case 'loans':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <EmployeeLoans />
          </Suspense>
        )
      case 'profile':
        return (
          <Suspense fallback={<PortalComponentLoader />}>
            <EmployeeProfile />
          </Suspense>
        )
      case 'timesheets':
        return (
          <div>
            <button type="button" onClick={() => setTimesheetOpen(true)} className="rounded-lg bg-amber-500 px-4 py-2 text-white">New timesheet</button>
            <Modal open={timesheetOpen} onClose={() => setTimesheetOpen(false)} title="Timesheet entry" size="xl">
              <Suspense fallback={<PortalComponentLoader />}>
                <TimesheetEntry />
              </Suspense>
            </Modal>
          </div>
        )
      default:
        return <EmployeeHome onViewPayslip={goPayslip} />
    }
  }

  return (
    <div className="portal-shell min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:max-w-none lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="portal-sidebar hidden md:flex md:flex-col rounded-3xl border border-border-soft p-4">
            <p className="portal-eyebrow text-slate-500">Employee</p>
            <p className="mt-1 truncate font-semibold text-white">{profile?.full_name}</p>
            <nav className="mt-6 space-y-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`min-touch w-full rounded-xl px-3 py-2.5 text-left text-sm lg:text-[15px] ${
                    tab === t.id ? 'bg-orange-500/15 text-orange-100' : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <PortalSidebarFooter
              onSignOut={signOut}
              signOutLabel="Sign out"
              signOutClassName="text-slate-400 hover:border-orange-400/40"
            />
          </aside>

          <main className="portal-main portal-employee-main min-w-0 w-full overflow-x-hidden pb-24 lg:pb-0">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl lg:text-3xl font-semibold text-white truncate">{TITLES[tab]}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button type="button" onClick={signOut} className="text-sm text-slate-400">Sign out</button>
                <ThemeToggle className="self-start" />
              </div>
            </div>
            <div className="w-full rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6 lg:p-8">{render()}</div>
          </main>
        </div>
      </div>

      <nav className="portal-mobile-nav md:hidden" aria-label="Employee navigation">
        <div className="mx-auto flex max-w-lg justify-around px-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex min-h-[3rem] min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.65rem] font-medium sm:text-xs ${
                tab === t.id ? 'text-orange-300' : 'text-slate-500'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden><PortalIcon icon={t.icon} /></span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function EmployeePortal() {
  return (
    <EmployeeProvider>
      <EmployeePortalContent />
    </EmployeeProvider>
  )
}
