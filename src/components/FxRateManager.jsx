import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CURRENCIES = ['USD', 'GBP', 'EUR']

export default function FxRateManager() {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [expandedCurrency, setExpandedCurrency] = useState(null)
  const [historicalRates, setHistoricalRates] = useState({})
  const [missingRates, setMissingRates] = useState([])
  const [successMessage, setSuccessMessage] = useState(null)

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const todayDate = new Date().toISOString().split('T')[0]

      // Fetch latest rates for today
      const { data, error: fetchError } = await supabase
        .from('exchange_rates')
        .select('*')
        .in('currency_code', CURRENCIES)
        .gte('rate_date', todayDate)
        .order('rate_date', { ascending: false })

      if (fetchError) throw fetchError

      // Group by currency and get latest rate
      const latestRates = {}
      const missing = []
      CURRENCIES.forEach(currency => {
        const currencyRates = (data || []).filter(r => r.currency_code === currency)
        if (currencyRates.length > 0) {
          latestRates[currency] = currencyRates[0]
        } else {
          missing.push(currency)
        }
      })

      setRates(Object.values(latestRates))
      if (missing.length > 0) {
        setMissingRates(missing)
      }

      // Fetch historical rates (last 30 days) for each currency
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const histStart = thirtyDaysAgo.toISOString().split('T')[0]

      const { data: histData, error: histError } = await supabase
        .from('exchange_rates')
        .select('*')
        .in('currency_code', CURRENCIES)
        .gte('rate_date', histStart)
        .order('rate_date', { ascending: true })

      if (histError) throw histError

      const grouped = {}
      CURRENCIES.forEach(curr => {
        grouped[curr] = (histData || []).filter(r => r.currency_code === curr)
      })
      setHistoricalRates(grouped)

    } catch (err) {
      setError(err.message)
      console.error('Error fetching rates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  const handleUpdateRate = (rate, currency) => {
    setEditingId(rate?.id || `new-${currency}`)
    setEditValue(rate?.rate_to_ghs || '')
  }

  const saveRate = async (currency) => {
    try {
      if (!editValue || isNaN(editValue)) {
        setError('Please enter a valid rate')
        return
      }

      const todayDate = new Date().toISOString().split('T')[0]

      const { error: saveError } = await supabase
        .from('exchange_rates')
        .insert({
          currency_code: currency,
          rate_to_ghs: parseFloat(editValue),
          rate_date: todayDate,
          source: 'bank_of_ghana'
        })

      if (saveError) {
        if (saveError.code === '23505') { // Unique constraint violation
          // Update instead
          const { error: updateError } = await supabase
            .from('exchange_rates')
            .update({ rate_to_ghs: parseFloat(editValue) })
            .eq('currency_code', currency)
            .eq('rate_date', todayDate)

          if (updateError) throw updateError
        } else {
          throw saveError
        }
      }

      setSuccessMessage(`${currency} rate updated successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
      setMissingRates(prev => prev.filter(c => c !== currency))
      setEditingId(null)
      setEditValue('')
      fetchRates()

    } catch (err) {
      setError(err.message)
      console.error('Error saving rate:', err)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border border-teal-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading exchange rates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success Alert */}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(16,185,129,0.1)] p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
            <p className="text-sm font-medium text-emerald-200">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Missing Rates Warning */}
      {missingRates.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-[rgba(251,146,60,0.1)] p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-medium text-amber-200 mb-1">
                Exchange rates not set for today
              </p>
              <p className="text-xs text-amber-300">
                {missingRates.join(', ')} rate{missingRates.length > 1 ? 's' : ''} missing. Foreign currency invoices may use yesterday's rate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.1)] p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl">❌</span>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Rates Grid */}
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        {CURRENCIES.map(currency => {
          const rate = rates.find(r => r.currency_code === currency)
          const isEditing = editingId === (rate?.id || `new-${currency}`)

          return (
            <div
              key={currency}
              className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm hover:border-white/20 hover:bg-[rgba(255,255,255,0.06)] transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-1">{currency}</p>
                  <p className="text-2xl font-semibold text-white">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        className="w-32 px-3 py-2 rounded-xl border border-white/20 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-lg"
                      />
                    ) : (
                      `GHS ${rate?.rate_to_ghs.toFixed(4) || '—'}`
                    )}
                  </p>
                </div>
                <div className="text-right">
                  {rate?.rate_date && (
                    <p className="text-xs text-slate-400">{formatDate(rate.rate_date)}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveRate(currency)}
                      className="flex-1 rounded-2xl border border-emerald-400/40 bg-[rgba(16,185,129,0.15)] px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-400/60 hover:bg-[rgba(16,185,129,0.25)]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setEditValue('')
                        setError(null)
                      }}
                      className="flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/40 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateRate(rate, currency)}
                      className="flex-1 rounded-2xl border border-teal-400/40 bg-[rgba(20,184,166,0.15)] px-4 py-2 text-sm font-medium text-teal-200 transition hover:border-teal-400/60 hover:bg-[rgba(20,184,166,0.25)]"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => setExpandedCurrency(expandedCurrency === currency ? null : currency)}
                      className="flex-1 rounded-2xl border border-blue-400/40 bg-[rgba(56,138,221,0.15)] px-4 py-2 text-sm font-medium text-blue-200 transition hover:border-blue-400/60 hover:bg-[rgba(56,138,221,0.25)]"
                    >
                      {expandedCurrency === currency ? 'Hide' : 'Show'} Trend
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Historical Rates */}
      {expandedCurrency && historicalRates[expandedCurrency]?.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4">
            {expandedCurrency} Rate Trend — Last 30 Days
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {historicalRates[expandedCurrency].map((rate, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10"
              >
                <span className="text-sm text-slate-300">{formatDate(rate.rate_date)}</span>
                <span className="font-semibold text-white">GHS {rate.rate_to_ghs.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="rounded-2xl border border-blue-400/30 bg-[rgba(56,138,221,0.1)] p-4 backdrop-blur-sm">
        <p className="text-sm text-blue-200">
          <span className="font-semibold">📌 Update daily rates:</span> Exchange rates are sourced from the Bank of Ghana. Update all rates before processing foreign currency invoices to ensure accurate conversions.
        </p>
      </div>
    </div>
  )
}
