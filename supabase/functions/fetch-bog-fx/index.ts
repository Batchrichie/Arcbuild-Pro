import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseHTML } from 'npm:linkedom@0.18.5'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function toNum(s: string): number | null {
  const n = Number(s.replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

export function parseRates(html: string) {
  const { document } = parseHTML(html)
  const rows = Array.from(document.querySelectorAll('table tbody tr'))
  const results: {
    rate_date: string
    currency: string
    currency_code: string
    buy: number | null
    sell: number | null
    median: number | null
    rate_to_ghs: number
    source: string
  }[] = []

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() ?? '')
    if (cells.length < 6) continue

    const [dateStr, currency, code, buyStr, sellStr, medianStr] = cells
    if (!code) continue

    const dateValue = new Date(dateStr)
    if (Number.isNaN(dateValue.getTime())) continue

    const rate_date = dateValue.toISOString().slice(0, 10)
    const buy = buyStr ? toNum(buyStr) : null
    const sell = sellStr ? toNum(sellStr) : null
    const median = medianStr ? toNum(medianStr) : null
    const rate_to_ghs = median ?? buy ?? sell
    const currencyCode = code.split('/')[0].trim().toUpperCase()

    if (!currencyCode || currencyCode === 'GHS' || rate_to_ghs === null) continue

    results.push({
      rate_date,
      currency,
      currency_code: currencyCode,
      buy,
      sell,
      median,
      rate_to_ghs,
      source: 'bank_of_ghana',
    })
  }

  return results
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  try {
    const html = await req.text()
    if (!html.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Empty body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const rates = parseRates(html)
    if (rates.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No rates parsed' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { error } = await supabase
      .from('exchange_rates')
      .upsert(rates, { onConflict: 'currency_code,rate_date' })

    if (error) throw new Error(error.message)

    return new Response(JSON.stringify({ success: true, count: rates.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('fetch-bog-fx:', message)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})