import { supabase } from '../lib/supabase'

export async function getGlIntegrityReport() {
  const { data, error } = await supabase.rpc('get_gl_integrity_report')
  if (error) throw error
  return data
}

export async function backfillMissingInvoiceJournals(actingUserId) {
  const { data, error } = await supabase.rpc('backfill_missing_invoice_journals', {
    acting_user_id: actingUserId,
  })
  if (error) throw error
  return data
}

export async function correctReversedExpenseAccount(accountCode, offsetAccount, actingUserId, reference) {
  const { data, error } = await supabase.rpc('correct_reversed_expense_account', {
    account_code_param: accountCode,
    offset_account_param: offsetAccount,
    acting_user_id: actingUserId,
    reference_param: reference ?? null,
  })
  if (error) throw error
  return data
}

export async function runGlIntegrityRepair(actingUserId) {
  const { data, error } = await supabase.rpc('run_gl_integrity_repair', {
    acting_user_id: actingUserId,
  })
  if (error) throw error
  return data
}
