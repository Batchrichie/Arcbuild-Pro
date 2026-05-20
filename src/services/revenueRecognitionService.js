import { supabase } from '../lib/supabase'

export async function calculatePctCompleteByCost(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('budget_cost, actual_cost_to_date')
    .eq('id', projectId)
    .maybeSingle()

  if (error) throw error
  if (!data) return 0
  const budget = Number(data.budget_cost || 0)
  const actual = Number(data.actual_cost_to_date || 0)
  if (budget === 0) return 0
  return Math.min((actual / budget) * 100, 100)
}

export async function calculatePctCompleteByMilestone(projectId) {
  const { data, error } = await supabase
    .from('milestones')
    .select('id, status')
    .eq('project_id', projectId)

  if (error) throw error
  const rows = data || []
  if (rows.length === 0) return 0
  const completed = rows.filter(r => r.status === 'completed').length
  return Math.min((completed / rows.length) * 100, 100)
}

export async function runRevenueRecognition({ projectId, pctComplete, contractValue, priorRecognised, costToDate, periodLabel, recognisedBy }) {
  const params = {
    p_project_id: projectId,
    p_pct_complete: pctComplete,
    p_contract_value: contractValue,
    p_prior_recognised: priorRecognised,
    p_cost_to_date: costToDate,
    p_period_label: periodLabel,
    p_recognised_by: recognisedBy || null,
  }

  const { data, error } = await supabase.rpc('post_revenue_recognition_journal', params)
  if (error) throw error

  // audit log
  try {
    await supabase.from('audit_log').insert({
      user_id: recognisedBy,
      action: 'REVENUE_RECOGNITION',
      table_name: 'revenue_recognition',
      record_id: data,
      old_value: null,
      new_value: null,
    })
  } catch (e) {
    // non-fatal
    console.warn('Failed to write audit log', e)
  }

  return data
}

export async function getRecognitionHistory(projectId) {
  const { data, error } = await supabase
    .from('revenue_recognition')
    .select('*')
    .eq('project_id', projectId)
    .order('recognition_date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getCompanyRecognitionSummary() {
  // Fetch active projects
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, contract_value, pct_complete, revenue_recognised')
    .eq('status', 'active')

  if (projErr) throw projErr

  const rows = []
  for (const p of projects || []) {
    const { data: invSum, error: invErr } = await supabase
      .from('invoices')
      .select('gross_total_ghs')
      .eq('project_id', p.id)
      .in('status', ['approved','sent','paid'])

    if (invErr) throw invErr
    const invoiced = (invSum || []).reduce((s, r) => s + Number(r.gross_total_ghs || 0), 0)
    const billingStatus = invoiced > (p.revenue_recognised || 0) ? 'overbilled' : (invoiced < (p.revenue_recognised || 0) ? 'underbilled' : 'on_track')
    rows.push({
      project_id: p.id,
      project_name: p.name,
      contract_value: Number(p.contract_value || 0),
      pct_complete: Number(p.pct_complete || 0),
      revenue_recognised: Number(p.revenue_recognised || 0),
      invoiced,
      billing_status: billingStatus,
    })
  }

  return rows
}
