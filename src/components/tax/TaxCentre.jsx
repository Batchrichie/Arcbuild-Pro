import { useCallback, useEffect, useMemo, useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'
import WhtCertificatePdf from '../pdf/WhtCertificatePdf'
import Modal from '../ui/Modal'
import { inputCls } from '../../lib/portal-classes'

const TAX_TYPES = ['All', 'VAT', 'NHIL', 'GetFUND', 'PAYE', 'SSNIT', 'WHT', 'CIT']
const STATUS_STYLES = {
  upcoming: 'bg-slate-800/80 text-slate-100 border border-slate-700',
  due: 'bg-amber-900/20 text-amber-200 border border-amber-700',
  overdue: 'bg-red-900/20 text-red-200 border border-red-700',
  filed: 'bg-emerald-900/20 text-emerald-200 border border-emerald-700',
  paid: 'bg-sky-900/20 text-sky-200 border border-sky-700',
}
const TAX_TYPE_STYLES = {
  VAT: 'bg-sky-500/10 text-sky-200 border border-sky-600',
  NHIL: 'bg-violet-500/10 text-violet-200 border border-violet-600',
  GetFUND: 'bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-600',
  PAYE: 'bg-amber-500/10 text-amber-200 border border-amber-600',
  SSNIT: 'bg-cyan-500/10 text-cyan-200 border border-cyan-600',
  WHT: 'bg-emerald-500/10 text-emerald-200 border border-emerald-600',
  CIT: 'bg-rose-500/10 text-rose-200 border border-rose-600',
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function monthKeyFromDate(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelFromKey(key) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-GH', {
    month: 'long',
    year: 'numeric',
  })
}

function defaultPreviousMonthKey() {
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  return monthKeyFromDate(now)
}

function TaxStatusBadge({ status }) {
  const config = STATUS_STYLES[status] || STATUS_STYLES.upcoming
  const label = status?.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${config}`}>
      {label}
    </span>
  )
}

function TaxTypeBadge({ taxType }) {
  const config = TAX_TYPE_STYLES[taxType] || 'bg-slate-800/80 text-slate-100 border border-slate-700'
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${config}`}>
      {taxType}
    </span>
  )
}

export default function TaxCentre({ readOnly = false }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('calendar')
  const [calendarRows, setCalendarRows] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarFilter, setCalendarFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCalendarRow, setSelectedCalendarRow] = useState(null)
  const [markForm, setMarkForm] = useState({ gra_reference: '', amount_paid: '', notes: '' })
  const [actionMessage, setActionMessage] = useState('')
  const [populateLoading, setPopulateLoading] = useState(false)
  const [vatPeriod, setVatPeriod] = useState(defaultPreviousMonthKey())
  const [vatReturn, setVatReturn] = useState(null)
  const [vatLoading, setVatLoading] = useState(false)
  const [whtRows, setWhtRows] = useState([])
  const [whtYear, setWhtYear] = useState(new Date().getFullYear())
  const [filings, setFilings] = useState([])
  const [historyFilterType, setHistoryFilterType] = useState('All')
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear())

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true)
    const { data, error } = await supabase
      .from('tax_calendar')
      .select('*')
      .order('period_start', { ascending: false })
      .order('tax_type', { ascending: true })

    if (error) {
      console.error('Failed to load tax calendar', error.message)
      setCalendarRows([])
    } else {
      setCalendarRows(data || [])
    }
    setCalendarLoading(false)
  }, [])

  const loadVatReturn = useCallback(async () => {
    if (!vatPeriod) return
    setVatLoading(true)
    const [year, month] = vatPeriod.split('-').map(Number)
    const periodStart = new Date(year, month - 1, 1)
    const periodEnd = new Date(year, month, 0)

    const { data, error } = await supabase.rpc('compute_vat_return', {
      period_start_param: periodStart.toISOString().slice(0, 10),
      period_end_param: periodEnd.toISOString().slice(0, 10),
    })

    if (error) {
      console.error('Failed to compute VAT return', error.message)
      setVatReturn(null)
    } else {
      setVatReturn(data)
    }
    setVatLoading(false)
  }, [vatPeriod])

  const loadWhtSummary = useCallback(async () => {
    const { data, error } = await supabase.from('wht_certificate_summary').select('*')
    if (error) {
      console.error('Failed to load WHT summary', error.message)
      setWhtRows([])
    } else {
      setWhtRows(data || [])
      const years = Array.from(new Set((data || []).map((row) => Number(row.year || row.period_year || new Date().getFullYear())))).sort((a, b) => b - a)
      if (years.length) setWhtYear(years[0])
    }
  }, [])

  const loadFilings = useCallback(async () => {
    const { data, error } = await supabase
      .from('tax_filings')
      .select('id, tax_type, period_start, period_end, filed_at, gra_reference, net_tax_due, amount_paid, filed_by(id, full_name)')
      .order('filed_at', { ascending: false })

    if (error) {
      console.error('Failed to load filing history', error.message)
      setFilings([])
    } else {
      setFilings(data || [])
      const years = Array.from(new Set((data || []).map((row) => new Date(row.filed_at).getFullYear()))).sort((a, b) => b - a)
      if (years.length) setHistoryYear(years[0])
    }
  }, [])

  useEffect(() => {
    const initialize = async () => {
      await loadCalendar()
      await loadVatReturn()
      await loadWhtSummary()
      await loadFilings()
    }
    initialize()
  }, [loadCalendar, loadVatReturn, loadWhtSummary, loadFilings])

  const filteredCalendarRows = useMemo(() => {
    if (calendarFilter === 'All') return calendarRows
    return calendarRows.filter((row) => row.tax_type === calendarFilter)
  }, [calendarRows, calendarFilter])

  const vatMonthOptions = useMemo(() => {
    const options = Array.from(
      new Set(
        calendarRows
          .filter((row) => row.tax_type === 'VAT')
          .map((row) => monthKeyFromDate(row.period_start))
      )
    )
      .sort()
      .reverse()

    if (options.length === 0) {
      const now = new Date()
      return Array.from({ length: 12 }, (_, index) => {
        const d = new Date(now.getFullYear(), now.getMonth() - index - 1, 1)
        return monthKeyFromDate(d)
      })
    }
    return options
  }, [calendarRows])

  const vatCalendarRow = useMemo(() => {
    return calendarRows.find(
      (row) => row.tax_type === 'VAT' && monthKeyFromDate(row.period_start) === vatPeriod
    )
  }, [calendarRows, vatPeriod])

  const whtYears = useMemo(() => {
    const years = Array.from(
      new Set(
        whtRows.map((row) => Number(row.year || row.period_year || new Date().getFullYear()))
      )
    ).sort((a, b) => b - a)
    return years.length ? years : [new Date().getFullYear()]
  }, [whtRows])

  const filteredWhtRows = useMemo(() => {
    return whtRows.filter((row) => Number(row.year || row.period_year || new Date().getFullYear()) === Number(whtYear))
  }, [whtRows, whtYear])

  const whtTotalDeducted = useMemo(() => {
    return filteredWhtRows.reduce((sum, row) => sum + Number(row.total_wht_deducted || 0), 0)
  }, [filteredWhtRows])

  const historyYears = useMemo(() => {
    const years = Array.from(new Set(filings.map((row) => new Date(row.filed_at).getFullYear()))).sort((a, b) => b - a)
    return years.length ? years : [new Date().getFullYear()]
  }, [filings])

  const filteredFilings = useMemo(() => {
    return filings.filter((row) => {
      const matchesType = historyFilterType === 'All' || row.tax_type === historyFilterType
      const matchesYear = Number(new Date(row.filed_at).getFullYear()) === Number(historyYear)
      return matchesType && matchesYear
    })
  }, [filings, historyFilterType, historyYear])

  const handlePopulateNextYear = async () => {
    setPopulateLoading(true)
    const { data, error } = await supabase.rpc('populate_tax_calendar', {
      months_ahead: 12,
    })
    if (error) {
      setActionMessage(error.message || 'Failed to populate next year')
    } else {
      setActionMessage(`Added ${data ?? 0} obligations`) 
      await loadCalendar()
    }
    setPopulateLoading(false)
  }

  const openMarkModal = (row) => {
    setSelectedCalendarRow(row)
    setMarkForm({
      gra_reference: '',
      amount_paid: row.amount_due ? String(row.amount_due) : '',
      notes: '',
    })
    setActionMessage('')
    setModalOpen(true)
  }

  const closeMarkModal = () => {
    setModalOpen(false)
    setSelectedCalendarRow(null)
    setMarkForm({ gra_reference: '', amount_paid: '', notes: '' })
    setActionMessage('')
  }

  const handleMarkFiled = async () => {
    if (!selectedCalendarRow || !user) return
    if (!markForm.gra_reference.trim() || !markForm.amount_paid.trim()) {
      setActionMessage('GRA reference and amount paid are required.')
      return
    }

    const { error } = await supabase.rpc('mark_tax_filed', {
      tax_calendar_id_param: selectedCalendarRow.id,
      gra_reference_param: markForm.gra_reference.trim(),
      amount_paid_param: Number(markForm.amount_paid),
      actor_uuid: user.id,
      notes_param: markForm.notes.trim() || null,
    })

    if (error) {
      setActionMessage(error.message || 'Failed to mark as filed')
      return
    }

    setActionMessage('Tax obligation marked as filed.')
    closeMarkModal()
    await loadCalendar()
    await loadFilings()
  }

  const handleVatMarkLink = () => {
    if (!vatCalendarRow) return
    setCalendarFilter('VAT')
    setActiveTab('calendar')
    setSelectedCalendarRow(vatCalendarRow)
    setModalOpen(true)
  }

  const downloadCsv = () => {
    const rows = filteredFilings.map((row) => ({
      'Tax Type': row.tax_type,
      'Period Start': formatDate(row.period_start),
      'Period End': formatDate(row.period_end),
      'Filed Date': formatDate(row.filed_at),
      'GRA Reference': row.gra_reference || '',
      'Net Tax Due': formatGhs(row.net_tax_due),
      'Amount Paid': formatGhs(row.amount_paid),
      'Filed By': row.filed_by?.full_name || '',
    }))

    const header = Object.keys(rows[0] || {}).join(',')
    const csv = [header, ...rows.map((row) => Object.values(row).map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tax-filings-${historyYear}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-4xl border border-border-soft bg-slate-950/80 p-6 shadow-2xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Tax Management Centre</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">GRA Compliance & filings</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['calendar', 'vat', 'wht', 'history'].map((tabId) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={`min-touch rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeTab === tabId
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                  : 'border-border-soft bg-white/5 text-slate-300 hover:border-amber-400/20'
              }`}
            >
              {tabId === 'calendar' ? 'Tax Calendar' : tabId === 'vat' ? 'VAT Return' : tabId === 'wht' ? 'WHT Certificates' : 'Filing History'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'calendar' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-slate-300" htmlFor="tax-filter">
                Filter by tax type:
              </label>
              <select
                id="tax-filter"
                value={calendarFilter}
                onChange={(event) => setCalendarFilter(event.target.value)}
                className="rounded-2xl border border-border-soft bg-slate-950/80 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              >
                {TAX_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={handlePopulateNextYear}
                disabled={populateLoading}
                className="min-touch inline-flex items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10 px-5 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {populateLoading ? 'Populating...' : 'Populate Next Year'}
              </button>
            )}
          </div>

          {actionMessage && (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {actionMessage}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {calendarLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-3xl bg-white/5" />
              ))
            ) : filteredCalendarRows.length ? (
              filteredCalendarRows.map((row) => (
                <article key={row.id} className="rounded-3xl border border-border-soft bg-slate-950/80 p-5 shadow-inner shadow-black/20">
                  <div className="flex items-center justify-between gap-3">
                    <TaxTypeBadge taxType={row.tax_type} />
                    <TaxStatusBadge status={row.status} />
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    <div>
                      <span className="font-semibold text-slate-100">Period:</span> {formatDate(row.period_start)} - {formatDate(row.period_end)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-100">Due date:</span> {formatDate(row.due_date)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-100">Amount due:</span>{' '}
                      {row.amount_due ? `GHS ${formatGhs(row.amount_due)}` : 'Ledger amount pending'}
                    </div>
                    {row.filed_date && (
                      <div>
                        <span className="font-semibold text-slate-100">Filed:</span> {formatDate(row.filed_date)}
                      </div>
                    )}
                    {row.gra_reference && (
                      <div>
                        <span className="font-semibold text-slate-100">GRA ref:</span> {row.gra_reference}
                      </div>
                    )}
                  </div>
                  {!readOnly && (row.status === 'due' || row.status === 'overdue') && (
                    <button
                      type="button"
                      onClick={() => openMarkModal(row)}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
                    >
                      Mark as Filed
                    </button>
                  )}
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-border-soft bg-slate-950/80 p-8 text-slate-400">
                No tax calendar obligations found.
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'vat' && (
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">VAT return</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Monthly VAT computation</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-3 rounded-2xl border border-border-soft bg-slate-950/80 px-4 py-2 text-sm text-slate-300">
                Month:
                <select
                  value={vatPeriod}
                  onChange={(event) => setVatPeriod(event.target.value)}
                  className="rounded-2xl border border-border-soft bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:outline-none"
                >
                  {vatMonthOptions.map((option) => (
                    <option key={option} value={option}>
                      {monthLabelFromKey(option)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={loadVatReturn}
                className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-400/30"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="rounded-4xl border border-border-soft bg-slate-950/80 p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">VAT RETURN — {monthLabelFromKey(vatPeriod)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-400/30"
                  onClick={() => {
                    window.alert('PDF generation is not implemented in this phase.')
                  }}
                >
                  Generate PDF
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleVatMarkLink}
                    className="min-touch rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
                  >
                    Mark as Filed
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 rounded-3xl bg-slate-950/90 p-6 text-sm text-slate-300 sm:grid-cols-[1fr_1fr]">
              {vatLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-8 animate-pulse rounded-xl bg-white/5" />
                ))
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span>Output VAT (from sales):</span>
                      <span className="font-semibold text-white">GHS {formatGhs(vatReturn?.output_vat)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Input VAT (purchases):</span>
                      <span className="font-semibold text-white">(GHS {formatGhs(vatReturn?.input_vat)})</span>
                    </div>
                    <div className="border-t border-border-soft pt-3 text-white">
                      <div className="flex items-center justify-between gap-4">
                        <span>Net VAT Due:</span>
                        <span className="font-semibold">GHS {formatGhs(vatReturn?.net_vat_due)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span>NHIL Due:</span>
                      <span className="font-semibold text-white">GHS {formatGhs(vatReturn?.nhil_due)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>GetFUND Due:</span>
                      <span className="font-semibold text-white">GHS {formatGhs(vatReturn?.getfund_due)}</span>
                    </div>
                    <div className="border-t border-border-soft pt-3 text-white">
                      <div className="flex items-center justify-between gap-4 text-lg font-semibold">
                        <span>TOTAL DUE TO GRA:</span>
                        <span>GHS {formatGhs(vatReturn?.total_due)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'wht' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">WHT certificates</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Subcontractor WHT summary</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-slate-300" htmlFor="wht-year">
                Year:
              </label>
              <select
                id="wht-year"
                value={whtYear}
                onChange={(event) => setWhtYear(Number(event.target.value))}
                className="rounded-2xl border border-border-soft bg-slate-950/80 px-4 py-2 text-sm text-slate-100 focus:outline-none"
              >
                {whtYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-4xl border border-border-soft bg-slate-950/80">
            <div className="grid gap-6 p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm text-slate-300">
                  <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Subcontractor</th>
                      <th className="px-4 py-3">TIN</th>
                      <th className="px-4 py-3 text-right">Gross Paid</th>
                      <th className="px-4 py-3 text-right">WHT Rate</th>
                      <th className="px-4 py-3 text-right">WHT Deducted</th>
                      <th className="px-4 py-3 text-right">Payments</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredWhtRows.length ? (
                      filteredWhtRows.map((row, rowIndex) => (
                        <tr key={row.tin ? `${row.subcontractor_name}-${row.tin}` : `wht-${rowIndex}`}>
                          <td className="whitespace-nowrap px-4 py-4 font-medium text-white">
                            {row.subcontractor_name || row.name || 'Unknown'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">{row.tin || row.tax_id || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">GHS {formatGhs(row.total_gross_paid)}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">{row.wht_rate ?? row.rate ?? '—'}%</td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">GHS {formatGhs(row.total_wht_deducted)}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">{row.payment_count ?? row.payments ?? 0}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">
                            <PDFDownloadLink
                            document={<WhtCertificatePdf certificate={row} />}
                            fileName={`wht-certificate-${row.tin || row.subcontractor_name || row.name || rowIndex}.pdf`}
                            className="min-touch rounded-full border border-border-soft bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400/30"
                          >
                            {({ loading: pdfLoading }) => (pdfLoading ? 'Preparing PDF…' : 'Generate WHT Certificate')}
                          </PDFDownloadLink>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                          No WHT summary rows available for this year.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-3xl border border-border-soft bg-slate-950/90 p-4 text-sm text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold text-white">Total WHT deducted</span>
                  <span className="text-lg font-semibold text-amber-200">GHS {formatGhs(whtTotalDeducted)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Filing history</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Tax filings and records</h2>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-border-soft bg-slate-950/80 px-4 py-2 text-sm text-slate-300">
              Tax type:
              <select
                value={historyFilterType}
                onChange={(event) => setHistoryFilterType(event.target.value)}
                className="rounded-2xl border border-border-soft bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:outline-none"
              >
                {TAX_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-border-soft bg-slate-950/80 px-4 py-2 text-sm text-slate-300">
              Year:
              <select
                value={historyYear}
                onChange={(event) => setHistoryYear(Number(event.target.value))}
                className="rounded-2xl border border-border-soft bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:outline-none"
              >
                {historyYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-hidden rounded-4xl border border-border-soft bg-slate-950/80">
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">{filteredFilings.length} filings matching your filters</p>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="min-touch inline-flex items-center justify-center rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-400/30"
                >
                  Export to CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm text-slate-300">
                  <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Tax Type</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Filed Date</th>
                      <th className="px-4 py-3">GRA Ref</th>
                      <th className="px-4 py-3 text-right">Net Due</th>
                      <th className="px-4 py-3 text-right">Amount Paid</th>
                      <th className="px-4 py-3">Filed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredFilings.length ? (
                      filteredFilings.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-4 py-4 font-medium text-white">{row.tax_type}</td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {formatDate(row.period_start)} - {formatDate(row.period_end)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">{formatDate(row.filed_at)}</td>
                          <td className="whitespace-nowrap px-4 py-4">{row.gra_reference || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">GHS {formatGhs(row.net_tax_due)}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">GHS {formatGhs(row.amount_paid)}</td>
                          <td className="whitespace-nowrap px-4 py-4">{row.filed_by?.full_name || 'Unknown'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                          No filing records available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      <Modal
        open={modalOpen && Boolean(selectedCalendarRow)}
        onClose={closeMarkModal}
        title={selectedCalendarRow ? `${selectedCalendarRow.tax_type} — ${formatDate(selectedCalendarRow.period_start)}` : 'Mark as filed'}
        size="md"
        footer={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleMarkFiled}
              className="min-touch rounded-full border border-amber-400/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
            >
              Save filing
            </button>
            <button
              type="button"
              onClick={closeMarkModal}
              className="min-touch rounded-full border border-border-soft bg-panel px-5 py-3 text-sm font-semibold text-text-muted-strong"
            >
              Cancel
            </button>
          </div>
        }
      >
        <p className="portal-section-eyebrow mb-4">Mark as filed</p>
        {selectedCalendarRow && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="portal-label block space-y-2">
                <span>GRA reference</span>
                <input
                  type="text"
                  value={markForm.gra_reference}
                  onChange={(event) => setMarkForm({ ...markForm, gra_reference: event.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="portal-label block space-y-2">
                <span>Amount paid</span>
                <input
                  type="number"
                  step="0.01"
                  value={markForm.amount_paid}
                  onChange={(event) => setMarkForm({ ...markForm, amount_paid: event.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
            <label className="portal-label mt-4 block space-y-2">
              <span>Notes</span>
              <textarea
                rows="4"
                value={markForm.notes}
                onChange={(event) => setMarkForm({ ...markForm, notes: event.target.value })}
                className={inputCls}
              />
            </label>
            {actionMessage && <p className="mt-4 text-sm text-amber-200">{actionMessage}</p>}
          </>
        )}
      </Modal>
    </div>
  )
}
