const API_URL = 'https://open.er-api.com/v6/latest/GHS'
const ALLOWED_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'ZAR', 'CNY']

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, POST' },
    })
  }

  try {
    const apiResponse = await fetch(API_URL)
    if (!apiResponse.ok) {
      throw new Error(`Failed to fetch FX API: ${apiResponse.status} ${apiResponse.statusText}`)
    }

    const apiData = await apiResponse.json()
    const rates = apiData?.rates
    if (!rates || typeof rates !== 'object') {
      throw new Error('FX API returned invalid data')
    }

    const today = new Date().toISOString().slice(0, 10)
    const processed = []

    for (const currencyCode of Object.keys(rates)) {
      const upperCode = currencyCode.toUpperCase()
      if (!ALLOWED_CURRENCIES.includes(upperCode)) continue
      const rateValue = Number(rates[currencyCode])
      if (!Number.isFinite(rateValue) || rateValue === 0) continue
      processed.push({
        currency_code: upperCode,
        rate_to_ghs: 1 / rateValue,
        rate_date: today,
        source: 'open_exchange_rates',
      })
    }

    if (processed.length === 0) {
      throw new Error('No supported FX rates were found in API response')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2')
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { error } = await supabase
      .from('exchange_rates')
      .upsert(processed, { onConflict: 'currency_code,rate_date' })

    if (error) {
      throw new Error(error.message)
    }

    return new Response(JSON.stringify({ success: true, count: processed.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('schedule-bog-fx:', message)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
