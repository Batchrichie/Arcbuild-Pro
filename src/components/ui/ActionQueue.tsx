import type { ReactNode } from 'react'

export interface ActionQueueProps {
  children?: ReactNode
  title?: string
  subtitle?: string
  empty?: ReactNode
  actions?: ReactNode
  className?: string
}

export default function ActionQueue({
  children,
  title,
  subtitle,
  empty,
  actions,
  className = '',
}: ActionQueueProps) {
  return (
    <section className={`rounded-3xl border border-border-soft bg-surface-overlay p-4 sm:p-6 ${className}`}>
      {(title || subtitle || actions) && (
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h3 className="text-lg font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children || empty}
    </section>
  )
}
