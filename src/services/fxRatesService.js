import { supabase } from '../lib/supabase'

export async function getLatestRates() {
  // Get the most recent rate_date
  const { data: latest, error: latestError } = await supabase
    .from('fx_rates')
    .select('rate_date')
    .order('rate_date', { ascending: false })
    .limit(1)

  if (latestError) throw latestError
  if (!latest || latest.length === 0) return []

  const rateDate = latest[0].rate_date

  const { data, error } = await supabase
    .from('fx_rates')
    .select('*')
    .eq('rate_date', rateDate)

  if (error) throw error
  return data ?? []
}

export async function getRatesByDate(dateStr) {
  const { data, error } = await supabase
    .from('fx_rates')
    .select('*')
    .eq('rate_date', dateStr)

  if (error) throw error
  return data ?? []
}
