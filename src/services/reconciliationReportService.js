import { supabase } from '../lib/supabase'

export async function getSubledgerGlReconciliation() {
  const { data, error } = await supabase
    .from('v_subledger_gl_reconciliation')
    .select('*')
    .order('reconciliation_status', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function partitionReconciliationRows(rows) {
  const issues = []
  const matched = []

  for (const row of rows) {
    const status = String(row.reconciliation_status || row.match_status || '').toUpperCase()
    if (status === 'ORPHAN' || status === 'DISCREPANCY') {
      issues.push(row)
    } else {
      matched.push(row)
    }
  }

  return { issues, matched }
}
