const STORAGE_PREFIX = 'arcbuild_payroll_variables_'

export function loadVariablePay(runId) {
  if (!runId) return { inputs: {}, submitted: false, submittedAt: null }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${runId}`)
    if (!raw) return { inputs: {}, submitted: false, submittedAt: null }
    return JSON.parse(raw)
  } catch {
    return { inputs: {}, submitted: false, submittedAt: null }
  }
}

export function saveVariablePay(runId, payload) {
  if (!runId) return
  localStorage.setItem(`${STORAGE_PREFIX}${runId}`, JSON.stringify(payload))
}

export function computeOvertimeAmount(hours, rate) {
  const h = parseFloat(hours) || 0
  const r = parseFloat(rate) || 0
  return h * r
}
