import { formatGhs } from '../../lib/formatGhs'

export default function RecentJournalEntries({ entries, loading, onSelect }) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
      <p className="text-sm font-semibold text-white">Recent journal entries</p>
      <p className="mt-0.5 text-sm text-slate-500">Last 10 postings</p>
      {!entries?.length ? (
        <p className="mt-4 text-sm text-slate-500">No journal entries yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect?.(entry.id)}
                className="min-touch w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-teal-400/30 hover:bg-teal-500/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-teal-200">{entry.entry_number || entry.id.slice(0, 8)}</span>
                  <span className="text-sm text-slate-400">
                    {entry.entry_date?.split?.('T')?.[0] || entry.entry_date}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-300">{entry.description}</p>
                <p className="mt-1 text-sm font-semibold text-white">GHS {formatGhs(entry.totalAmount)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
