import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

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
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Record Payment</h2>
            <p className="text-sm text-slate-500">Invoice {invoice.invoice_number}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Payment Date</span>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span>Payment Reference</span>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Bank transfer reference"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-slate-700">
            <span>Amount Received (GHS)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          <div className="rounded-2xl border p-4">
            <div className="text-sm text-slate-500">Expected Receipt</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'GHS',
                minimumFractionDigits: 2,
              }).format(expectedReceipt)}
            </div>
          </div>

          <div className={`rounded-2xl border px-4 py-3 ${varianceStyle}`}>
            <div className="text-sm font-medium">FX variance</div>
            <div className="mt-1 text-lg">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'GHS',
                minimumFractionDigits: 2,
              }).format(variance)}
            </div>
            <div className="text-sm text-slate-600">
              {variancePercent.toFixed(2)}% difference
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
