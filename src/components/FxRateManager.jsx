import { useEffect, useState } from 'react'
import { getLatestRates } from '../services/fxRatesService'

export default function FxRateManager() {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState('')

  const loadRates = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getLatestRates()
      setRates(data || [])

      if (data && data.length > 0) {
        const latestDate = data.reduce((max, item) => {
          const d = new Date(item.rate_date)
          return d > max ? d : max
        }, new Date(0))
        setLastUpdated(latestDate.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }))
      } else {
        setLastUpdated('No rates loaded yet')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FX rates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRates()
  }, [])

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const sortedRates = [...rates].sort((a, b) => {
    const aCode = (a.currency_code || a.code || '').toString()
    const bCode = (b.currency_code || b.code || '').toString()
    return aCode.localeCompare(bCode)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border border-teal-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading FX rates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Latest FX rates for invoices</h2>
          <p className="text-sm text-slate-400">Live rates read from the canonical exchange_rates source used by invoice creation.</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
          Last updated: <span className="font-semibold text-white">{lastUpdated}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.1)] p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl">❌</span>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        </div>
      )}

      {sortedRates.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-[rgba(255,255,255,0.03)] p-8 text-center text-slate-400">
          No FX rates available yet. Please run the Bank of Ghana sync function or check back after the next scheduled update.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Buy</th>
                <th className="px-4 py-3">Sell</th>
                <th className="px-4 py-3">Median</th>
              </tr>
            </thead>
            <tbody>
              {sortedRates.map((rate) => (
                <tr key={`${rate.code}-${rate.rate_date}`} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{rate.currency_code || rate.currency || rate.code}</td>
                  <td className="px-4 py-3 text-slate-300">{rate.currency_code || rate.code}</td>
                  <td className="px-4 py-3 text-slate-200">{rate.buy != null ? rate.buy.toFixed(4) : '—'}</td>
                  <td className="px-4 py-3 text-slate-200">{rate.sell != null ? rate.sell.toFixed(4) : '—'}</td>
                  <td className="px-4 py-3 text-slate-200">{rate.median != null ? rate.median.toFixed(4) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-blue-400/30 bg-[rgba(56,138,221,0.1)] p-4 backdrop-blur-sm">
        <p className="text-sm text-blue-200">
          Exchange rates are sourced from the Bank of Ghana daily interbank feed and reflected here for the most recent available date.
        </p>
      </div>
    </div>
  )
}
