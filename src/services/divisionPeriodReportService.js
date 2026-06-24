import { supabase } from '../lib/supabase'

function rowAmount(row) {
  return Number(row.net_amount ?? row.amount ?? row.balance ?? row.total_amount ?? 0)
}

export async function getGlByDivisionPeriod({ divisionId, fiscalYear, month } = {}) {
  let query = supabase.from('gl_by_division_period').select('*')

  if (divisionId) query = query.eq('division_id', divisionId)
  if (fiscalYear) query = query.eq('fiscal_year', fiscalYear)
  if (month) query = query.eq('period_month', month)

  const { data, error } = await query
    .order('division_name', { ascending: true })
    .order('financial_statement', { ascending: true })
    .order('account_code', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function groupGlByDivisionPeriod(rows) {
  const divisions = new Map()

  rows.forEach((row) => {
    const divKey = row.division_id || 'unassigned'
    if (!divisions.has(divKey)) {
      divisions.set(divKey, {
        division_id: row.division_id,
        division_name: row.division_name || 'Unassigned',
        fiscal_year: row.fiscal_year,
        period_month: row.period_month,
        statements: {},
      })
    }

    const division = divisions.get(divKey)
    const statement = row.financial_statement || 'Other'
    if (!division.statements[statement]) {
      division.statements[statement] = { lines: [], total: 0 }
    }

    const amount = rowAmount(row)
    division.statements[statement].lines.push({
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      amount,
    })
    division.statements[statement].total += amount
  })

  return Array.from(divisions.values())
}

export async function getDivisionFilterOptions() {
  const { data, error } = await supabase.from('divisions').select('id, name').order('name')
  if (error) throw error
  return data ?? []
}
