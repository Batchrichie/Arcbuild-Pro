import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from './ui/Modal'

export default function RecordPaymentModal({ invoice, open, onClose, onSuccess }) {
  const { user } = useAuth()
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [amountReceived, setAmountReceived] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (invoice && open) {
      setPaymentDate(new Date().toISOString().split('T')[0])
      setPaymentReference('')
      setAmountReceived(Number(invoice.expected_receipt_ghs ?? 0))
      setError(null)
    }
  }, [invoice, open])

  const expectedReceipt = useMemo(
    () => Number(invoice?.expected_receipt_ghs ?? 0),
    [invoice]
  )

  const variance = useMemo(() => Number(amountReceived) - expectedReceipt, [amountReceived, expectedReceipt])
  const variancePercent = useMemo(
    () => (expectedReceipt ? Math.abs(variance) / expectedReceipt * 100 : 0),
    [variance, expectedReceipt]
  )

  const varianceStyle = variancePercent > 5
    ? 'border-red-500/30 bg-red-500/10 text-red-300'
    : 'border-amber-400/30 bg-amber-500/10 text-amber-300'

  const handleSubmit = async () => {
    setError(null)

    if (!paymentReference.trim()) {
      setError('Payment reference is required.')
      return
    }

    if (Number(amountReceived) <= 0) {
      setError('Amount received must be greater than zero.')
      return
    }

    if (!user?.id) {
      setError('Authentication is required to record payment.')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('record_invoice_payment', {
        invoice_uuid: invoice.id,
        payment_date_val: paymentDate,
        payment_reference_val: paymentReference,
        amount_received_ghs: Number(amountReceived),
        acting_user_id: user.id,
      })

      if (error) {
        throw error
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to record payment')
      }

      onSuccess?.(invoice.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Unable to record payment')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !invoice) {
    return null
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      size="lg"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Payment Date</span>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-400/50 focus:bg-white/10 outline-none"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Payment Reference</span>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Bank transfer reference"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-400/50 focus:bg-white/10 outline-none"
            />
          </label>
        </div>

        <label className="space-y-2 text-sm text-slate-300">
          <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Amount Received (GHS)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-400/50 focus:bg-white/10 outline-none"
          />
        </label>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-slate-400">Expected Receipt</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-300">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'GHS',
              minimumFractionDigits: 2,
            }).format(expectedReceipt)}
          </div>
        </div>

        <div className={`rounded-2xl border px-4 py-4 ${varianceStyle}`}>
          <div className="text-sm font-medium">FX Variance</div>
          <div className="mt-2 text-lg font-semibold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'GHS',
              minimumFractionDigits: 2,
            }).format(variance)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {variancePercent.toFixed(2)}% difference
          </div>
        </div>
      </div>
    </Modal>
  )
}
