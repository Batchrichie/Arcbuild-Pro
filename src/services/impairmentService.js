import { supabase } from '../lib/supabase'

export async function runMonthlyImpairmentReview({ runDate } = {}) {
  const dateValue = runDate
    ? new Date(runDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  const { data, error } = await supabase.rpc('run_receivables_aging', {
    p_run_date: dateValue,
  })

  if (error) throw error
  return data
}

export async function postImpairmentLoss(assessmentId) {
  if (!assessmentId) throw new Error('assessmentId is required')

  const { data, error } = await supabase.rpc('post_impairment_journal', {
    p_assessment_id: assessmentId,
  })

  if (error) throw error
  return data
}

export async function reverseImpairment(assessmentId, reversalAmount) {
  if (!assessmentId) throw new Error('assessmentId is required')
  if (typeof reversalAmount !== 'number' || reversalAmount <= 0) {
    throw new Error('reversalAmount must be a positive number')
  }

  const { data, error } = await supabase.rpc('reverse_impairment_assessment', {
    p_assessment_id: assessmentId,
    p_reversal_amount: reversalAmount,
  })

  if (error) throw error
  return data
}

export async function getImpairmentSummary(filters = {}) {
  let query = supabase
    .from('impairment_assessments')
    .select(
      `*,
       project:projects(id,name),
       invoice:invoices(id,invoice_number,due_date),
       asset:assets(id,name,asset_type)`
    )
    .order('assessment_date', { ascending: false })

  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.invoiceId) query = query.eq('invoice_id', filters.invoiceId)
  if (filters.assetType) query = query.eq('asset_type', filters.assetType)
  if (filters.basis) query = query.eq('basis', filters.basis)
  if (filters.posted !== undefined) query = query.eq('posted', filters.posted)
  if (filters.dateFrom) query = query.gte('assessment_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('assessment_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw error

  const assessments = data || []
  const summary = assessments.reduce(
    (acc, assessment) => {
      const amount = Number(assessment.impairment_loss || 0)
      acc.totalAssessments += 1
      acc.totalImpairment += amount
      acc.byAssetType[assessment.asset_type] =
        (acc.byAssetType[assessment.asset_type] || 0) + amount
      acc.byBasis[assessment.basis] = (acc.byBasis[assessment.basis] || 0) + amount
      if (assessment.posted) acc.postedImpairment += amount
      else acc.unpostedImpairment += amount
      return acc
    },
    {
      totalAssessments: 0,
      totalImpairment: 0,
      byAssetType: {},
      byBasis: {},
      postedImpairment: 0,
      unpostedImpairment: 0,
    }
  )

  return {
    assessments,
    summary,
  }
}
