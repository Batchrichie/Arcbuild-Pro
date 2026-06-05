import { supabase } from '../lib/supabase'

export async function addPerformanceObligation(projectId, data) {
  const payload = {
    project_id: projectId,
    description: data.description,
    standalone_selling_price: data.standalone_selling_price,
    allocated_transaction_price:
      data.allocated_transaction_price ?? data.standalone_selling_price,
    satisfaction_method: data.satisfaction_method || 'over_time',
    pct_complete: data.pct_complete ?? 0,
    status: data.status || 'pending',
    completion_evidence: data.completion_evidence || null,
  }

  const { data: row, error } = await supabase
    .from('performance_obligations')
    .insert(payload)
    .select()
    .single()

  if (error) throw error

  await supabase.rpc('allocate_transaction_price', { p_project_id: projectId })

  return row
}

export async function updatePOCompletion(poId, pctComplete) {
  const { data: existing, error: findError } = await supabase
    .from('performance_obligations')
    .select('id, project_id')
    .eq('id', poId)
    .maybeSingle()

  if (findError) throw findError
  if (!existing) throw new Error('Performance obligation not found')

  const status = pctComplete >= 100 ? 'completed' : 'in_progress'

  const { data, error } = await supabase
    .from('performance_obligations')
    .update({ pct_complete: pctComplete, status })
    .eq('id', poId)
    .select()
    .single()

  if (error) throw error

  await supabase.rpc('allocate_transaction_price', { p_project_id: existing.project_id })

  return data
}

export async function addVariableConsideration(projectId, data) {
  const payload = {
    project_id: projectId,
    type: data.type,
    description: data.description || null,
    estimated_amount: data.estimated_amount,
    constraint_applied: data.constraint_applied ?? true,
    probability: data.probability ?? null,
    effective_date: data.effective_date || null,
  }

  const { data: row, error } = await supabase
    .from('variable_consideration')
    .insert(payload)
    .select()
    .single()

  if (error) throw error

  await supabase.rpc('allocate_transaction_price', { p_project_id: projectId })

  return row
}

export async function recordModification(modificationData) {
  const payload = {
    project_id: modificationData.project_id,
    modification_date: modificationData.modification_date,
    description: modificationData.description,
    original_contract_value: modificationData.original_contract_value,
    modified_contract_value: modificationData.modified_contract_value,
    accounting_treatment: modificationData.accounting_treatment,
    approved_by: modificationData.approved_by || null,
  }

  const { data: created, error: insertError } = await supabase
    .from('contract_modifications')
    .insert(payload)
    .select()
    .single()

  if (insertError) throw insertError

  const { data, error } = await supabase.rpc('record_contract_modification', {
    p_modification_id: created.id,
  })

  if (error) throw error

  return { modification: created, result: data }
}

export async function getRevenueAllocationSummary(projectId) {
  const [poResult, vcResult, modResult, projectResult] = await Promise.all([
    supabase
      .from('performance_obligations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('variable_consideration')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('contract_modifications')
      .select('*')
      .eq('project_id', projectId)
      .order('modification_date', { ascending: false }),
    supabase
      .from('projects')
      .select('id, name, contract_value')
      .eq('id', projectId)
      .maybeSingle(),
  ])

  if (poResult.error) throw poResult.error
  if (vcResult.error) throw vcResult.error
  if (modResult.error) throw modResult.error
  if (projectResult.error) throw projectResult.error

  return {
    project: projectResult.data || null,
    performanceObligations: poResult.data || [],
    variableConsideration: vcResult.data || [],
    contractModifications: modResult.data || [],
  }
}
