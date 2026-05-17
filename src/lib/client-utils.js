import { formatGhs } from './formatGhs'

export { formatGhs }

export const INVOICE_STATUS_STYLE = {
  approved: 'bg-blue-100 text-blue-800',
  sent: 'bg-indigo-100 text-indigo-800',
  paid: 'bg-emerald-100 text-emerald-800',
}

export const PROJECT_STATUS_STYLE = {
  active: 'bg-emerald-100 text-emerald-800',
  on_hold: 'bg-amber-100 text-amber-800',
  completed: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-red-100 text-red-800',
}

export const MILESTONE_STATUS_STYLE = {
  completed: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  in_progress: 'border-amber-400 bg-amber-50 text-amber-900',
  pending: 'border-slate-200 bg-slate-50 text-slate-600',
}

export function publicStorageUrl(fileUrl) {
  if (!fileUrl) return null
  if (fileUrl.startsWith('http')) return fileUrl
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) return fileUrl
  return `${base}/storage/v1/object/public/${fileUrl.replace(/^\//, '')}`
}

export function documentTypeLabel(type) {
  const map = {
    site_photo: 'Site Photos',
    daily_report: 'Daily Reports',
    contract: 'Contracts',
  }
  return map[type] || 'Other'
}
