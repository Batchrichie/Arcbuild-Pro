import { supabase } from '../lib/supabase'
import { parseDbError } from '../lib/dbErrorMessage'

async function resolveProfileId(userId) {
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession()
    userId = session?.user?.id
  }
  if (!userId) throw new Error('Unable to resolve current user.')

  const { data: byId } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (byId?.id) return byId.id

  const { data: byAuth, error } = await supabase.from('profiles').select('id').eq('user_id', userId).single()
  if (error) throw error
  return byAuth.id
}

export async function getAccountingPeriods() {
  const { data, error } = await supabase
    .from('accounting_periods')
    .select('id, year, month, status, closed_at, closed_by, profiles!closed_by(full_name)')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function closeAccountingPeriod(periodId, currentUserId) {
  if (!periodId) throw new Error('Period ID is required.')

  const profileId = await resolveProfileId(currentUserId)

  const { data: rpcData, error: rpcError } = await supabase.rpc('close_accounting_period', {
    period_id_param: periodId,
    actor_uuid: profileId,
  })

  if (!rpcError && rpcData) {
    if (rpcData.success === false) {
      throw new Error(parseDbError(null, rpcData))
    }
    return rpcData
  }

  const { data, error } = await supabase
    .from('accounting_periods')
    .update({
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
      closed_by: profileId,
    })
    .eq('id', periodId)
    .eq('status', 'OPEN')
    .select('id, year, month, status, closed_at')
    .single()

  if (error) throw new Error(parseDbError(error))
  if (!data) throw new Error('Period could not be closed. It may already be closed or you lack permission.')
  return { success: true, period: data }
}
