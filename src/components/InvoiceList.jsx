import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import RecordPaymentModal from './RecordPaymentModal'
import StatusBadge from './ui/StatusBadge'
import InvoicePdfLink from './pdf/InvoicePdfLink'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
]

const STATUS_BADGES = {
  draft: 'bg-slate-100 text-slate-800',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  sent: 'bg-indigo-100 text-indigo-800',
  paid: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function InvoiceList() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [paymentInvoice, setPaymentInvoice] = useState(null)

  const divisionOptions = useMemo(() => {
    const unique = new Map()
    invoices.forEach((invoice) => {
      const name = invoice.division?.name || 'Unknown'
      const id = invoice.division_id
      if (id && !unique.has(id)) {
        unique.set(id, name)
      }
    })
    return [{ value: 'all', label: 'All divisions' }, ...Array.from(unique, ([value, label]) => ({ value, label }))]
  }, [invoices])

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter, divisionFilter, dateFrom, dateTo])

  const fetchInvoices = async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('invoices')
        .select(
          `id,invoice_number,currency,gross_total_ghs,status,requires_approval,rejected_at,rejection_note,created_at,due_date,created_by, client:clients(name), project:projects(name), division:divisions(name)`
        )
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (divisionFilter !== 'all') {
        query = query.eq('division_id', divisionFilter)
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }

      const { data, error } = await query
      if (error) throw error

      if (!data) {
        setInvoices([])
        return
      }

      const createdByIds = Array.from(new Set(data.map((inv) => inv.created_by).filter(Boolean)))
      let createdByMap = new Map()

      if (createdByIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', createdByIds)

        if (profileError) {
          throw profileError
        }

        createdByMap = new Map(profiles.map((profile) => [profile.user_id, profile.full_name]))
      }

      setInvoices(
        data.map((invoice) => ({
          ...invoice,
          submitted_by: createdByMap.get(invoice.created_by) || 'Unknown',
        }))
      )
    } catch (err) {
      setError(err.message || 'Unable to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const updateInvoiceStatus = async (invoice, newStatus, rejectionReason = null) => {
    if (!user?.id) {
      setError('Authentication required to change invoice status.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.rpc('transition_invoice_status', {
        invoice_uuid: invoice.id,
        new_status: newStatus,
        acting_user_id: user.id,
        rejection_reason: rejectionReason,
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || 'Status transition failed')
      }

      await fetchInvoices()
    } catch (err) {
      setError(err.message || 'Unable to update invoice status')
    } finally {
      setLoading(false)
    }
  }

  const openPaymentModal = (invoice) => {
    setPaymentInvoice(invoice)
  }

  const closePaymentModal = () => {
    setPaymentInvoice(null)
  }

  const handlePaymentSuccess = async () => {
    closePaymentModal()
    await fetchInvoices()
  }

  const handleSubmitInvoice = (invoice) => {
    const nextStatus = invoice.requires_approval ? 'pending_approval' : 'approved'
    updateInvoiceStatus(invoice, nextStatus)
  }

  const handleMarkSent = (invoice) => {
    updateInvoiceStatus(invoice, 'sent')
  }

  const handleRevise = (invoice) => {
    updateInvoiceStatus(invoice, 'draft')
  }

  const handleView = (invoice) => {
    window.alert(`Invoice ${invoice.invoice_number} details are not yet implemented.`)
  }

  const overdueCount = useMemo(() => {
    const today = new Date()
    return invoices.filter((inv) => {
      if (inv.status !== 'sent') return false
      const ref = inv.due_date ? new Date(inv.due_date) : new Date(inv.created_at)
      const days = Math.floor((today - ref) / (1000 * 60 * 60 * 24))
      return days > 30
    }).length
  }, [invoices])

  const handleSendReminders = () => {
    window.alert(
      `Reminder automation will be available in Phase 5. ${overdueCount} overdue invoice(s) identified.`
    )
  }

  return (
    <div className="space-y-6">
      {overdueCount > 0 && (
        <div
          className="flex flex-col gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm font-medium text-red-200">
            {overdueCount} sent invoice{overdueCount === 1 ? '' : 's'} more than 30 days past due date.
          </p>
          <button
            type="button"
            onClick={handleSendReminders}
            className="min-touch shrink-0 rounded-full border border-red-400/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/30"
          >
            Send Reminders
          </button>
        </div>
      )}
      <div className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-6 py-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-2 text-sm text-slate-300">
              <span className="block uppercase tracking-[0.2em] text-xs text-slate-500">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="block uppercase tracking-[0.2em] text-xs text-slate-500">Division</span>
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              >
                {divisionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="block uppercase tracking-[0.2em] text-xs text-slate-500">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="block uppercase tracking-[0.2em] text-xs text-slate-500">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] shadow-xl shadow-black/10">
        <div className="portal-table-scroll">
          <table className="min-w-full dark-table text-sm text-slate-200">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Client</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Project</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Division</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Submitted by</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-sm text-slate-500">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-sm text-slate-500">
                    No invoices match the selected criteria.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-6 py-4 text-sm text-slate-100">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-100">{invoice.client?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-slate-100">{invoice.project?.name || 'Unassigned'}</td>
                    <td className="px-6 py-4 text-sm text-slate-100">{invoice.division?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-slate-100">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(Number(invoice.gross_total_ghs ?? 0))}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-100">{invoice.submitted_by}</td>
                    <td className="px-6 py-4 text-sm text-slate-100">
                      <div className="flex flex-wrap gap-2">
                        {invoice.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleSubmitInvoice(invoice)}
                            className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Submit
                          </button>
                        )}
                        {invoice.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleMarkSent(invoice)}
                            className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            Mark Sent
                          </button>
                        )}
                        {invoice.status === 'sent' && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(invoice)}
                            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Record Payment
                          </button>
                        )}
                        {invoice.status === 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleRevise(invoice)}
                            className="rounded-full bg-slate-600 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            Revise
                          </button>
                        )}
                        <InvoicePdfLink invoiceId={invoice.id} filename={`invoice-${invoice.invoice_number}.pdf`} />
                        <button
                          type="button"
                          onClick={() => handleView(invoice)}
                          className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {invoices.map((invoice) =>
        invoice.status === 'rejected' ? (
          <div key={`${invoice.id}-rejected`} className="rounded-3xl border border-red-500/20 bg-red-950/30 p-5 text-sm text-red-200">
            <div className="font-semibold">Rejection note for {invoice.invoice_number}</div>
            <p className="mt-2">{invoice.rejection_note || 'No rejection note provided.'}</p>
          </div>
        ) : null
      )}

      <RecordPaymentModal
        invoice={paymentInvoice}
        open={Boolean(paymentInvoice)}
        onClose={closePaymentModal}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}
