import { supabase } from '../lib/supabase'

const GL_DEBTORS_COLUMNS = [
  'client_id',
  'client_name',
  'client_type',
  'email',
  'currency',
  'invoice_id',
  'division_id',
  'division_name',
  'project_id',
  'project_name',
  'transaction_date',
  'invoiced_amount',
  'wht_deducted',
  'net_receivable',
  'amount_received',
  'amount_outstanding',
  'days_overdue',
  'aging_bucket',
  'current_ghs',
  'overdue_1_30_ghs',
  'overdue_31_60_ghs',
  'overdue_61_90_ghs',
  'overdue_90_plus_ghs',
].join(',')

function applyDebtorFilters(query, filters = {}) {
  if (filters.clientId) query = query.eq('client_id', filters.clientId)
  if (filters.division) query = query.eq('division_name', filters.division)
  if (filters.from) query = query.gte('transaction_date', filters.from)
  if (filters.to) query = query.lte('transaction_date', filters.to)
  if (filters.currency) query = query.eq('currency', filters.currency)

  if (filters.status === 'outstanding') {
    query = query.gt('amount_outstanding', 0)
  } else if (filters.status === 'overdue') {
    query = query.gt('amount_outstanding', 0).gt('days_overdue', 0)
  }

  return query
}

export async function getGlDebtors(filters = {}, { limit = 500 } = {}) {
  let query = supabase
    .from('gl_debtors')
    .select(GL_DEBTORS_COLUMNS)
    .order('client_name', { ascending: true })
    .order('transaction_date', { ascending: true })
    .limit(limit)

  query = applyDebtorFilters(query, filters)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getGlDebtorsForClient(clientId, filters = {}) {
  if (!clientId) return []
  return getGlDebtors({ ...filters, clientId }, { limit: 200 })
}

export async function enrichDebtorRowsWithInvoiceMetadata(rows) {
  const invoiceIds = [...new Set((rows ?? []).map((row) => row.invoice_id).filter(Boolean))]
  if (!invoiceIds.length) return rows ?? []

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, due_date, status')
    .in('id', invoiceIds)

  if (error) throw error

  const invoiceMap = new Map((invoices ?? []).map((inv) => [inv.id, inv]))

  return (rows ?? []).map((row) => {
    const invoice = invoiceMap.get(row.invoice_id)
    return {
      ...row,
      invoice_number: invoice?.invoice_number ?? row.invoice_number ?? '—',
      due_date: invoice?.due_date ?? row.due_date ?? null,
      invoice_status: invoice?.status ?? row.invoice_status ?? null,
    }
  })
}

export function buildClientSummaryFromGlDebtors(rows) {
  const grouped = {}

  rows.forEach((row) => {
    const id = row.client_id
    if (!grouped[id]) {
      grouped[id] = {
        client_id: id,
        client_name: row.client_name,
        client_type: row.client_type,
        email: row.email,
        currency: row.currency || 'GHS',
        total_invoiced_ghs: 0,
        total_received_ghs: 0,
        total_outstanding_ghs: 0,
        total_wht_deducted_ghs: 0,
        current_ghs: 0,
        overdue_1_30_ghs: 0,
        overdue_31_60_ghs: 0,
        overdue_61_90_ghs: 0,
        overdue_90_plus_ghs: 0,
      }
    }

    const bucket = grouped[id]
    const outstanding = Number(row.amount_outstanding || 0)
    const overdue = Number(row.days_overdue || 0)

    bucket.total_invoiced_ghs += Number(row.invoiced_amount || 0)
    bucket.total_received_ghs += Number(row.amount_received || 0)
    bucket.total_outstanding_ghs += outstanding
    bucket.total_wht_deducted_ghs += Number(row.wht_deducted || 0)

    if (row.current_ghs != null || row.overdue_1_30_ghs != null) {
      bucket.current_ghs += Number(row.current_ghs || 0)
      bucket.overdue_1_30_ghs += Number(row.overdue_1_30_ghs || 0)
      bucket.overdue_31_60_ghs += Number(row.overdue_31_60_ghs || 0)
      bucket.overdue_61_90_ghs += Number(row.overdue_61_90_ghs || 0)
      bucket.overdue_90_plus_ghs += Number(row.overdue_90_plus_ghs || 0)
    } else if (outstanding > 0) {
      if (overdue === 0) bucket.current_ghs += outstanding
      else if (overdue <= 30) bucket.overdue_1_30_ghs += outstanding
      else if (overdue <= 60) bucket.overdue_31_60_ghs += outstanding
      else if (overdue <= 90) bucket.overdue_61_90_ghs += outstanding
      else bucket.overdue_90_plus_ghs += outstanding
    }
  })

  return Object.values(grouped).sort(
    (a, b) => Number(b.total_outstanding_ghs || 0) - Number(a.total_outstanding_ghs || 0)
  )
}

export async function exportGlDebtors(filters = {}) {
  const rows = await getGlDebtors(filters, { limit: 5000 })
  return enrichDebtorRowsWithInvoiceMetadata(rows)
}
