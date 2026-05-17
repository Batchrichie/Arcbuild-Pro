/** Compact executive display: GHS 1.2M, GHS 450K, GHS 12,500 */
export function formatGhsCompact(value) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const formatted = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')
    return `${sign}GHS ${formatted}M`
  }
  if (abs >= 1_000) {
    const k = abs / 1_000
    const formatted = k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')
    return `${sign}GHS ${formatted}K`
  }
  return `${sign}GHS ${abs.toLocaleString('en-GH', { maximumFractionDigits: 0 })}`
}

export function formatGhs(value) {
  return Number(value || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function liabilityBalance(rawBalance) {
  const b = Number(rawBalance) || 0
  return b <= 0 ? Math.abs(b) : b
}
