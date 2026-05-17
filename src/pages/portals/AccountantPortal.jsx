import { useAuth } from '../../context/AuthContext'
import InvoiceList from '../../components/InvoiceList'
import GeneralLedger from '../../components/GeneralLedger'
import FinancialStatements from '../../components/FinancialStatements'
import FxRateManager from '../../components/FxRateManager'

export default function AccountantPortal() {
  const { profile, signOut } = useAuth()

  return (
    <div className="portal-shell">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="portal-sidebar rounded-4xl border border-white/10 p-6 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-[rgba(20,184,166,0.12)] px-4 py-3 text-sm font-semibold text-teal-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500 text-slate-950">AB</span>
                <span>ArcBuild Pro</span>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Accountant workspace</p>
              <p className="mt-2 text-3xl font-semibold text-white">{profile?.full_name ? `Welcome, ${profile.full_name}` : 'Welcome back'}.</p>
              <p className="text-sm leading-6 text-slate-400">Manage invoices, ledger entries, and reporting with a clean, budget-centric interface.</p>
            </div>

              <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Navigation</div>
                <div className="mt-4 space-y-3">
                  <a href="#invoice-list" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-teal-400/30 hover:bg-[rgba(20,184,166,0.08)]">Invoice list</a>
                  <a href="#ledger" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-blue-400/30 hover:bg-[rgba(56,138,221,0.08)]">General ledger</a>
                  <a href="#financial-statements" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-amber-400/30 hover:bg-[rgba(245,166,35,0.08)]">Financial statements</a>
                  <a href="#fx-rates" className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-purple-400/30 hover:bg-[rgba(168,85,247,0.08)]">Exchange rates</a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Signed in as</p>
                    <p className="mt-2 font-semibold text-white">{profile?.full_name ?? 'Accountant'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-teal-400/40 hover:bg-[rgba(20,184,166,0.16)]"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <main className="portal-main space-y-8">
            <section id="invoice-list" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Invoices</p>
                  <h1 className="mt-2 text-2xl font-semibold text-white">Invoice ledger</h1>
                </div>
              </div>
              <InvoiceList />
            </section>

            <section id="ledger" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Ledger</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">General ledger</h2>
                </div>
              </div>
              <GeneralLedger />
            </section>

            <section id="financial-statements" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Reporting</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Financial statements</h2>
              </div>
              <FinancialStatements />
            </section>

            <section id="fx-rates" className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Currency management</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Exchange rates</h2>
                </div>
              </div>
              <FxRateManager />
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
