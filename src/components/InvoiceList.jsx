import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import StatusBadge from './ui/StatusBadge'
import Modal from './ui/Modal'
import {
  invoiceActionMutedCls,
  invoiceActionPdfCls,
  invoiceActionPrimaryCls,
  invoiceActionSubmitCls,
  invoiceActionViewCls,
} from '../lib/portal-classes'
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

export default function InvoiceList() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewInvoiceOpen, setViewInvoiceOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [invoiceViewError, setInvoiceViewError] = useState(null)

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

  const fetchInvoices = async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('invoices')
        .select(
          `id,invoice_number,currency,gross_total_ghs,expected_receipt_ghs,fx_rate_to_ghs,status,requires_approval,rejected_at,rejection_note,created_at,due_date,created_by, client:clients(name), project:projects(name), division:divisions(name)`
        )
        .order('created_at', { ascending: false })
        .limit(100)

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

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter, divisionFilter, dateFrom, dateTo])

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

  const handleDeleteInvoice = async (invoice) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this invoice? This cannot be undone.'
    )
    if (!confirmed) return

    setLoading(true)
    setError(null)

    try {
      await supabase.from('invoice_line_items').delete().eq('invoice_id', invoice.id)
      await supabase.from('invoice_payments').delete().eq('invoice_id', invoice.id)

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)

      if (error) throw error
      await fetchInvoices()
    } catch (err) {
      setError(err.message || 'Unable to delete invoice')
    } finally {
      setLoading(false)
    }
  }

  const handleView = async (invoice) => {
    setInvoiceViewError(null)
    setSelectedInvoice(null)
    setViewInvoiceOpen(true)
    setViewLoading(true)

    try {
      const { data: invoiceDetail, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          currency,
          gross_total_ghs,
          expected_receipt_ghs,
          fx_rate_to_ghs,
          status,
          requires_approval,
          rejected_at,
          rejection_note,
          created_at,
          due_date,
          created_by,
          notes,
          client_id,
          project_id,
          retention_rate,
          retention_withheld,
          net_payable,
          client:clients(name, client_type, address, contact_person, contact_phone, contact_email, tin, region, country),
          project:projects(name),
          division:divisions(id,name)
        `)
        .eq('id', invoice.id)
        .single()

      if (invoiceError) throw invoiceError
      if (!invoiceDetail) {
        throw new Error('Invoice detail not found.')
      }

      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .select('id,description,quantity,unit_price')
        .eq('invoice_id', invoiceDetail.id)

      let lineItems = []
      if (lineItemsError) {
        console.warn('Unable to load invoice line items', lineItemsError)
      } else {
        lineItems = lineItemsData || []
      }

      setSelectedInvoice({ ...invoice, lineItems })
    } catch (err) {
      setInvoiceViewError(err.message || 'Unable to load invoice details.')
    } finally {
      setViewLoading(false)
    }
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
      <div className="rounded-4xl panel-surface px-6 py-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-2 text-sm text-slate-300">
              <span className="block uppercase tracking-[0.2em] text-xs text-slate-500">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-border-soft bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
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
                className="w-full rounded-2xl border border-border-soft bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
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
                className="w-full rounded-2xl border border-border-soft bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="block uppercase tracking-[0.2em] text-xs text-slate-500">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-2xl border border-border-soft bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
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

      <div className="overflow-hidden rounded-4xl panel-surface shadow-xl shadow-black/10">
        <div className="portal-table-scroll">
          <table className="min-w-full dark-table text-sm">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Client</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Project</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Division</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Submitted by</th>
                <th className="min-w-[220px] px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Actions</th>
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
                  <tr key={invoice.id} className="border-t border-border-soft hover:bg-surface-overlay/50">
                    <td className="px-6 py-4 text-sm text-text-primary">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-text-primary">{invoice.client?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-text-primary">{invoice.project?.name || 'Unassigned'}</td>
                    <td className="px-6 py-4 text-sm text-text-primary">{invoice.division?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(Number(invoice.gross_total_ghs ?? 0))}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted-strong">{invoice.submitted_by}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                          type="button"
                          onClick={() => handleView(invoice)}
                          className={invoiceActionViewCls}
                          title="View invoice details"
                        >
                          View
                        </button>
                        <InvoicePdfLink invoiceId={invoice.id} className={invoiceActionPdfCls} />
                        {invoice.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleSubmitInvoice(invoice)}
                            className={invoiceActionSubmitCls}
                            title="Submit for approval"
                          >
                            Submit
                          </button>
                        )}
                        {invoice.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleMarkSent(invoice)}
                            className={invoiceActionPrimaryCls}
                            title="Mark invoice as sent to client"
                          >
                            Send
                          </button>
                        )}
                        {(invoice.status === 'draft' || invoice.status === 'pending_approval') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(invoice)}
                            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
                            title="Delete invoice"
                          >
                            Delete
                          </button>
                        )}
                        {invoice.status === 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleRevise(invoice)}
                            className={invoiceActionMutedCls}
                            title="Revise and resubmit"
                          >
                            Revise
                          </button>
                        )}
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

      <Modal
        open={viewInvoiceOpen}
        onClose={() => setViewInvoiceOpen(false)}
        title={selectedInvoice ? `Invoice ${selectedInvoice.invoice_number}` : 'Invoice details'}
        size="xl"
      >
        {viewLoading ? (
          <div className="py-10 text-center text-slate-400">Loading invoice details...</div>
        ) : invoiceViewError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            {invoiceViewError}
          </div>
        ) : selectedInvoice ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Invoice</div>
                <div className="mt-2 text-sm text-slate-100">{selectedInvoice.invoice_number}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</div>
                <div className="mt-2 text-sm text-slate-100">{selectedInvoice.status}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Client</div>
                <div className="mt-2 text-sm text-slate-100">{selectedInvoice.client?.name || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Project</div>
                <div className="mt-2 text-sm text-slate-100">{selectedInvoice.project?.name || 'Unassigned'}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-border-soft bg-slate-950/80 p-4">
              <div className="grid gap-4 sm:grid-cols-3 text-sm text-slate-300">
                <div>
                  <div className="uppercase tracking-[0.2em]">Amount</div>
                  <div className="mt-2 text-slate-100">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(Number(selectedInvoice.gross_total_ghs || 0))}</div>
                </div>
                <div>
                  <div className="uppercase tracking-[0.2em]">Due date</div>
                  <div className="mt-2 text-slate-100">{selectedInvoice.due_date || '—'}</div>
                </div>
                <div>
                  <div className="uppercase tracking-[0.2em]">Retention rate</div>
                  <div className="mt-2 text-slate-100">{selectedInvoice.retention_rate ?? 0}%</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border-soft bg-slate-950/80 overflow-hidden">
              <div className="border-b border-border-soft bg-slate-900/80 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-200">Line items</div>
              <div className="divide-y divide-white/10">
                <div className="grid gap-4 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400 sm:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]">
                  <div>Description</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Unit price</div>
                  <div className="text-right">Amount</div>
                </div>
                {(selectedInvoice.lineItems || []).map((item, index) => (
                  <div key={item.id || `${item.description || 'line'}-${index}`} className="grid gap-4 px-4 py-4 text-sm text-slate-200 sm:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]">
                    <div>{item.description || '—'}</div>
                    <div className="text-right">{item.quantity}</div>
                    <div className="text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoice.currency || 'GHS', minimumFractionDigits: 2 }).format(Number(item.unit_price || 0))}</div>
                    <div className="text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoice.currency || 'GHS', minimumFractionDigits: 2 }).format(Number((item.quantity || 0) * (item.unit_price || 0)))}</div>
                  </div>
                ))}
                {(!selectedInvoice.lineItems || selectedInvoice.lineItems.length === 0) && (
                  <div className="px-4 py-4 text-sm text-slate-500">No line items available.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

    </div>
  )
}
