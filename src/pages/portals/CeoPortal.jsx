import { useAuth } from '../../context/AuthContext'
import ApprovalQueue from '../../components/ApprovalQueue'
import GeneralLedger from '../../components/GeneralLedger'

export default function CeoPortal() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">CEO / Director Portal</h1>
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
            <ApprovalQueue />
            <div className="mt-8">
              <GeneralLedger readOnly={true} />
            </div>
          </div>
          <div>
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
