import { supabase } from '../lib/supabase'

const ACCOUNT_FIELDS = [
  'account_name',
  'account_type',
  'description',
  'parent_code',
  'opening_balance',
  'status',
  'is_active',
]

const DB_FIELD_MAP = {
  account_name: 'account_name',
  account_type: 'account_type',
  description: 'description',
  parent_code: 'parent_code',
  opening_balance: 'opening_balance',
  status: 'status',
  is_active: 'is_active',
}

const OPENING_BALANCE_OFFSET_ACCOUNT = '3200'
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
    .select('id, account_code, account_name, account_type, description, parent_code, opening_balance, is_active, status, is_system, created_by, created_at, updated_at')
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
    .select('id, account_code, account_name, account_type, description, parent_code, opening_balance, is_active, status, is_system, created_by, created_at, updated_at')
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
    .eq('is_reversed', false)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

function getOpeningBalanceLines(account_code, account_name, account_type, opening_balance) {
  const amount = Number(opening_balance || 0)
  if (!amount || amount <= 0) return []

  const isDebitAccount = ['asset', 'expense'].includes(account_type)
  if (isDebitAccount) {
    return [
      {
        account_code,
        account_name,
        debit_amount: amount,
        credit_amount: 0,
        line_description: `Opening balance for ${account_code}`,
      },
      {
        account_code: OPENING_BALANCE_OFFSET_ACCOUNT,
        account_name: 'Opening Balances Equity',
        debit_amount: 0,
        credit_amount: amount,
        line_description: `Opening balance offset for ${account_code}`,
      },
    ]
  }

  return [
    {
      account_code: OPENING_BALANCE_OFFSET_ACCOUNT,
      account_name: 'Opening Balances Equity',
      debit_amount: amount,
      credit_amount: 0,
      line_description: `Opening balance offset for ${account_code}`,
    },
    {
      account_code,
      account_name,
      debit_amount: 0,
      credit_amount: amount,
      line_description: `Opening balance for ${account_code}`,
    },
  ]
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

  const insertPayload = {
    account_code: String(data.code ?? data.account_code),
    account_name: data.account_name,
    account_type: data.account_type,
    description: data.description,
    parent_code: data.parent_code || null,
    opening_balance: Number(data.opening_balance) || 0,
    status: data.status ?? 'Active',
    is_active: true,
    is_system: false,
    created_by: currentUserId,
  }

  const { data: created, error } = await supabase
    .from('chart_of_accounts')
    .insert(insertPayload)
    .select()
    .single()

  if (error) throw error

  if (Number(data.opening_balance || 0) > 0) {
    try {
      await postOpeningBalanceJournal(created, data.opening_balance, currentUserId)
    } catch (err) {
      await supabase.from('chart_of_accounts').delete().eq('id', created.id)
      throw err
    }
  }

  await supabase.from('audit_log').insert({
    user_id: currentUserId,
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
    const nonNameFields = Object.keys(data).filter((key) => key !== 'account_name')
    if (nonNameFields.length > 0) {
      throw new Error('System accounts may only have the account_name updated.')
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

  await supabase.from('audit_log').insert({
    user_id: currentUserId,
    action: 'UPDATE',
    table_name: 'chart_of_accounts',
    record_id: before.id,
    old_value: JSON.stringify(before),
    new_value: JSON.stringify(updated),
  })

  if (openingBalanceChanged || accountTypeChanged) {
    const adjustmentAmount = Number((data.opening_balance ?? before.opening_balance) || 0)
    await adjustOpeningBalanceJournal(updated, adjustmentAmount, currentUserId)
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
