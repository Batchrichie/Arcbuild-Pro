import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import StatusBadge from './ui/StatusBadge'
import { recordRetentionWithheld } from '../services/retentionService'

export default function ApprovalQueue() {
  const { user, profile } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectError, setRejectError] = useState(null)

  const pendingCount = invoices.length

  const fetchPendingInvoices = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id,invoice_number,gross_total,gross_total_ghs,currency,project_id,retention_rate,project:projects(name),division:divisions(name),client:clients(name),created_by,created_at')
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

  const getContractIdForProject = async (projectId) => {
    if (!projectId) return null

    const { data, error } = await supabase
      .from('contracts')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }
    return data?.id ?? null
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

      if (invoice.retention_rate > 0) {
        const contractId = await getContractIdForProject(invoice.project_id)
        await recordRetentionWithheld({
          invoiceId: invoice.id,
          projectId: invoice.project_id,
          contractId,
          retentionRate: invoice.retention_rate,
          grossAmount: invoice.gross_total,
          postedBy: user.id,
        })
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
      <div className="rounded-3xl border border-border-soft bg-surface px-6 py-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Pending Approvals</h1>
            <p className="mt-1 text-sm text-slate-400">
              {profile?.full_name ?? 'CEO'} portal — {pendingCount} invoice(s) waiting review.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-success-bg px-4 py-2 text-sm font-semibold text-success">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            {pendingCount} pending approval
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-border-soft bg-surface-2 shadow-xl shadow-black/10">
        <div className="overflow-x-auto">
          <table className="min-w-full dark-table text-sm text-slate-200">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-400">Invoice</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-400">Client</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-400">Project</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-400">Division</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-400">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-400">Submitted By</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-400">Submitted Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-sm text-slate-400">
                    Loading pending invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10">
                    <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 rounded-3xl border border-success/20 bg-success-bg px-6 py-10 text-center text-slate-200">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/20 text-success">
                        ✓
                      </div>
                      <p className="text-lg font-semibold">All approvals are clear</p>
                      <p className="max-w-sm text-sm text-slate-400">No invoices are waiting for CEO action right now. Great work keeping the pipeline moving.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-border-soft hover:bg-surface-overlay">
                    <td className="px-6 py-4 text-sm text-slate-200">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-200">{invoice.client?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-slate-200">{invoice.project?.name || 'Unassigned'}</td>
                    <td className="px-6 py-4 text-sm text-slate-200">{invoice.division?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-slate-200">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(Number(invoice.gross_total_ghs ?? 0))}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-200">{invoice.submitted_by}</td>
                    <td className="px-6 py-4 text-sm text-slate-200">{new Date(invoice.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-200">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status="pending_approval" />
                        <button
                          type="button"
                          onClick={() => handleApprove(invoice)}
                          className="min-touch rounded-full bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openRejectModal(invoice)}
                          className="min-touch rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger/90"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border-soft bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Reject Invoice</h2>
                <p className="text-sm text-slate-400">{selectedInvoice.invoice_number}</p>
              </div>
              <button
                type="button"
                onClick={closeRejectModal}
                className="rounded-full border border-border-soft px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                Rejection reason is required. Minimum 10 characters.
              </div>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Rejection Reason</span>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows="5"
                  className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-red-400/50 focus:bg-white/10 outline-none"
                />
              </label>

              {rejectError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  {rejectError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border-soft">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  className="rounded-xl border border-border-soft bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitRejection}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:border-red-500/50 hover:bg-red-500/20"
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
