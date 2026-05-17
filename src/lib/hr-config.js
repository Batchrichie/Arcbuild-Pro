import { supabase } from './supabase'

const ANNUAL_LEAVE_DEFAULT = 21

export async function fetchAnnualLeaveEntitlement() {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'annual_leave_entitlement_days')
    .maybeSingle()

  const parsed = parseInt(data?.value, 10)
  return Number.isFinite(parsed) ? parsed : ANNUAL_LEAVE_DEFAULT
}

export function daysInclusive(start, end) {
  if (!start || !end) return 0
  const a = new Date(start)
  const b = new Date(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)) + 1)
}

export function downloadCsv(rows, filename) {
  const csv = rows.map((row) =>
    row.map((cell) => {
      const s = String(cell ?? '')
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const LEAVE_TYPE_COLORS = {
  annual: 'bg-emerald-500/25 text-emerald-200',
  sick: 'bg-red-500/20 text-red-300',
  maternity: 'bg-pink-500/20 text-pink-200',
  paternity: 'bg-blue-500/20 text-blue-200',
  study: 'bg-violet-500/20 text-violet-200',
  unpaid: 'bg-slate-500/30 text-slate-300',
  other: 'bg-amber-500/20 text-amber-200',
}
