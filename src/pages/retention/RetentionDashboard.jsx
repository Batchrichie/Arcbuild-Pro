import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getRetentionSummary, getRetentionLedger, releaseClientRetention } from '../../services/retentionService'

const statusStyles = {
  withheld: 'border-amber-300/30 bg-amber-300/10 text-amber-300',
  partially_released: 'border-blue-300/30 bg-blue-300/10 text-blue-300',
  fully_released: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300',
  disputed: 'border-rose-300/30 bg-rose-300/10 text-rose-300',
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'withheld', label: 'Withheld' },
  { value: 'partially_released', label: 'Partially Released' },
  { value: 'fully_released', label: 'Fully Released' },
  { value: 'disputed', label: 'Disputed' },
]

export default function RetentionDashboard() {
  const { profile, user } = useAuth()
  const [summary, setSummary] = useState({
    clientWithheld: 0,
    clientReleased: 0,
    clientBalance: 0,
    subcontractorWithheld: 0,
    subcontractorReleased: 0,
    subcontractorBalance: 0,
  })
  const [ledger, setLedger] = useState([])
  const [projects, setProjects] = useState([])
  const [filters, setFilters] = useState({ projectId: '', status: '', dateFrom: '', dateTo: '' })
  const [activeTab, setActiveTab] = useState('client')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState({
    isOpen: false,
    row: null,
    releaseAmount: '',
    releaseInvoiceNumber: '',
    notes: '',
    submitError: null,
    submitSuccess: null,
    confirmLoading: false,
  })

  useEffect(() => {
    if (!profile) return
    if (!['ceo', 'accountant', 'project_manager'].includes(profile.role)) return

    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id,name')
          .eq('status', 'active')
          .order('name')

        if (error) throw error
        setProjects(data || [])
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }

    fetchProjects()
  }, [profile])

  const loadData = async () => {
    if (!profile) return
    if (!['ceo', 'accountant', 'project_manager'].includes(profile.role)) return

    setLoading(true)
    setError(null)

    try {
      const summaryData = await getRetentionSummary(filters.projectId || undefined)
      const ledgerData = await getRetentionLedger({
        projectId: filters.projectId || undefined,
        status: filters.status || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      })

      setSummary(summaryData)
      setLedger(ledgerData)
    } catch (err) {
      setError(err.message || 'Unable to load retention data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [profile, filters])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setFilters({ projectId: '', status: '', dateFrom: '', dateTo: '' })
  }

  const filteredLedger = useMemo(
    () => ledger.filter((entry) => entry.retention_type === activeTab),
    [ledger, activeTab]
  )

  const openReleaseModal = (row) => {
    setModal({
      isOpen: true,
      row,
      releaseAmount: row.balance_amount?.toString() || '0',
      releaseInvoiceNumber: '',
      notes: '',
      submitError: null,
      submitSuccess: null,
      confirmLoading: false,
    })
  }

  const closeModal = () => {
    setModal({
      isOpen: false,
      row: null,
      releaseAmount: '',
      releaseInvoiceNumber: '',
      notes: '',
      submitError: null,
      submitSuccess: null,
      confirmLoading: false,
    })
  }

  const handleConfirmRelease = async () => {
    if (!modal.row) return
    if (!modal.releaseInvoiceNumber.trim()) {
      setModal((prev) => ({ ...prev, submitError: 'Release invoice number is required.' }))
      return
    }

    const amount = Number(modal.releaseAmount || 0)
    const maxAmount = Number(modal.row.balance_amount || 0)
    if (amount <= 0 || amount > maxAmount) {
      setModal((prev) => ({ ...prev, submitError: 'Release amount must be greater than 0 and not exceed the current balance.' }))
      return
    }

    try {
      setModal((prev) => ({ ...prev, confirmLoading: true, submitError: null }))

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', modal.releaseInvoiceNumber.trim())
        .single()

      if (invoiceError) throw invoiceError
      if (!invoice) {
        throw new Error('Release invoice not found')
      }

      await releaseClientRetention({
        retentionLedgerId: modal.row.id,
        projectId: modal.row.project_id,
        releaseAmount: amount,
        releaseInvoiceId: invoice.id,
        postedBy: user?.id,
      })

      setModal((prev) => ({ ...prev, submitSuccess: 'Retention released successfully.' }))
      await loadData()
    } catch (err) {
      setModal((prev) => ({ ...prev, submitError: err.message || 'Unable to release retention' }))
    } finally {
      setModal((prev) => ({ ...prev, confirmLoading: false }))
    }
  }

  const handleExportPlaceholder = () => {
    alert('Export coming in Phase 5')
  }

  if (profile && !['ceo', 'accountant', 'project_manager'].includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  if (!profile) {
    return null
  }

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-[1.75rem] border border-border-soft bg-slate-950/95 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white">Retention Dashboard</h1>
              <p className="mt-2 text-sm text-slate-400">
                Track client and subcontractor retention balances across projects.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportPlaceholder}
                className="rounded-2xl border border-border-soft bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Export PDF
              </button>
              <button
                onClick={handleExportPlaceholder}
                className="rounded-2xl border border-border-soft bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15"
              >
                Export Excel
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border-soft bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-3">Total Client Retention Held</p>
              <p className="text-2xl font-semibold text-white">GHS {Number(summary.clientBalance || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-3">Total Client Retention Released</p>
              <p className="text-2xl font-semibold text-white">GHS {Number(summary.clientReleased || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-3">Total Balance Due to ARCBUILD</p>
              <p className="text-2xl font-semibold text-white">GHS {Number(summary.clientBalance || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-3">Total Subcontractor Retention Held</p>
              <p className="text-2xl font-semibold text-white">GHS {Number(summary.subcontractorBalance || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-border-soft bg-slate-900/80 p-6">
            <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Project</label>
                  <select
                    value={filters.projectId}
                    onChange={(e) => handleFilterChange('projectId', e.target.value)}
                    className="w-full rounded-2xl border border-border-soft bg-slate-950/90 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  >
                    <option value="">All projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full rounded-2xl border border-border-soft bg-slate-950/90 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Date From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full rounded-2xl border border-border-soft bg-slate-950/90 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Date To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full rounded-2xl border border-border-soft bg-slate-950/90 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
              </div>

              <div className="flex items-end justify-end">
                <button
                  onClick={clearFilters}
                  className="rounded-2xl border border-border-soft bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex overflow-hidden rounded-2xl border border-border-soft bg-slate-950/90">
              {['client', 'subcontractor'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-sm font-semibold transition ${activeTab === tab ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  {tab === 'client' ? 'Client Retention' : 'Subcontractor Retention'}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-400">{filteredLedger.length} record(s) found.</p>
          </div>

          {error && (
            <div className="mt-6 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-3xl border border-border-soft bg-slate-950/90 shadow-inner shadow-black/20">
            <div className="portal-table-scroll overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">{activeTab === 'client' ? 'Contract' : 'Subcontractor'}</th>
                    {activeTab === 'client' && <th className="px-4 py-3">Invoice #</th>}
                    <th className="px-4 py-3 text-right">Withheld</th>
                    <th className="px-4 py-3 text-right">Released</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    {activeTab === 'client' && <th className="px-4 py-3">Due Date</th>}
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={activeTab === 'client' ? 9 : 7} className="px-4 py-8 text-center text-slate-400">
                        Loading retention entries...
                      </td>
                    </tr>
                  ) : filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'client' ? 9 : 7} className="px-4 py-8 text-center text-slate-400">
                        No retention entries found.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((row) => (
                      <tr key={row.id} className="border-t border-border-soft hover:bg-white/5 transition">
                        <td className="px-4 py-4 text-slate-200">{row.project?.name || '—'}</td>
                        <td className="px-4 py-4 text-slate-200">
                          {activeTab === 'client'
                            ? row.contract_id || '—'
                            : row.subcontractor?.name || '—'}
                        </td>
                        {activeTab === 'client' && (
                          <td className="px-4 py-4 text-slate-200">{row.invoice?.invoice_number || '—'}</td>
                        )}
                        <td className="px-4 py-4 text-right text-slate-200">GHS {Number(row.withheld_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-right text-slate-200">GHS {Number(row.released_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-right text-slate-200">GHS {Number(row.balance_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[row.status] || 'border-slate-300/20 bg-slate-300/10 text-slate-300'}`}>
                            {row.status?.replace('_', ' ') || 'Unknown'}
                          </span>
                        </td>
                        {activeTab === 'client' && (
                          <td className="px-4 py-4 text-slate-200">{row.invoice?.due_date ? new Date(row.invoice.due_date).toLocaleDateString('en-GB') : '—'}</td>
                        )}
                        <td className="px-4 py-4">
                          {activeTab === 'client' && ['withheld', 'partially_released'].includes(row.status) && ['ceo', 'accountant'].includes(profile.role) ? (
                            <button
                              onClick={() => openReleaseModal(row)}
                              className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
                            >
                              Release
                            </button>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {modal.isOpen && modal.row && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
              <div className="w-full max-w-2xl rounded-3xl border border-border-soft bg-slate-950/95 p-6 shadow-2xl shadow-black/40">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Release Retention</h2>
                    <p className="mt-2 text-sm text-slate-400">Confirm release details for the selected retention record.</p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="rounded-full border border-border-soft bg-white/5 px-3 py-2 text-slate-300 transition hover:bg-white/10"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Project</p>
                    <p className="mt-2 text-sm text-white">{modal.row.project?.name || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current Withheld</p>
                    <p className="mt-2 text-sm text-white">GHS {Number(modal.row.withheld_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current Balance</p>
                    <p className="mt-2 text-sm text-white">GHS {Number(modal.row.balance_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Release Amount</label>
                    <input
                      type="number"
                      min="0"
                      max={modal.row.balance_amount}
                      step="0.01"
                      value={modal.releaseAmount}
                      onChange={(e) => setModal((prev) => ({ ...prev, releaseAmount: e.target.value }))}
                      className="w-full rounded-2xl border border-border-soft bg-slate-900 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Release Invoice Number</label>
                    <input
                      type="text"
                      value={modal.releaseInvoiceNumber}
                      onChange={(e) => setModal((prev) => ({ ...prev, releaseInvoiceNumber: e.target.value }))}
                      className="w-full rounded-2xl border border-border-soft bg-slate-900 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                    <textarea
                      value={modal.notes}
                      onChange={(e) => setModal((prev) => ({ ...prev, notes: e.target.value }))}
                      rows="3"
                      className="w-full rounded-2xl border border-border-soft bg-slate-900 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>

                {modal.submitError && (
                  <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                    {modal.submitError}
                  </div>
                )}
                {modal.submitSuccess && (
                  <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    {modal.submitSuccess}
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={closeModal}
                    className="rounded-2xl border border-border-soft bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRelease}
                    disabled={modal.confirmLoading}
                    className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                  >
                    {modal.confirmLoading ? 'Confirming...' : 'Confirm Release'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
