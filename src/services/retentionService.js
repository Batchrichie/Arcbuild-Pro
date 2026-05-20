import { supabase } from '../lib/supabase'

const zeroSummary = {
  clientWithheld: 0,
  clientReleased: 0,
  clientBalance: 0,
  subcontractorWithheld: 0,
  subcontractorReleased: 0,
  subcontractorBalance: 0,
}

export async function recordRetentionWithheld({ invoiceId, projectId, contractId, retentionRate, grossAmount, postedBy }) {
  const retentionAmount = Number(grossAmount || 0) * (Number(retentionRate || 0) / 100)
  const netPayable = Number(grossAmount || 0) - retentionAmount

  const { data: invoiceBefore, error: fetchError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (fetchError) throw fetchError
  if (!invoiceBefore) throw new Error('Invoice not found')

  const { error: invoiceError, data: invoiceUpdated } = await supabase
    .from('invoices')
    .update({
      retention_rate: retentionRate,
      retention_withheld: retentionAmount,
      net_payable: netPayable,
    })
    .eq('id', invoiceId)
    .select()
    .single()

  if (invoiceError) throw invoiceError

  const { data: retentionRow, error: retentionError } = await supabase
    .from('retention_ledger')
    .insert({
      contract_id: contractId,
      project_id: projectId,
      invoice_id: invoiceId,
      retention_type: 'client',
      status: 'withheld',
      withheld_amount: retentionAmount,
      balance_amount: retentionAmount,
      created_by: postedBy,
    })
    .select()
    .single()

  if (retentionError) throw retentionError

  const { error: rpcError } = await supabase.rpc('post_retention_withheld_journal', {
    p_invoice_id: invoiceId,
    p_project_id: projectId,
    p_retention_amount: retentionAmount,
    p_posted_by: postedBy,
  })

  if (rpcError) throw rpcError

  await supabase.from('audit_log').insert({
    user_id: postedBy,
    action: 'UPDATE',
    table_name: 'invoices',
    record_id: invoiceId,
    old_value: JSON.stringify(invoiceBefore),
    new_value: JSON.stringify(invoiceUpdated),
  })

  await supabase.from('audit_log').insert({
    user_id: postedBy,
    action: 'INSERT',
    table_name: 'retention_ledger',
    record_id: retentionRow.id,
    old_value: null,
    new_value: JSON.stringify(retentionRow),
  })

  return retentionRow
}

export async function releaseClientRetention({ retentionLedgerId, projectId, releaseAmount, releaseInvoiceId, postedBy }) {
  const { data: beforeRow, error: fetchError } = await supabase
    .from('retention_ledger')
    .select('*')
    .eq('id', retentionLedgerId)
    .single()

  if (fetchError) throw fetchError
  if (!beforeRow) throw new Error('Retention ledger row not found')

  const { error: rpcError } = await supabase.rpc('post_retention_released_journal', {
    p_retention_ledger_id: retentionLedgerId,
    p_project_id: projectId,
    p_release_amount: releaseAmount,
    p_release_invoice_id: releaseInvoiceId,
    p_posted_by: postedBy,
  })

  if (rpcError) throw rpcError

  const afterRow = {
    ...beforeRow,
    status: 'fully_released',
    released_amount: releaseAmount,
    balance_amount: 0,
    release_date: new Date().toISOString().split('T')[0],
    release_invoice_id: releaseInvoiceId,
    updated_at: new Date().toISOString(),
  }

  await supabase.from('audit_log').insert({
    user_id: postedBy,
    action: 'UPDATE',
    table_name: 'retention_ledger',
    record_id: retentionLedgerId,
    old_value: JSON.stringify(beforeRow),
    new_value: JSON.stringify(afterRow),
  })

  return afterRow
}

export async function recordSubcontractorRetention({ subcontractorId, projectId, retentionAmount, postedBy }) {
  const { error: rpcError } = await supabase.rpc('post_subcontractor_retention_journal', {
    p_subcontractor_id: subcontractorId,
    p_project_id: projectId,
    p_retention_amount: retentionAmount,
    p_posted_by: postedBy,
  })

  if (rpcError) throw rpcError

  const { data: retentionRow, error: retentionError } = await supabase
    .from('retention_ledger')
    .insert({
      subcontractor_id: subcontractorId,
      project_id: projectId,
      retention_type: 'subcontractor',
      status: 'withheld',
      withheld_amount: retentionAmount,
      balance_amount: retentionAmount,
      created_by: postedBy,
    })
    .select()
    .single()

  if (retentionError) throw retentionError

  await supabase.from('audit_log').insert({
    user_id: postedBy,
    action: 'INSERT',
    table_name: 'retention_ledger',
    record_id: retentionRow.id,
    old_value: null,
    new_value: JSON.stringify(retentionRow),
  })

  return retentionRow
}

export async function getRetentionSummary(projectId) {
  let query = supabase.from('retention_ledger').select('retention_type, withheld_amount, released_amount, balance_amount')
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) throw error

  const summary = data?.reduce(
    (acc, row) => {
      const type = row.retention_type || 'client'
      const withheld = Number(row.withheld_amount || 0)
      const released = Number(row.released_amount || 0)
      const balance = Number(row.balance_amount || 0)

      if (type === 'subcontractor') {
        acc.subcontractorWithheld += withheld
        acc.subcontractorReleased += released
        acc.subcontractorBalance += balance
      } else {
        acc.clientWithheld += withheld
        acc.clientReleased += released
        acc.clientBalance += balance
      }

      return acc
    },
    { ...zeroSummary }
  )

  return summary
}

export async function getRetentionLedger(filters = {}) {
  let query = supabase
    .from('retention_ledger')
    .select(`*, project:projects(id,name), invoice:invoices(id,invoice_number,due_date), subcontractor:subcontractors(id,name)`)
    .order('created_at', { ascending: false })

  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.retentionType) query = query.eq('retention_type', filters.retentionType)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getRetentionLedgerById(retentionLedgerId) {
  const { data, error } = await supabase
    .from('retention_ledger')
    .select(`*, project:projects(id,name), invoice:invoices(id,invoice_number,due_date), subcontractor:subcontractors(id,name)`)
    .eq('id', retentionLedgerId)
    .single()

  if (error) throw error
  return data
}
