const DEFAULT_OPTIONS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

export default function TimeframeToggle({ value, onChange, options = DEFAULT_OPTIONS }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-slate-700 bg-slate-950/70 p-1 text-sm shadow-sm">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`px-3 py-2 transition ${
              active
                ? 'bg-slate-100 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:bg-slate-900/80 hover:text-slate-100'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
