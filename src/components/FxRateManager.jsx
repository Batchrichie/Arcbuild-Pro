import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLatestRates } from '../services/fxRatesService'

const ACTIVE_CODES = ['USD', 'EUR', 'GBP']
const FLAG_MAP = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧'
}



function FxRateManager() {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState('')

  const getRateCode = (rate) => {
    const rawCode = (rate.code || rate.currency_code || '').toString().toUpperCase()
    if (rawCode.length > 3 && rawCode.endsWith('GHS')) {
      return rawCode.slice(0, -3)
    }
    return rawCode
  }

  const getRateName = (rate) => {
    return rate.currency || rate.currency_name || getRateCode(rate)
  }

  const getRateValue = (rate) => {
    return typeof rate.median === 'number'
      ? rate.median
      : typeof rate.rate_to_ghs === 'number'
        ? rate.rate_to_ghs
        : typeof rate.rate === 'number'
          ? rate.rate
          : null
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatNumber = (value) => {
    return typeof value === 'number'
      ? value.toLocaleString('en-GB', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
      : '—'
  }

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
        setLastUpdated(formatDate(latestDate.toISOString()))
      } else {
        setLastUpdated('No rates loaded yet')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FX rates')
    } finally {
      setLoading(false)
    }
  }

  const refreshRates = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.functions.invoke('schedule-bog-fx')
      if (error) throw error
      await loadRates()
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh FX rates')
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRates()
  }, [])

  const uniqueRates = [...rates].reduce((map, rate) => {
    const code = getRateCode(rate)
    if (!code || map.has(code)) return map
    const value = getRateValue(rate)
    if (value == null) return map
    map.set(code, rate)
    return map
  }, new Map())

  const allRates = Array.from(uniqueRates.values()).sort((a, b) => getRateCode(a).localeCompare(getRateCode(b)))
  const activeRates = ACTIVE_CODES.map((code) => allRates.find((rate) => getRateCode(rate) === code)).filter(Boolean)
  const activeCodes = activeRates.map(getRateCode)

  const otherRates = allRates.filter((rate) => !activeCodes.includes(getRateCode(rate)))

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border border-slate-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading FX rates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-slate-50 dark:bg-slate-950 -mx-6 -my-6 px-6 py-6">
      <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-l-4 border-blue-600 dark:border-blue-500 p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.15em] font-medium text-slate-500 dark:text-slate-400">Exchange Rates · Live Bank of Ghana feed</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">FX Rates Dashboard</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Real-time foreign exchange rates with automatic daily updates. Powered by open.er-api.com.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Updated {lastUpdated}
            </div>
            <button
              type="button"
              onClick={refreshRates}
              disabled={loading}
              className="rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-400 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh Rates'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <span className="text-lg font-bold">⚠</span>
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {allRates.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
          <p className="text-sm font-medium">No FX rates available yet. Please click "Refresh Rates" or check back after the next scheduled update.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Primary Currencies</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">USD, EUR, and GBP exchange rates</p>
              </div>
              <p className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{activeRates.length} active</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeRates.map((rate) => {
                const code = getRateCode(rate)
                const colorMap = {
                  USD: { border: 'border-l-emerald-500 dark:border-l-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
                  EUR: { border: 'border-l-blue-500 dark:border-l-blue-400', text: 'text-blue-600 dark:text-blue-400' },
                  GBP: { border: 'border-l-violet-500 dark:border-l-violet-400', text: 'text-violet-600 dark:text-violet-400' },
                }
                const colors = colorMap[code] || { border: 'border-l-slate-300 dark:border-l-slate-600', text: 'text-slate-600 dark:text-slate-400' }
                return (
                  <div key={`${code}-${rate.rate_date}`} className={`rounded-lg border-l-4 ${colors.border} border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow-md`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">{FLAG_MAP[code] ?? ''} {code}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{getRateName(rate)}</p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">1 GHS to {code}</p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                        {formatNumber(getRateValue(rate))}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">All Currencies</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Complete list of supported exchange rates</p>
              </div>
              <p className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{otherRates.length} rates</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50">
                    <th className="px-6 py-3 font-semibold text-slate-700 dark:text-slate-300">Currency</th>
                    <th className="px-6 py-3 font-semibold text-slate-700 dark:text-slate-300">Code</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Rate to GHS</th>
                  </tr>
                </thead>
                <tbody>
                  {otherRates.map((rate, index) => (
                    <tr
                      key={`${getRateCode(rate)}-${rate.rate_date}`}
                      className={`border-b border-slate-200 transition-colors dark:border-slate-800 ${
                        index % 2 === 0 ? 'bg-white dark:bg-slate-950/20' : 'bg-slate-50 dark:bg-slate-950/50'
                      } hover:bg-slate-100 dark:hover:bg-slate-900`}
                    >
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-50">{getRateName(rate)}</td>
                      <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400">{getRateCode(rate)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(getRateValue(rate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <p className="font-medium">ℹ Data Source:</p>
        <p className="mt-1">Exchange rates are updated daily at 8:00 AM GMT. Rates reflect the latest Bank of Ghana interbank data via open.er-api.com.</p>
      </div>
    </div>
  )
}

export default FxRateManager

