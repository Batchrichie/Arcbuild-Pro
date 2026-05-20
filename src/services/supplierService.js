import { supabase } from '../lib/supabase'

export async function getSuppliers(filters = {}) {
  let query = supabase
    .from('suppliers')
    .select('id, name, supplier_type, tin, wht_applicable, wht_rate, contact_person, contact_phone, contact_email, address, region, country, bank_name, bank_account_no, bank_branch, currency, payment_terms, vat_registered, vat_number, credit_limit, status, notes, created_at, updated_at')
    .order('name', { ascending: true })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) query = query.ilike('name', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getSupplierById(id) {
  const { data, error } = await supabase
    .from('suppliers')
    .select(`
      *,
      project_costs (
        id, project_id, cost_type, description, amount, amount_ghs, currency, date_incurred, created_at
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createSupplier(supplierData, currentUserId) {
  const insertPayload = { ...supplierData, created_by: currentUserId }

  const { data, error } = await supabase
    .from('suppliers')
    .insert(insertPayload)
    .select()
    .single()

  if (error) throw error

  await supabase.from('audit_log').insert({
    user_id: currentUserId,
    action: 'INSERT',
    table_name: 'suppliers',
    record_id: data.id,
    old_value: null,
    new_value: JSON.stringify(data),
  })

  return data
}

export async function updateSupplier(id, supplierData, currentUserId) {
  const { data: before, error: fetchError } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const updatePayload = { ...supplierData, updated_at: new Date().toISOString() }

  const { data, error } = await supabase
    .from('suppliers')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await supabase.from('audit_log').insert({
    user_id: currentUserId,
    action: 'UPDATE',
    table_name: 'suppliers',
    record_id: id,
    old_value: JSON.stringify(before),
    new_value: JSON.stringify(data),
  })

  return data
}

export async function getSupplierAgeing(id) {
  const now = new Date()

  const { data, error } = await supabase
    .from('project_costs')
    .select('id, description, amount, date_incurred')
    .eq('supplier_id', id)

  if (error) throw error

  const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 }

  for (const cost of data ?? []) {
    const due = new Date(cost.date_incurred)
    const days = Math.floor((now - due) / (1000 * 60 * 60 * 24))
    const amount = Number(cost.amount ?? 0)

    if (days <= 0)       buckets.current      += amount
    else if (days <= 30) buckets.days_1_30    += amount
    else if (days <= 60) buckets.days_31_60   += amount
    else if (days <= 90) buckets.days_61_90   += amount
    else                 buckets.days_90_plus  += amount
  }

  return buckets
}

export async function getSupplierWHTSummary(id, year) {
  const { data, error } = await supabase
    .from('project_costs')
    .select('id, description, amount, date_incurred')
    .eq('supplier_id', id)
    .gte('date_incurred', `${year}-01-01`)
    .lte('date_incurred', `${year}-12-31`)

  if (error) throw error

  const totalPayments = (data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  const totalWHT      = 0

  return { year, totalPayments, totalWHT, transactions: data ?? [] }
}
