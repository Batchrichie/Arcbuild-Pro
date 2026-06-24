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

export async function getDefaultApproverId() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .in('role', ['ceo', 'director'])
    .order('role', { ascending: true })
    .limit(1)

  if (error) throw error
  if (!data?.length) {
    throw new Error('No approver (CEO/Director) profile found.')
  }
  return data[0].id
}

export async function createApprovalRequest({ entityType, entityId, submittedBy, assignedTo }) {
  const submitterId = await resolveProfileId(submittedBy)
  const approverId = assignedTo || (await getDefaultApproverId())

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      status: 'pending',
      submitted_by: submitterId,
      assigned_to: approverId,
    })
    .select('id, entity_type, entity_id, status, assigned_to, submitted_by')
    .single()

  if (error) throw error
  return data
}

export async function submitJournalForApproval(journalId, currentUserId) {
  const profileId = await resolveProfileId(currentUserId)
  const approverId = await getDefaultApproverId()

  const { data: rpcData, error: rpcError } = await supabase.rpc('submit_journal_for_approval', {
    journal_id_param: journalId,
    actor_uuid: profileId,
    assignee_uuid: approverId,
  })

  if (!rpcError && rpcData) {
    if (rpcData.success === false) throw new Error(parseDbError(null, rpcData))
    return rpcData
  }

  const { error: journalError } = await supabase
    .from('journal_entries')
    .update({ status: 'PENDING_APPROVAL' })
    .eq('id', journalId)
    .eq('status', 'DRAFT')

  if (journalError) throw new Error(parseDbError(journalError))

  const approval = await createApprovalRequest({
    entityType: 'journal',
    entityId: journalId,
    submittedBy: profileId,
    assignedTo: approverId,
  })

  return { success: true, approval_request_id: approval.id }
}

export async function approveRequest(requestId, currentUserId) {
  const profileId = await resolveProfileId(currentUserId)

  const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_approval_request', {
    request_id_param: requestId,
    actor_uuid: profileId,
    action_param: 'approve',
    rejection_reason_param: null,
  })

  if (!rpcError && rpcData) {
    if (rpcData.success === false) throw new Error(parseDbError(null, rpcData))
    return rpcData
  }

  const { data: request, error: fetchError } = await supabase
    .from('approval_requests')
    .select('id, entity_type, entity_id, assigned_to, status')
    .eq('id', requestId)
    .single()

  if (fetchError) throw fetchError
  if (request.assigned_to !== profileId) {
    throw new Error('Only the assigned approver can approve this request.')
  }
  if (request.status !== 'pending') {
    throw new Error('This approval request is no longer pending.')
  }

  const { error: requestError } = await supabase
    .from('approval_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: profileId })
    .eq('id', requestId)

  if (requestError) throw requestError

  if (request.entity_type === 'journal') {
    const { error: journalError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED', is_posted: true })
      .eq('id', request.entity_id)

    if (journalError) throw new Error(parseDbError(journalError))
  }

  return { success: true }
}

export async function rejectRequest(requestId, currentUserId, rejectionReason) {
  if (!rejectionReason?.trim()) {
    throw new Error('Rejection reason is required.')
  }

  const profileId = await resolveProfileId(currentUserId)

  const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_approval_request', {
    request_id_param: requestId,
    actor_uuid: profileId,
    action_param: 'reject',
    rejection_reason_param: rejectionReason.trim(),
  })

  if (!rpcError && rpcData) {
    if (rpcData.success === false) throw new Error(parseDbError(null, rpcData))
    return rpcData
  }

  const { data: request, error: fetchError } = await supabase
    .from('approval_requests')
    .select('id, entity_type, entity_id, assigned_to, status')
    .eq('id', requestId)
    .single()

  if (fetchError) throw fetchError
  if (request.assigned_to !== profileId) {
    throw new Error('Only the assigned approver can reject this request.')
  }
  if (request.status !== 'pending') {
    throw new Error('This approval request is no longer pending.')
  }

  const { error: requestError } = await supabase
    .from('approval_requests')
    .update({
      status: 'rejected',
      rejection_reason: rejectionReason.trim(),
      resolved_at: new Date().toISOString(),
      resolved_by: profileId,
    })
    .eq('id', requestId)

  if (requestError) throw requestError

  if (request.entity_type === 'journal') {
    const { error: journalError } = await supabase
      .from('journal_entries')
      .update({ status: 'DRAFT' })
      .eq('id', request.entity_id)

    if (journalError) throw new Error(parseDbError(journalError))
  }

  return { success: true }
}

export async function getPendingApprovalForJournal(journalId) {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('id, status, assigned_to, submitted_by, rejection_reason, created_at')
    .eq('entity_type', 'journal')
    .eq('entity_id', journalId)
    .eq('status', 'pending')
    .maybeSingle()

  if (error) throw error
  return data
}
