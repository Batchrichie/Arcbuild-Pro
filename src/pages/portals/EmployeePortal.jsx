import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { EmployeeProvider } from '../../context/EmployeeContext'
import EmployeeHome from '../../components/employee/EmployeeHome'
import EmployeePayslips from '../../components/employee/EmployeePayslips'
import EmployeeLeave from '../../components/employee/EmployeeLeave'
import EmployeeLoans from '../../components/employee/EmployeeLoans'
import EmployeeProfile from '../../components/employee/EmployeeProfile'
import TimesheetEntry from '../../components/TimesheetEntry'
import ThemeToggle from '../../components/ui/ThemeToggle'

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'timesheets', label: 'Timesheets', icon: '📝' },
  { id: 'payslips', label: 'Payslips', icon: '💵' },
  { id: 'leave', label: 'Leave', icon: '🏖️' },
  { id: 'loans', label: 'Loans', icon: '🏦' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

const TITLES = {
  home: 'Home',
  timesheets: 'Timesheets',
  payslips: 'Payslips',
  leave: 'Leave',
  loans: 'Loans',
  profile: 'Profile',
}

function EmployeePortalContent() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('home')
  const [payslipLineId, setPayslipLineId] = useState(null)

  const goPayslip = (line) => {
    setPayslipLineId(line?.id ?? null)
    setTab('payslips')
  }

  const render = () => {
    switch (tab) {
      case 'home':
        return <EmployeeHome onViewPayslip={goPayslip} />
      case 'payslips':
        return <EmployeePayslips initialLineId={payslipLineId} onClearInitial={() => setPayslipLineId(null)} />
      case 'leave':
        return <EmployeeLeave />
      case 'loans':
        return <EmployeeLoans />
      case 'profile':
        return <EmployeeProfile />
      default:
        return <EmployeeHome onViewPayslip={goPayslip} />
    }
  }

  return (
    <div className="portal-shell overflow-x-hidden">
      <div className="mx-auto max-w-3xl px-4 py-6 lg:max-w-6xl lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside className="portal-sidebar hidden rounded-3xl border border-white/10 p-4 lg:block">
            <p className="portal-eyebrow text-slate-500">Employee</p>
            <p className="mt-1 truncate font-semibold text-white">{profile?.full_name}</p>
            <nav className="mt-6 space-y-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`min-touch w-full rounded-xl px-3 py-2.5 text-left text-sm ${
                    tab === t.id ? 'bg-orange-500/15 text-orange-100' : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <button type="button" onClick={signOut} className="mt-6 w-full rounded-full border border-white/10 py-2.5 text-sm text-slate-400">
              Sign out
            </button>
          </aside>

          <main className="portal-main portal-employee-main min-w-0">
            <div className="mb-4 flex flex-col gap-3 lg:hidden">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-white">{TITLES[tab]}</h1>
                <button type="button" onClick={signOut} className="text-sm text-slate-400">Sign out</button>
              </div>
              <ThemeToggle className="self-start" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 sm:p-6">{render()}</div>
          </main>
        </div>
      </div>

      <nav className="portal-mobile-nav" aria-label="Employee navigation">
        <div className="mx-auto flex max-w-lg justify-around px-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex min-h-[3rem] min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.65rem] font-medium sm:text-xs ${
                tab === t.id ? 'text-orange-300' : 'text-slate-500'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>{t.icon}</span>
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
