const STATUS_MAP = {
  draft: {
    label: 'Draft',
    className: 'bg-slate-800/90 text-slate-100 border border-slate-700',
  },
  pending_approval: {
    label: 'Pending approval',
    className: 'bg-amber-900/15 text-amber-200 border border-amber-700',
  },
  approved: {
    label: 'Approved',
    className: 'bg-teal-900/15 text-teal-200 border border-teal-700',
  },
  sent: {
    label: 'Sent',
    className: 'bg-blue-900/15 text-blue-200 border border-blue-700',
  },
  paid: {
    label: 'Paid',
    className: 'bg-cyan-900/15 text-cyan-200 border border-cyan-700',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-900/15 text-red-200 border border-red-700',
  },
}

export default function StatusBadge({ status, className = '' }) {
  const config = STATUS_MAP[status] || {
    label: status?.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'Unknown',
    className: 'bg-slate-800 text-slate-100 border border-slate-700',
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${config.className} ${className}`}>
      {config.label}
    </span>
  )
}
