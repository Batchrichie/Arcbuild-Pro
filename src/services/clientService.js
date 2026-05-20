import { supabase } from '../lib/supabase'

const CLIENT_FIELDS = [
  'name',
  'client_type',
  'tin',
  'contact_person',
  'contact_phone',
  'contact_email',
  'credit_limit',
  'payment_terms',
  'currency',
  'vat_registered',
  'vat_number',
  'address',
  'region',
  'country',
  'status',
  'notes',
  'applies_vat',
  'applies_nhil',
  'applies_getfund',
  'applies_wht',
  'wht_rate',
]

const sanitizeClientPayload = (payload) => {
  return Object.keys(payload).reduce((result, key) => {
    if (CLIENT_FIELDS.includes(key)) {
      result[key] = payload[key]
    }
    return result
  }, {})
}

export async function getClients(filters = {}) {
  let query = supabase
    .from('clients')
    .select('id, name, client_type, tin, contact_person, contact_phone, contact_email, credit_limit, payment_terms, currency, vat_registered, vat_number, address, region, country, status, notes, applies_vat, applies_nhil, applies_getfund, applies_wht, wht_rate, created_at, updated_at')
    .order('name', { ascending: true })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) query = query.ilike('name', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getClientById(id) {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      invoices (
        id, invoice_number, status, gross_total, expected_receipt_ghs,
        currency, created_at, due_date, payment_date
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createClient(clientData, currentUserId) {
  const insertPayload = {
    ...sanitizeClientPayload(clientData),
    created_by: currentUserId,
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(insertPayload)
    .select()
    .single()

  if (error) throw error

  await supabase.from('audit_log').insert({
    user_id: currentUserId,
    action: 'INSERT',
    table_name: 'clients',
    record_id: data.id,
    old_value: null,
    new_value: JSON.stringify(data),
  })

  return data
}

export async function updateClient(id, clientData, currentUserId) {
  const { data: before, error: fetchError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const updatePayload = {
    ...sanitizeClientPayload(clientData),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('clients')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await supabase.from('audit_log').insert({
    user_id: currentUserId,
    action: 'UPDATE',
    table_name: 'clients',
    record_id: id,
    old_value: JSON.stringify(before),
    new_value: JSON.stringify(data),
  })

  return data
}

export async function getClientAgeing(id) {
  const now = new Date()

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, due_date, expected_receipt_ghs, status')
    .eq('client_id', id)
    .in('status', ['sent', 'approved'])

  if (error) throw error

  const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 }

  for (const inv of data ?? []) {
    const due = new Date(inv.due_date)
    const days = Math.floor((now - due) / (1000 * 60 * 60 * 24))
    const amount = Number(inv.expected_receipt_ghs ?? 0)

    if (days <= 0)       buckets.current     += amount
    else if (days <= 30) buckets.days_1_30   += amount
    else if (days <= 60) buckets.days_31_60  += amount
    else if (days <= 90) buckets.days_61_90  += amount
    else                 buckets.days_90_plus += amount
  }

  return buckets
}
