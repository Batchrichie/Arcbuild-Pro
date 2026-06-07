export default function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  className = '',
}) {
  const hasButton = ctaLabel && typeof onCtaClick === 'function'

  return (
    <div className={`rounded-3xl border border-border-soft bg-surface p-8 text-center ${className}`}>
      {Icon ? (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-300">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
      ) : null}
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {hasButton ? (
        <button
          type="button"
          onClick={onCtaClick}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  )
}
