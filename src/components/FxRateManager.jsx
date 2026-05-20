import { useEffect, useState } from 'react'
import { getLatestRates } from '../services/fxRatesService'

const ACTIVE_CODES = ['USD', 'EUR', 'GBP']
const FLAG_MAP = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧'
}

const CARD_STYLES = {
  USD: 'border-t-4 border-emerald-400/90 bg-white text-slate-900 shadow-sm shadow-slate-200 dark:border-emerald-500 dark:bg-slate-900/95 dark:text-white dark:shadow-slate-950/40',
  EUR: 'border-t-4 border-sky-500/90 bg-white text-slate-900 shadow-sm shadow-slate-200 dark:border-sky-500 dark:bg-slate-900/95 dark:text-white dark:shadow-slate-950/40',
  GBP: 'border-t-4 border-violet-500/90 bg-white text-slate-900 shadow-sm shadow-slate-200 dark:border-violet-500 dark:bg-slate-900/95 dark:text-white dark:shadow-slate-950/40',
  default: 'border-t-4 border-slate-300/70 bg-white text-slate-900 shadow-sm shadow-slate-200 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white dark:shadow-slate-950/40'
}

export default function FxRateManager() {
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
    return typeof rate.median === 'number' ? rate.median : null
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
    <div className="space-y-6">
      <div className="rounded-4xl overflow-hidden border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40 dark:border-slate-800/70 dark:bg-slate-950/95 dark:shadow-lg dark:shadow-slate-950/40">
        <div className="border-l-4 border-cyan-400/70 p-8 sm:p-10">
          <p className="text-sm uppercase tracking-[0.32em] text-slate-500 dark:text-slate-300">Exchange Rates · Live Bank of Ghana feed</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">FX Rates Dashboard</h2>
          <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">
            See the latest interbank rates with bold currency platelets and a premium market dashboard layout.
          </p>
          <div className="mt-6 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/50 dark:bg-slate-900/80 dark:text-cyan-200 dark:shadow-cyan-500/10">
            <span className="mr-2 inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(45,212,191,0.35)]"></span>
            Updated {lastUpdated}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-50/80 p-4 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">❌</span>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {allRates.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/20 bg-slate-50/90 p-8 text-center text-slate-500 dark:border-slate-800/50 dark:bg-slate-950/70 dark:text-slate-400">
          No FX rates available yet. Please run the Bank of Ghana sync function or check back after the next scheduled update.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Active currencies</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">USD, EUR and GBP are shown as compact active currency platelets.</p>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{activeRates.length} active rates</p>
            </div>
            <div className="flex flex-wrap gap-4">
              {activeRates.map((rate) => {
                const code = getRateCode(rate)
                const accentText = code === 'USD'
                  ? 'text-emerald-900 dark:text-white'
                  : code === 'EUR'
                    ? 'text-sky-900 dark:text-white'
                    : code === 'GBP'
                      ? 'text-violet-900 dark:text-white'
                      : 'text-slate-900 dark:text-white'
                return (
                  <div key={`${code}-${rate.rate_date}`} className={`rounded-3xl border p-5 shadow-sm ${CARD_STYLES[code] ?? CARD_STYLES.default}`}>
                            <div className="flex items-start gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-white/80">{FLAG_MAP[code] ?? ''} {code}</p>
                        <p className="mt-2 text-2xl font-bold text-white tracking-tight">{getRateName(rate)}</p>
                      </div>
                      <div className="ml-auto inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-300 ring-1 ring-white/10">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.45)] animate-pulse"></span>
                        Active
                      </div>
                    </div>
                    <div className="mt-6">
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">Rate</p>
                      <p className={`mt-3 text-[2.5rem] font-extrabold tracking-tight ${code === 'USD' ? 'text-emerald-400 dark:text-emerald-300' : code === 'EUR' ? 'text-sky-400 dark:text-sky-300' : code === 'GBP' ? 'text-violet-400 dark:text-violet-300' : 'text-cyan-300'}`}>
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
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Full currency list</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">All remaining currencies from the current Bank of Ghana data.</p>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{otherRates.length} currencies</p>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-slate-200/70 bg-white dark:bg-black p-4 shadow-sm shadow-slate-200/40 dark:border-slate-800/70 dark:shadow-lg dark:shadow-slate-950/40">
              <table className="min-w-full text-left text-sm text-slate-900 dark:text-slate-200">
                <thead>
                  <tr className="bg-[#f1f5f9] border-b border-[#cbd5e1] text-[#0f172a] font-semibold dark:bg-black dark:border-[#0b1220] dark:text-[#e2e8f0]">
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {otherRates.map((rate, index) => {
                    const code = getRateCode(rate)
                    const rowAccent = code === 'USD'
                      ? 'border-l-4 border-emerald-400/90 dark:border-emerald-500'
                      : code === 'EUR'
                        ? 'border-l-4 border-sky-500/90 dark:border-sky-500'
                        : code === 'GBP'
                          ? 'border-l-4 border-violet-500/90 dark:border-violet-500'
                          : 'border-l-4 border-cyan-400/75 dark:border-cyan-500/60'
                    return (
                      <tr
                        key={`${code}-${rate.rate_date}`}
                        className={`${rowAccent} border-b border-[#e2e8f0] dark:border-[#0b1220] transition-colors duration-150 ${index % 2 === 0 ? 'bg-white dark:bg-black' : 'bg-[#f8fafc] dark:bg-black'} hover:bg-sky-50 dark:hover:bg-[#0b1220]`}
                      >
                        <td className="px-4 py-3 font-semibold text-[#0f172a] dark:text-[#e2e8f0]">{getRateName(rate)}</td>
                        <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">{code}</td>
                        <td className="px-4 py-3 font-semibold text-[#0d9488] dark:text-[#2dd4bf]">{formatNumber(getRateValue(rate))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/95 p-4 text-sm text-slate-200 shadow-sm shadow-slate-950/20 dark:border-slate-800/60 dark:bg-slate-950/90 dark:text-slate-400">
        Exchange rates are sourced from the Bank of Ghana daily interbank feed and reflected here for the most recent available date.
      </div>
    </div>
  )
}
