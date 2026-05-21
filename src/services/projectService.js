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

const PROJECT_FIELDS = [
  'name',
  'client_id',
  'division_id',
  'contract_value',
  'start_date',
  'end_date',
  'status',
  'completion_method',
  'budget_cost',
]

const UPDATE_FIELDS = [...PROJECT_FIELDS, 'actual_cost_to_date', 'recognition_notes']

const sanitizePayload = (payload, allowedFields) => {
  return Object.keys(payload).reduce((result, key) => {
    if (allowedFields.includes(key)) {
      result[key] = payload[key]
    }
    return result
  }, {})
}

export async function getProjects(filters = {}) {
  let query = supabase
    .from('projects')
    .select(`
      id,
      name,
      client_id,
      division_id,
      contract_value,
      start_date,
      end_date,
      status,
      completion_method,
      budget_cost,
      actual_cost_to_date,
      recognition_notes,
      clients(name),
      divisions(name)
    `)
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.division_id) {
    query = query.eq('division_id', filters.division_id)
  }
  if (filters.client_id) {
    query = query.eq('client_id', filters.client_id)
  }
  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((project) => ({
    ...project,
    client_name: project.clients?.name ?? null,
    division_name: project.divisions?.name ?? null,
  }))
}

export async function getProjectById(id) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      client_id,
      division_id,
      contract_value,
      start_date,
      end_date,
      status,
      completion_method,
      budget_cost,
      actual_cost_to_date,
      recognition_notes,
      clients(name),
      divisions(name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    client_name: data.clients?.name ?? null,
    division_name: data.divisions?.name ?? null,
  }
}

export async function createProject(data, currentUserId) {
  const insertPayload = sanitizePayload(data, PROJECT_FIELDS)

  const { data: created, error } = await supabase
    .from('projects')
    .insert(insertPayload)
    .select()
    .single()

  if (error) throw error

  const auditUserId = await resolveProfileId(currentUserId)
  await supabase.from('audit_log').insert({
    user_id: auditUserId,
    action: 'INSERT',
    table_name: 'projects',
    record_id: created.id,
    old_value: null,
    new_value: JSON.stringify(created),
  })

  return created
}

export async function updateProject(id, data, currentUserId) {
  const { data: before, error: fetchError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const updatePayload = sanitizePayload(data, UPDATE_FIELDS)

  const { data: updated, error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const auditUserId = await resolveProfileId(currentUserId)
  await supabase.from('audit_log').insert({
    user_id: auditUserId,
    action: 'UPDATE',
    table_name: 'projects',
    record_id: id,
    old_value: JSON.stringify(before),
    new_value: JSON.stringify(updated),
  })

  return updated
}

export function getProjectStatus() {
  return ['active', 'on_hold', 'completed', 'cancelled']
}
