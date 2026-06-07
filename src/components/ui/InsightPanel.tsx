import type { ReactNode } from 'react'

export interface InsightPanelProps {
  children?: ReactNode
  title?: string
  subtitle?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  icon?: ReactNode
  className?: string
}

const toneClass: Record<NonNullable<InsightPanelProps['tone']>, string> = {
  neutral: 'border-border-soft bg-surface-overlay text-text-primary',
  success: 'border-success-border bg-success-bg text-text-primary',
  warning: 'border-warning-border bg-warning-bg text-text-primary',
  danger: 'border-danger-border bg-danger-bg text-text-primary',
  info: 'border-info-border bg-info-bg text-text-primary',
}

export default function InsightPanel({
  children,
  title,
  subtitle,
  tone = 'neutral',
  icon,
  className = '',
}: InsightPanelProps) {
  return (
    <aside className={`rounded-3xl border p-4 sm:p-5 ${toneClass[tone]} ${className}`}>
      <div className="flex items-start gap-3">
        {icon && <div className="shrink-0 text-text-muted">{icon}</div>}
        <div className="min-w-0 flex-1">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </aside>
  )
}
