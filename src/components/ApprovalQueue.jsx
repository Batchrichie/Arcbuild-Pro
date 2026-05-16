import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STATUS_BADGES = {
  pending_approval: 'bg-amber-100 text-amber-800',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[status] ?? 'bg-slate-100 text-slate-800'}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  )
}

export default function ApprovalQueue() {
  const { user, profile } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectError, setRejectError] = useState(null)

  const pendingCount = invoices.length

  useEffect(() => {
    fetchPendingInvoices()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('pending-approvals')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invoices',
        filter: 'status=eq.pending_approval',
      }, () => {
        fetchPendingInvoices()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchPendingInvoices = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id,invoice_number,gross_total_ghs,currency,project:projects(name),division:divisions(name),client:clients(name),created_by,created_at')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false })

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

        createdByMap = new Map(profiles.map((profileRow) => [profileRow.user_id, profileRow.full_name]))
      }

      setInvoices(
        data.map((invoice) => ({
          ...invoice,
          submitted_by: createdByMap.get(invoice.created_by) || 'Unknown',
        }))
      )
    } catch (err) {
      setError(err.message || 'Unable to load approval queue')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (invoice) => {
    if (!user?.id) {
      setError('Authentication required to approve invoices.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.rpc('transition_invoice_status', {
        invoice_uuid: invoice.id,
        new_status: 'approved',
        acting_user_id: user.id,
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || 'Approval failed')
      }

      setInvoices((current) => current.filter((item) => item.id !== invoice.id))
    } catch (err) {
      setError(err.message || 'Unable to approve invoice')
    } finally {
      setLoading(false)
    }
  }

  const openRejectModal = (invoice) => {
    setSelectedInvoice(invoice)
    setRejectionReason('')
    setRejectError(null)
  }

  const closeRejectModal = () => {
    setSelectedInvoice(null)
    setRejectionReason('')
    setRejectError(null)
  }

  const submitRejection = async () => {
    if (!selectedInvoice) return
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      setRejectError('Rejection reason must be at least 10 characters.')
      return
    }

    setLoading(true)
    setRejectError(null)
    setError(null)

    try {
      const { data, error } = await supabase.rpc('transition_invoice_status', {
        invoice_uuid: selectedInvoice.id,
        new_status: 'rejected',
        acting_user_id: user.id,
        rejection_reason: rejectionReason.trim(),
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || 'Rejection failed')
      }

      setInvoices((current) => current.filter((item) => item.id !== selectedInvoice.id))
      closeRejectModal()
    } catch (err) {
      setRejectError(err.message || 'Unable to reject invoice')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pending Approvals</h1>
            <p className="mt-1 text-sm text-slate-600">
              {profile?.full_name ?? 'CEO'} portal — {pendingCount} invoice(s) pending approval.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            {pendingCount} pending approval
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Client</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Project</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Division</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amount (GHS)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted By</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-sm text-slate-500">
                    Loading pending invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-sm text-slate-500">
                    No invoices pending approval.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 text-sm text-slate-700">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{invoice.client?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{invoice.project?.name || 'Unassigned'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{invoice.division?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(Number(invoice.gross_total_ghs ?? 0))}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{invoice.submitted_by}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{new Date(invoice.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status="pending_approval" />
                        <button
                          type="button"
                          onClick={() => handleApprove(invoice)}
                          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openRejectModal(invoice)}
                          className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Reject
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

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Reject Invoice</h2>
                <p className="text-sm text-slate-500">{selectedInvoice.invoice_number}</p>
              </div>
              <button
                type="button"
                onClick={closeRejectModal}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Rejection reason is required. Minimum 10 characters.
              </div>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Rejection Reason</span>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows="5"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </label>

              {rejectError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {rejectError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitRejection}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Reject Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
