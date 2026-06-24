import { formatGhs } from '../../lib/formatGhs'

export default function RecentJournalEntries({ entries, loading, onSelect }) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-portal-soft bg-portal-elevated dark:border-portal-soft dark:bg-portal-surface-2 p-4">
        <div className="h-40 animate-pulse rounded-xl bg-portal-overlay" />
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-portal-soft bg-portal-elevated dark:border-portal-soft dark:bg-portal-input p-4 max-h-[520px] overflow-y-auto">
      <p className="text-sm font-semibold text-portal-primary dark:text-portal-primary">Recent journal entries</p>
      <p className="mt-0.5 text-sm text-portal-muted dark:text-portal-muted">Last 10 postings</p>
      {!entries?.length ? (
        <p className="mt-4 text-sm text-portal-muted">No journal entries yet.</p>
      ) : (
        <ul className="mt-4 space-y-2 pr-1">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-portal-soft dark:border-portal-soft last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect?.(entry.id)}
                className="min-touch w-full rounded-xl bg-portal-overlay px-3 py-3 text-left transition hover:bg-portal-surface-2 dark:hover:bg-portal-surface-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{entry.entry_number || entry.id.slice(0, 8)}</span>
                  <span className="text-xs text-portal-muted">
                    {entry.entry_date?.split?.('T')?.[0] || entry.entry_date}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-portal-muted dark:text-portal-muted">{entry.description}</p>
                <p className="mt-1 text-sm font-semibold text-portal-primary dark:text-portal-primary">GHS {formatGhs(entry.totalAmount)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
