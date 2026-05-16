import { useAuth } from '../../context/AuthContext'
import InvoiceList from '../../components/InvoiceList'
import GeneralLedger from '../../components/GeneralLedger'
import FinancialStatements from '../../components/FinancialStatements'

export default function AccountantPortal() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Accountant Portal</h1>
              <p className="mt-2 text-sm text-slate-600">Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}.</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <InvoiceList />
            <div className="mt-8">
              <GeneralLedger />
            </div>
            <div id="financial-statements" className="mt-8">
              <FinancialStatements />
            </div>
          </div>
          <div>
            {/* Financial Statements panel */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Reports</h3>
            </div>
            <div className="bg-white p-4 rounded border">
              <a href="#financial-statements" className="text-indigo-600">Open Financial Statements</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
