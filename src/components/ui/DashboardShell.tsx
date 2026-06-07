import type { ReactNode } from 'react'

export interface DashboardShellProps {
  children?: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export default function DashboardShell({
  children,
  title,
  subtitle,
  actions,
  className = '',
}: DashboardShellProps) {
  return (
    <section className={`space-y-6 ${className}`}>
      {(title || subtitle || actions) && (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {subtitle && <p className="portal-section-eyebrow uppercase tracking-[0.24em]">{subtitle}</p>}
            {title && <h2 className="mt-1 text-2xl font-semibold text-text-primary">{title}</h2>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
