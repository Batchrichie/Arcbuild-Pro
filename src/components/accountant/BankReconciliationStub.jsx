export default function BankReconciliationStub() {
  return (
    <div className="rounded-4xl border border-teal-400/20 bg-gradient-to-br from-[rgba(20,184,166,0.08)] to-[rgba(255,255,255,0.03)] p-8 sm:p-10 shadow-xl shadow-black/10">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-2xl" aria-hidden>
          🏦
        </span>
        <h2 className="text-2xl font-semibold text-white">Bank Reconciliation</h2>
      </div>
      <div className="my-6 border-t border-dashed border-white/15" />
      <p className="text-base leading-relaxed text-slate-300">
        This feature will be available in Phase 5.
        <br />
        It will allow you to import bank statements
        <br />
        and auto-match against system transactions.
      </p>
      <p className="mt-8 inline-flex items-center rounded-full border border-teal-400/30 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-200">
        Coming in Phase 5
      </p>
    </div>
  )
}
