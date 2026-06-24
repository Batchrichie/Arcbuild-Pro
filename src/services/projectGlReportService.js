import { supabase } from '../lib/supabase'

function rowAmount(row) {
  return Number(row.net_amount ?? row.amount ?? row.balance ?? row.total_amount ?? 0)
}

export async function getGlByProject({ projectId, year, month } = {}) {
  let query = supabase.from('gl_by_project').select('*')

  if (projectId) query = query.eq('project_id', projectId)
  if (year) query = query.eq('period_year', year)
  if (month) query = query.eq('period_month', month)

  const { data, error } = await query
    .order('project_name', { ascending: true })
    .order('account_type', { ascending: true })
    .order('account_code', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function summarizeGlByProject(rows) {
  const projects = new Map()

  rows.forEach((row) => {
    const key = `${row.project_id || 'none'}:${row.period_year || ''}:${row.period_month || ''}`
    if (!projects.has(key)) {
      projects.set(key, {
        project_id: row.project_id,
        project_name: row.project_name || 'Unassigned',
        period_year: row.period_year,
        period_month: row.period_month,
        currency: row.currency || 'GHS',
        revenue: [],
        expense: [],
        asset: [],
        totals: { revenue: 0, expense: 0, asset: 0, net: 0 },
      })
    }

    const bucket = projects.get(key)
    const type = String(row.account_type || '').toLowerCase()
    const amount = rowAmount(row)
    const line = {
      account_code: row.account_code,
      account_name: row.account_name,
      amount,
    }

    if (type === 'revenue') {
      bucket.revenue.push(line)
      bucket.totals.revenue += amount
    } else if (type === 'expense') {
      bucket.expense.push(line)
      bucket.totals.expense += amount
    } else if (type === 'asset') {
      bucket.asset.push(line)
      bucket.totals.asset += amount
    }

    bucket.totals.net = bucket.totals.revenue - bucket.totals.expense
  })

  return Array.from(projects.values())
}

export async function getProjectFilterOptions() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('status', 'active')
    .order('name')

  if (error) throw error
  return data ?? []
}
