import { formatGhs } from '../../lib/formatGhs'

export default function RecentJournalEntries({ entries, loading, onSelect }) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200/70 bg-white dark:border-slate-700/70 dark:bg-slate-900/80 p-4">
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 p-4 max-h-[520px] overflow-y-auto">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">Recent journal entries</p>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Last 10 postings</p>
      {!entries?.length ? (
        <p className="mt-4 text-sm text-slate-500">No journal entries yet.</p>
      ) : (
        <ul className="mt-4 space-y-2 pr-1">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-gray-100 dark:border-slate-700 last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect?.(entry.id)}
                className="min-touch w-full rounded-xl bg-white/5 px-3 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{entry.entry_number || entry.id.slice(0, 8)}</span>
                  <span className="text-xs text-gray-400">
                    {entry.entry_date?.split?.('T')?.[0] || entry.entry_date}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{entry.description}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">GHS {formatGhs(entry.totalAmount)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
