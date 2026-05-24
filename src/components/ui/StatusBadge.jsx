const STATUS_MAP = {
  draft: {
    label: 'Draft',
    className: 'bg-surface-2 text-text-muted-strong border border-border',
  },
  pending_approval: {
    label: 'Pending approval',
    className: 'bg-warning-bg text-amber-200 border border-warning-border',
  },
  approved: {
    label: 'Approved',
    className: 'bg-success-bg text-teal-200 border border-success-border',
  },
  sent: {
    label: 'Sent',
    className: 'bg-info-bg text-blue-200 border border-info-border',
  },
  paid: {
    label: 'Paid',
    className: 'bg-info-bg text-cyan-200 border border-info-border',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-danger-bg text-red-200 border border-danger-border',
  },
}

export default function StatusBadge({ status, className = '' }) {
  const config = STATUS_MAP[status] || {
    label: status?.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'Unknown',
    className: 'bg-surface-2 text-text-muted-strong border border-border',
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${config.className} ${className}`}>
      {config.label}
    </span>
  )
}
