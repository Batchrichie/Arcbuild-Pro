from pathlib import Path

files = [
    'src/pages/payments/PaymentsReceived.jsx',
    'src/components/banking/ReconciliationWorkspace.jsx',
    'src/components/accountant/RecentJournalEntries.jsx',
    'src/components/ApprovalQueue.jsx',
    'src/components/accountant/ReceivablesAgeing.jsx',
    'src/components/accountant/AccountantDashboard.jsx',
    'src/components/GeneralLedger.jsx',
    'src/components/accountant/JournalDrillDown.jsx',
]

replacements = {
    'text-white': 'text-portal-primary',
    'text-slate-300': 'text-portal-muted',
    'text-slate-400': 'text-portal-muted',
    'text-slate-500': 'text-portal-muted',
    'text-slate-200': 'text-portal-muted-strong',
    'text-slate-900': 'text-portal-primary',
    'text-gray-900': 'text-portal-primary',
    'text-gray-500': 'text-portal-muted',
    'text-gray-400': 'text-portal-muted',
    'text-rose-200': 'text-portal-danger',
    'text-rose-100': 'text-portal-danger',
    'text-amber-300': 'text-portal-warning',
    'text-amber-200': 'text-portal-warning',
    'text-emerald-300': 'text-portal-success',
    'text-cyan-200': 'text-portal-info',
    'text-teal': 'text-portal-info',
    'text-black': 'text-portal-primary',
    'bg-white/5': 'bg-portal-overlay',
    'bg-white/10': 'bg-portal-overlay',
    'bg-white': 'bg-portal-elevated',
    'bg-slate-900/95': 'bg-portal-surface-2',
    'bg-slate-900/80': 'bg-portal-surface-2',
    'bg-slate-950/40': 'bg-portal-surface-2',
    'bg-slate-900': 'bg-portal-surface-2',
    'bg-slate-950': 'bg-portal-surface-2',
    'bg-slate-800': 'bg-portal-input',
    'bg-black/70': 'bg-portal-backdrop',
    'bg-black/50': 'bg-portal-backdrop',
    'bg-cyan-500/10': 'bg-portal-info',
    'bg-emerald-500/10': 'bg-portal-success',
    'bg-emerald-500': 'bg-portal-success',
    'bg-rose-500/10': 'bg-portal-danger',
    'bg-rose-500/15': 'bg-portal-danger',
    'bg-rose-500/20': 'bg-portal-danger',
    'bg-amber-500/10': 'bg-portal-warning',
    'border-gray-200/70': 'border-portal-soft',
    'border-gray-200': 'border-portal-soft',
    'border-gray-100': 'border-portal-soft',
    'border-slate-700/70': 'border-portal-soft',
    'border-slate-700': 'border-portal-soft',
    'border-slate-500/30': 'border-portal-soft',
    'border-emerald-400/30': 'border-portal-success',
    'border-emerald-400/40': 'border-portal-success',
    'border-rose-400/30': 'border-portal-danger',
    'border-orange-400/30': 'border-portal-warning',
    'border-amber-400/30': 'border-portal-warning',
    'border-amber-500/30': 'border-portal-warning',
    'border-cyan-400/20': 'border-portal-info',
    'hover:bg-white/5': 'hover:bg-portal-overlay',
    'hover:bg-white/10': 'hover:bg-portal-overlay',
    'hover:border-white/20': 'hover:border-portal-soft',
    'hover:border-emerald-400/20': 'hover:border-portal-success',
    'hover:border-rose-400/30': 'hover:border-portal-danger',
    'hover:bg-emerald-500/20': 'hover:bg-portal-success',
    'hover:bg-rose-500/20': 'hover:bg-portal-danger',
    'hover:bg-slate-700': 'hover:bg-portal-surface-2',
    'hover:bg-success/90': 'hover:bg-portal-success',
    'hover:bg-danger/90': 'hover:bg-portal-danger',
}

for file_path in files:
    path = Path(file_path)
    text = path.read_text(encoding='utf-8')
    new_text = text
    for old, new in replacements.items():
        new_text = new_text.replace(old, new)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')
        print(f'Updated {file_path}')
