export function firstName(fullName) {
  if (!fullName) return 'there'
  return fullName.trim().split(/\s+/)[0]
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function countWeekdays(startStr, endStr) {
  if (!startStr || !endStr) return 0
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (end < start) return 0
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count += 1
    d.setDate(d.getDate() + 1)
  }
  return count
}

export function maskAccount(value) {
  const s = String(value || '').replace(/\s/g, '')
  if (s.length < 4) return '—'
  return `****${s.slice(-4)}`
}

export function maskTin(value) {
  const s = String(value || '')
  if (s.length < 3) return '—'
  return `***${s.slice(-3)}`
}

export function maskSsnit(value) {
  const s = String(value || '')
  if (s.length < 4) return '—'
  return `****${s.slice(-4)}`
}

export function buildLoanSchedule(loan) {
  if (!loan || loan.status !== 'active') return []
  let balance = Number(loan.outstanding_balance) || 0
  const monthly = Number(loan.monthly_deduction) || 0
  if (monthly <= 0) return []

  const schedule = []
  const cursor = new Date(loan.start_date || Date.now())
  let guard = 0
  while (balance > 0.01 && guard < 120) {
    const opening = balance
    const deduction = Math.min(monthly, opening)
    balance = Math.round((opening - deduction) * 100) / 100
    schedule.push({
      month: cursor.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' }),
      opening,
      deduction,
      closing: balance,
    })
    cursor.setMonth(cursor.getMonth() + 1)
    guard += 1
  }
  return schedule
}

export const EMPLOYEE_LEAVE_TYPES = [
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
  { value: 'other', label: 'Compassionate' },
  { value: 'unpaid', label: 'Unpaid' },
]
