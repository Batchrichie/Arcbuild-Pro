import type { ReactNode } from 'react'

export interface EmptyStateProps {
  children?: ReactNode
  title?: string
  message?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export default function EmptyState({
  children,
  title = 'Nothing to show',
  message,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-3xl border border-border-soft bg-surface-overlay px-6 py-10 text-center ${className}`}>
      {icon && <div className="mb-4 text-text-muted">{icon}</div>}
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      {message && <div className="mt-2 max-w-md text-sm text-text-muted">{message}</div>}
      {children}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
