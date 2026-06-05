import { supabase } from '../lib/supabase'

export async function createLease(leaseData) {
  const { data, error } = await supabase
    .from('leases')
    .insert(leaseData)
    .select()
    .single()

  if (error) throw error

  const { error: scheduleError } = await supabase.rpc('calculate_lease_schedule', {
    p_lease_id: data.id,
  })

  if (scheduleError) throw scheduleError

  return data
}

export async function getLeaseById(leaseId) {
  const { data, error } = await supabase
    .from('leases')
    .select('*')
    .eq('id', leaseId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getLeaseSchedule(leaseId) {
  const { data, error } = await supabase
    .from('lease_schedules')
    .select('*')
    .eq('lease_id', leaseId)
    .order('period_number', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getLeaseRollForward(projectId) {
  const { data, error } = await supabase
    .from('leases')
    .select(
      'id, project_id, status, rou_asset_value, lease_liability_opening, outstanding_liability, lease_term_months, lease_commencement_date, payment_amount, payment_frequency, discount_rate'
    )
    .eq('project_id', projectId)
    .order('lease_commencement_date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function postMonthlyLeaseEntries({ month, year }) {
  const start = new Date(year, Number(month) - 1, 1).toISOString().split('T')[0]
  const end = new Date(year, Number(month), 1).toISOString().split('T')[0]

  const { data: schedules, error: schedulesError } = await supabase
    .from('lease_schedules')
    .select('lease_id, period_number')
    .eq('posted', false)
    .gte('period_date', start)
    .lt('period_date', end)
    .order('period_date', { ascending: true })

  if (schedulesError) throw schedulesError

  const results = []
  for (const schedule of schedules || []) {
    const { data, error } = await supabase.rpc('post_lease_journal_entry', {
      p_lease_id: schedule.lease_id,
      p_period: schedule.period_number,
    })

    if (error) throw error
    results.push(data)
  }

  return results
}
