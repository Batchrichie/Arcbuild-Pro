import type { ReactNode } from 'react'

export interface KpiCardProps {
  children?: ReactNode
  label?: string
  value?: ReactNode
  helperText?: ReactNode
  trend?: ReactNode
  icon?: ReactNode
  onClick?: () => void
  className?: string
}

export default function KpiCard({
  children,
  label,
  value,
  helperText,
  trend,
  icon,
  onClick,
  className = '',
}: KpiCardProps) {
  const Component = onClick ? 'button' : 'article'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`kpi-card text-left ${onClick ? 'min-touch cursor-pointer hover:border-success/30' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {label && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>}
          {value && <div className="mt-3 text-2xl font-semibold text-text-primary">{value}</div>}
        </div>
        {icon && <div className="shrink-0 text-text-muted">{icon}</div>}
      </div>
      {trend && <div className="mt-3 text-sm text-text-muted-strong">{trend}</div>}
      {helperText && <div className="mt-2 text-sm text-text-muted">{helperText}</div>}
      {children}
    </Component>
  )
}
