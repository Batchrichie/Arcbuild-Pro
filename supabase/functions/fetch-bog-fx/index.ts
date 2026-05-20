import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function fetchBoGPage() {
  const res = await fetch('https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/')
  if (!res.ok) throw new Error('Failed to fetch BoG page: ' + res.status)
  return await res.text()
}

function parseRates(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc) throw new Error('Failed to parse HTML')

  const rows = Array.from(doc.querySelectorAll('table tbody tr'))
  const results: any[] = []

  for (const r of rows) {
    const tds = Array.from(r.querySelectorAll('td')).map(td => td.textContent?.trim() ?? '')
    if (tds.length < 6) continue

    // Expected columns: date | currency | code | buy | sell | median
    const [dateStr, currency, code, buyStr, sellStr, medianStr] = tds
    const rate_date = new Date(dateStr).toISOString().slice(0, 10)
    const buy = buyStr ? Number(buyStr.replace(/,/g, '')) : null
    const sell = sellStr ? Number(sellStr.replace(/,/g, '')) : null
    const median = medianStr ? Number(medianStr.replace(/,/g, '')) : null

    if (!code) continue

    results.push({ rate_date, currency, code, buy, sell, median })
  }

  return results
}

async function upsertRates(rates: any[]) {
  if (!rates.length) return { inserted: 0 }

  const { data, error } = await supabase
    .from('fx_rates')
    .upsert(rates.map(r => ({
      rate_date: r.rate_date,
      currency: r.currency,
      code: r.code,
      buy: r.buy,
      sell: r.sell,
      median: r.median,
      source: 'BOG',
    })), { onConflict: ['rate_date', 'code'] })

  if (error) throw error
  return { inserted: (data ?? []).length }
}

Deno.serve(async () => {
  try {
    const html = await fetchBoGPage()
    const rates = parseRates(html)
    const res = await upsertRates(rates)
    return new Response(JSON.stringify({ success: true, count: rates.length, result: res }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('fetch-bog-fx error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
