import { supabase } from '../lib/supabase'

async function resolveProfileId(userId) {
  if (userId) {
    const { data: profileById, error: profileByIdError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (profileByIdError) throw profileByIdError
    if (profileById) return profileById.id

    const { data: profileByAuthUser, error: profileByAuthUserError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (profileByAuthUserError) throw profileByAuthUserError
    return profileByAuthUser?.id
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) throw sessionError
  if (!session?.user?.id) throw new Error('Unable to resolve current user profile ID.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (profileError) throw profileError
  if (!profile) throw new Error('No profile found for current user.')

  return profile.id
}

const ACCOUNT_FIELDS = [
  'account_name',
  'account_type',
  'description',
  'parent_code',
  'opening_balance',
  'status',
  'is_active',
  'financial_statement',
  'element',
  'sub_element',
  'nature',
  'is_contra',
  'is_payment_account',
  'payment_method_type',
]

const DB_FIELD_MAP = {
  account_name: 'account_name',
  account_type: 'account_type',
  description: 'description',
  parent_code: 'parent_code',
  opening_balance: 'opening_balance',
  status: 'status',
  is_active: 'is_active',
  financial_statement: 'financial_statement',
  element: 'element',
  sub_element: 'sub_element',
  nature: 'nature',
  is_contra: 'is_contra',
  is_payment_account: 'is_payment_account',
  payment_method_type: 'payment_method_type',
}

const OPENING_BALANCE_SOURCE_TYPE = 'opening_balance'
const OPENING_BALANCE_ENTRY_DATE = import.meta.env.VITE_OPENING_BALANCE_ENTRY_DATE || new Date(Date.now() - 86400000).toISOString().slice(0, 10)

const sanitizeAccountPayload = (payload) => {
  return Object.keys(payload).reduce((result, key) => {
    if (!ACCOUNT_FIELDS.includes(key)) return result
    const mappedKey = DB_FIELD_MAP[key] ?? key
    result[mappedKey] = payload[key]
    return result
  }, {})
}

const mapAccountRow = (account) => {
  if (!account) return account
  return {
    ...account,
    name: account.account_name ?? account.name,
    type: account.account_type ?? account.type,
    status: account.status ?? (account.is_active === false ? 'Inactive' : 'Active'),
  }
}

export async function getAccounts(filters = {}) {
  let query = supabase
    .from('chart_of_accounts')
    .select('id, account_code, account_name, account_type, description, parent_code, opening_balance, financial_statement, element, sub_element, nature, is_contra, is_payment_account, payment_method_type, is_active, status, is_system, created_by, created_at, updated_at')
    .order('account_code', { ascending: true })

  if (filters.account_type) query = query.eq('account_type', filters.account_type)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) query = query.or(`account_code.ilike.%${filters.search}%,account_name.ilike.%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(mapAccountRow)
}

export async function getAccountByCode(code) {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, account_code, account_name, account_type, description, parent_code, opening_balance, financial_statement, element, sub_element, nature, is_contra, is_payment_account, payment_method_type, is_active, status, is_system, created_by, created_at, updated_at')
    .eq('account_code', code)
    .maybeSingle()

  if (error) throw error
  return mapAccountRow(data ?? null)
}

async function getOpeningBalanceJournalId(accountId) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('source_type', OPENING_BALANCE_SOURCE_TYPE)
    .eq('source_id', accountId)
    .eq('status', 'POSTED')
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

export async function postOpeningBalanceJournal(account, opening_balance, currentUserId) {
  if (!account?.id) throw new Error('Account ID is required to post opening balance.')

  const existingJournalId = await getOpeningBalanceJournalId(account.id)
  if (existingJournalId) {
    throw new Error('Opening balance journal already exists for this account.')
  }

  const amount = Number(opening_balance || 0)
  if (!amount || amount <= 0) return null

  const { data, error } = await supabase.rpc('post_opening_balance_journal', {
    account_code_param: account.account_code,
    account_name_param: account.account_name,
    account_type_param: account.account_type,
    opening_balance_param: amount,
    entry_date_param: OPENING_BALANCE_ENTRY_DATE,
    actor_uuid: currentUserId,
    source_id_param: account.id,
  })

  if (error) throw error
  if (!data?.success) throw new Error(data?.error || 'Opening balance journal posting failed.')

  return data.journal_entry_id
}

export async function reverseOpeningBalanceJournal(journalId, currentUserId) {
  if (!journalId) return null

  const { data, error } = await supabase.rpc('reverse_journal_entry', {
    journal_id_param: journalId,
    reversal_date_param: OPENING_BALANCE_ENTRY_DATE,
    reason_param: 'Opening balance adjustment',
    actor_uuid: currentUserId,
  })

  if (error) throw error
  if (!data?.success) throw new Error(data?.error || 'Failed to reverse opening balance journal.')

  return data.reversal_journal_id
}

export async function adjustOpeningBalanceJournal(account, newBalance, currentUserId) {
  if (!account?.id) return null

  const existingJournalId = await getOpeningBalanceJournalId(account.id)
  const amount = Number(newBalance || 0)

  if (existingJournalId) {
    await reverseOpeningBalanceJournal(existingJournalId, currentUserId)
  }

  if (amount > 0) {
    return postOpeningBalanceJournal(account, amount, currentUserId)
  }

  return null
}

function validateAccountCode(code) {
  const parsed = Number(code)
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 7999) {
    throw new Error('Account code must be an integer between 1000 and 7999.')
  }
}

export async function createAccount(data, currentUserId) {
  if (!data?.code && !data?.account_code) {
    throw new Error('Account code is required.')
  }

  validateAccountCode(data.code ?? data.account_code)

  const { data: existing, error: existingError } = await supabase
    .from('chart_of_accounts')
    .select('account_code')
    .eq('account_code', data.code ?? data.account_code)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    throw new Error(`Account code ${data.code ?? data.account_code} already exists.`)
  }

  const auditUserId = await resolveProfileId(currentUserId)
  const insertPayload = {
    account_code: String(data.code ?? data.account_code),
    account_name: data.account_name,
    account_type: data.account_type,
    description: data.description,
    parent_code: data.parent_code || null,
    opening_balance: Number(data.opening_balance) || 0,
    financial_statement: data.financial_statement ?? null,
    element: data.element ?? null,
    sub_element: data.sub_element ?? null,
    nature: data.nature ?? null,
    is_contra: Boolean(data.is_contra),
    is_payment_account: Boolean(data.is_payment_account),
    payment_method_type: data.payment_method_type ?? null,
    status: data.status ?? 'Active',
    is_active: true,
    is_system: false,
    created_by: auditUserId,
  }

  const { data: created, error } = await supabase
    .from('chart_of_accounts')
    .insert(insertPayload)
    .select()
    .single()

  if (error) throw error

  if (Number(data.opening_balance || 0) > 0) {
    try {
      await postOpeningBalanceJournal(created, data.opening_balance, auditUserId)
    } catch (err) {
      await supabase.from('chart_of_accounts').delete().eq('id', created.id)
      throw err
    }
  }

  await supabase.from('audit_log').insert({
    user_id: auditUserId,
    action: 'INSERT',
    table_name: 'chart_of_accounts',
    record_id: created.id,
    old_value: null,
    new_value: JSON.stringify(created),
  })

  return created
}

export async function updateAccount(code, data, currentUserId) {
  if (!code) {
    throw new Error('Account code is required.')
  }

  const { data: before, error: fetchError } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('account_code', code)
    .single()

  if (fetchError) throw fetchError
  if (!before) {
    throw new Error(`Account with code ${code} not found.`)
  }

  if ('account_code' in data && String(data.account_code) !== String(code)) {
    throw new Error('Account code cannot be updated.')
  }

  if (before.is_system) {
    const allowedSystemFields = [
      'account_name',
      'financial_statement',
      'element',
      'sub_element',
      'nature',
      'is_contra',
      'is_payment_account',
      'payment_method_type',
    ]
    const invalidSystemFields = Object.keys(data).filter((key) => !allowedSystemFields.includes(key))
    if (invalidSystemFields.length > 0) {
      throw new Error('System accounts may only have metadata fields updated.')
    }
  }

  const openingBalanceChanged = 'opening_balance' in data && Number(data.opening_balance || 0) !== Number(before.opening_balance || 0)
  const accountTypeChanged = 'account_type' in data && data.account_type !== before.account_type

  const updatePayload = sanitizeAccountPayload(data)
  if (Object.keys(updatePayload).length === 0) {
    throw new Error('No valid fields provided for update.')
  }

  const { data: updated, error } = await supabase
    .from('chart_of_accounts')
    .update(updatePayload)
    .eq('account_code', code)
    .select()
    .single()

  if (error) throw error

  const auditUserId = await resolveProfileId(currentUserId)
  await supabase.from('audit_log').insert({
    user_id: auditUserId,
    action: 'UPDATE',
    table_name: 'chart_of_accounts',
    record_id: before.id,
    old_value: JSON.stringify(before),
    new_value: JSON.stringify(updated),
  })

  if (openingBalanceChanged || accountTypeChanged) {
    const adjustmentAmount = Number((data.opening_balance ?? before.opening_balance) || 0)
    await adjustOpeningBalanceJournal(updated, adjustmentAmount, auditUserId)
  }

  return updated
}

export function getAccountCategories() {
  return ['asset', 'liability', 'equity', 'revenue', 'expense']
}

export async function getAccountsByCategory() {
  const accounts = await getAccounts()
  return accounts.reduce((grouped, account) => {
    const category = account.account_type || 'uncategorized'
    if (!grouped[category]) grouped[category] = []
    grouped[category].push(account)
    return grouped
  }, {})
}

export async function getPaymentAccounts() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('account_code, account_name, account_type, payment_method_type, nature')
    .eq('is_payment_account', true)
    .eq('is_active', true)
    .eq('status', 'Active')
    .order('payment_method_type', { ascending: true })
    .order('account_code', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getAccountsByStatement(statementType) {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('account_code, account_name, opening_balance, financial_statement, element, sub_element, nature, is_contra, is_payment_account, payment_method_type')
    .eq('financial_statement', statementType)
    .eq('is_active', true)
    .eq('status', 'Active')
    .order('account_code', { ascending: true })

  if (error) throw error
  return data ?? []
}
