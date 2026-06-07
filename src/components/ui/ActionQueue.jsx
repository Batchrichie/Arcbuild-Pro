import { Inbox } from 'lucide-react'
import EmptyState from './EmptyState'

export default function ActionQueue({ title, subtitle, items = [], loading = false }) {
  if (!Array.isArray(items)) {
    throw new Error('ActionQueue expects items to be an array')
  }

  if (!loading) {
    const invalidItem = items.find((item) => typeof item.onClick !== 'function')
    if (invalidItem) {
      throw new Error('Each ActionQueue item requires an onClick function')
    }
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-xl shadow-black/10 overflow-hidden">
      <div className="bg-blue-600 dark:bg-blue-700 text-white rounded-t-lg px-4 py-2">
        <p className="text-[14px] font-medium">{title}</p>
        {subtitle ? <p className="mt-1 text-[12px] text-white/80">{subtitle}</p> : null}
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {loading ? (
          [1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="col-span-1 flex items-center gap-3 rounded-3xl border border-gray-200/70 bg-white dark:border-slate-700/70 dark:bg-slate-900/80 p-3"
            >
              <div className="h-10 w-10 rounded-3xl bg-gray-50 dark:bg-slate-800 animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 rounded-full bg-gray-200 dark:bg-slate-700 animate-pulse" />
                <div className="h-3 w-1/3 rounded-full bg-gray-200 dark:bg-slate-700 animate-pulse" />
              </div>
              <div className="h-7 w-16 rounded-full bg-gray-200 dark:bg-slate-700 animate-pulse" />
            </div>
          ))
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No queued actions"
            description="All priority work items are complete for now. Check back later or refresh to see new tasks."
          />
        ) : (
          items.map((item, index) => {
            const Icon = item.icon
            const isLastOdd = items.length % 2 === 1 && index === items.length - 1
            const rowBg = index % 2 === 0 ? 'bg-gray-50 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-900/40'
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`group flex w-full min-h-[120px] items-center justify-between gap-3 rounded-3xl border border-gray-200 dark:border-slate-700 ${rowBg} p-3 text-left transition hover:border-slate-500/70 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/20 ${isLastOdd ? 'col-span-2' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-gray-50 dark:bg-slate-800 text-amber-400">
                    {Icon ? <Icon className="h-5 w-5" /> : <span className="h-3.5 w-3.5 rounded-full bg-gray-200 dark:bg-slate-700" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
                    {item.detail ? (
                      <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400 truncate">{item.detail}</p>
                    ) : null}
                  </div>
                </div>
                <span className="rounded-full bg-gray-100/90 px-2.5 py-1 text-sm font-semibold text-gray-900 dark:bg-slate-900/80 dark:text-white">{item.value}</span>
                {item.actionLabel ? (
                  <span className="inline-flex rounded-full bg-white/5 dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300 transition group-hover:bg-white/10">
                    {item.actionLabel}
                  </span>
                ) : null}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
