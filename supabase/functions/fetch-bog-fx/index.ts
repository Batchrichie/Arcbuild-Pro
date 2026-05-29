import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseHTML } from 'npm:linkedom@0.18.5'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function fetchBoGPage(): Promise<string> {
  const res = await fetch(
    'https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FX-fetcher/1.0)',
        'Accept': 'text/html',
      },
    }
  )
  if (!res.ok) throw new Error(`Failed to fetch BoG page: ${res.status}`)
  return await res.text()
}

export function parseRates(html: string) {
  const { document } = parseHTML(html)
  if (!document) throw new Error('Failed to parse HTML')

  const rows = Array.from(document.querySelectorAll('table tbody tr'))
  const results: {
    rate_date: string
    currency: string
    currency_code: string
    buy: number | null
    sell: number | null
    median: number | null
  }[] = []

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td')).map(
      (td) => td.textContent?.trim() ?? ''
    )
    if (cells.length < 6) continue

    const [dateStr, currency, code, buyStr, sellStr, medianStr] = cells
    if (!code) continue

    const dateValue = new Date(dateStr)
    if (Number.isNaN(dateValue.getTime())) continue

    const rate_date = dateValue.toISOString().slice(0, 10)
    const buy = buyStr ? Number(buyStr.replace(/,/g, '')) : null
    const sell = sellStr ? Number(sellStr.replace(/,/g, '')) : null
    const median = medianStr ? Number(medianStr.replace(/,/g, '')) : null
    const currencyCode = code.split('/')[0].trim().toUpperCase()

    if (!currencyCode || currencyCode === 'GHS') continue

    results.push({
      rate_date,
      currency,
      currency_code: currencyCode,
      buy,
      sell,
      median,
    })
  }

  return results
}

async function upsertRates(rates: ReturnType<typeof parseRates>) {
  if (!rates.length) return { inserted: 0 }

  const mapped = rates.map((r) => ({
    currency_code: r.currency_code,
    rate_to_ghs: r.median ?? r.buy ?? r.sell,
    rate_date: r.rate_date,
    source: 'bank_of_ghana',
  }))

  // onConflict must be a comma-separated string, not an array
  const { data, error } = await supabase
    .from('exchange_rates')
    .upsert(mapped, { onConflict: 'currency_code,rate_date' })
    .select()

  if (error) throw error
  return { inserted: (data ?? []).length }
}

Deno.serve(async (req) => {
  try {
    let html: string

    if (req.method === 'GET') {
      html = await fetchBoGPage()
    } else if (req.method === 'POST') {
      html = await req.text()
      if (!html.trim()) {
        html = await fetchBoGPage()
      }
    } else {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, POST' },
      })
    }

    const rates = parseRates(html)

    if (rates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No rates parsed — check HTML structure' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = await upsertRates(rates)

    return new Response(
      JSON.stringify({ success: true, count: rates.length, result }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('fetch-bog-fx error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})