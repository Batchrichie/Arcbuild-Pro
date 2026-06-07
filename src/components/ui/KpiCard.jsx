export default function KpiCard({
  title,
  value,
  icon: Icon,
  loading = false,
  accent = 'text-amber-300',
  actionLabel,
  onClick,
}) {
  if (typeof onClick !== 'function') {
    throw new Error('KpiCard requires an onClick function prop')
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group w-full rounded-3xl panel-surface p-5 text-left shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-400/60 disabled:cursor-wait disabled:opacity-80"
    >
      <div className="flex items-center justify-between">
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-white/10 bg-white/5 ${accent}`}>
          {loading ? (
            <div className="h-6 w-6 rounded-full bg-slate-700/40 animate-pulse" />
          ) : (
            Icon ? <Icon className="h-6 w-6" /> : null
          )}
        </div>

        {actionLabel ? (
          loading ? (
            <div className="h-6 w-20 rounded-full bg-slate-700/40 animate-pulse" />
          ) : (
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
              {actionLabel}
            </span>
          )
        ) : null}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="h-4 w-32 rounded-full bg-slate-700/40 animate-pulse" />
        ) : (
          <p className="text-sm font-medium text-text-muted">{title}</p>
        )}

        {loading ? (
          <div className="mt-3 h-10 w-24 rounded-full bg-slate-700/40 animate-pulse" />
        ) : (
          <p className={`mt-3 text-3xl font-bold ${accent}`}>{value}</p>
        )}
      </div>
    </button>
  )
}
