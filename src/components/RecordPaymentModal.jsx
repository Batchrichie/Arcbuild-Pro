import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from './ui/Modal'
import ScrollableSelect from './ui/ScrollableSelect'
import { usePaymentReceipt } from '../hooks/usePaymentReceipt'
import { getPaymentAccounts } from '../services/chartOfAccountsService'
import { recordPayment } from '../services/paymentService'

const DEFAULT_CASH_ACCOUNT_BY_CURRENCY = {
  GHS: '1101',
  USD: '1102',
  GBP: '1103',
  EUR: '1104',
}

const formatCurrency = (value, currency = 'GHS') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export default function RecordPaymentModal({ invoice, open, onClose, onSuccess }) {
  const { user } = useAuth()
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [amountReceived, setAmountReceived] = useState(0)
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [paymentAccountCode, setPaymentAccountCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState(null)
  const { generateReceipt, generating } = usePaymentReceipt()

  const activeInvoice = invoiceDetail || invoice
  const invoiceCurrency = activeInvoice?.currency || 'GHS'
  const invoiceRate = Number(activeInvoice?.fx_rate_to_ghs ?? 1)
  const expectedReceiptForeign = Number(activeInvoice?.expected_receipt ?? activeInvoice?.gross_total ?? 0)
  const expectedReceiptGhs = Number(
    activeInvoice?.expected_receipt_ghs ?? activeInvoice?.gross_total_ghs ?? (expectedReceiptForeign * invoiceRate)
  )
  const outstandingAmount = expectedReceiptGhs

  const variance = useMemo(
    () => Number(amountReceived) - expectedReceiptGhs,
    [amountReceived, expectedReceiptGhs]
  )

  const variancePercent = useMemo(
    () => (expectedReceiptGhs ? Math.abs(variance) / expectedReceiptGhs * 100 : 0),
    [variance, expectedReceiptGhs]
  )

  const hasFxVariance = Math.abs(variance) > 0.01
  const arCreditAmount = hasFxVariance ? expectedReceiptGhs : Number(amountReceived)
  const fxEntry = hasFxVariance
    ? {
      account_code: variance > 0 ? '4501' : '6303',
      account_name: variance > 0 ? 'FX Gain' : 'FX Loss',
      debit_amount: variance > 0 ? 0 : Math.abs(variance),
      credit_amount: variance > 0 ? Math.abs(variance) : 0,
      description: variance > 0 ? 'Foreign exchange gain' : 'Foreign exchange loss',
    }
    : null

  const varianceStyle = variancePercent > 5
    ? 'border-red-500/30 bg-red-500/10 text-red-300'
    : 'border-amber-400/30 bg-amber-500/10 text-amber-300'

  const selectedAccount = paymentAccounts.find((account) => account.account_code === paymentAccountCode)

  const paymentAccountOptions = useMemo(
    () => [
      { value: '', label: 'Select cash or bank account' },
      ...paymentAccounts.map((account) => ({
        value: account.account_code,
        label: `${account.account_code} — ${account.account_name}`,
      })),
    ],
    [paymentAccounts]
  )

  const loadInvoiceDetails = async () => {
    if (!invoice?.id) return
    setLoadingData(true)
    try {
      const { data, error: invoiceError } = await supabase
        .from('invoices')
        .select(
          `id,invoice_number,currency,fx_rate_to_ghs,fx_rate_date,gross_total,expected_receipt,subtotal,vat_amount,nhil_amount,getfund_amount,gross_total_ghs,expected_receipt_ghs,status,payment_date,payment_reference,client:clients(name),project:projects(name),division:divisions(name)`
        )
        .eq('id', invoice.id)
        .maybeSingle()

      if (invoiceError) {
        throw invoiceError
      }

      if (data) {
        const loadedInvoice = { ...invoice, ...data }
        setInvoiceDetail(loadedInvoice)
        setAmountReceived(Number(loadedInvoice.expected_receipt_ghs ?? loadedInvoice.gross_total_ghs ?? 0))
        setPaymentReference(loadedInvoice.payment_reference ?? '')
      }
    } catch (loadError) {
      setError(loadError.message || 'Failed to load invoice details')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (!invoiceDetail || paymentAccounts.length === 0) return
    const defaultAccount = DEFAULT_CASH_ACCOUNT_BY_CURRENCY[invoiceDetail.currency] || paymentAccounts[0]?.account_code
    const isStaleDefault = paymentAccountCode === DEFAULT_CASH_ACCOUNT_BY_CURRENCY.GHS && invoiceDetail.currency !== 'GHS'
    if (!paymentAccountCode || !paymentAccounts.some((account) => account.account_code === paymentAccountCode) || isStaleDefault) {
      setPaymentAccountCode(defaultAccount)
    }
  }, [invoiceDetail, paymentAccounts, paymentAccountCode])

  const loadPaymentAccounts = async () => {
    if (!open) return
    try {
      const accounts = await getPaymentAccounts()
      setPaymentAccounts(accounts)

      const defaultAccountCode = DEFAULT_CASH_ACCOUNT_BY_CURRENCY[invoiceCurrency]
      const defaultAccount = accounts.find((account) => account.account_code === defaultAccountCode) || accounts[0]
      setPaymentAccountCode(defaultAccount?.account_code || '')
    } catch (loadError) {
      setError(loadError.message || 'Failed to load payment accounts')
    }
  }

  useEffect(() => {
    if (!open || !invoice) return
    setError(null)
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentReference('')
    setAmountReceived(Number(invoice.expected_receipt_ghs ?? invoice.gross_total_ghs ?? 0))
    setInvoiceDetail(null)
    setPaymentAccounts([])
    setPaymentAccountCode('')

    loadInvoiceDetails()
    loadPaymentAccounts()
  }, [invoice, open])

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

    if (!paymentAccountCode) {
      setError('Please select a payment account.')
      return
    }

    if (!user?.id) {
      setError('Authentication is required to record payment.')
      return
    }

    setLoading(true)

    try {
      await recordPayment({
        invoice_uuid: invoice.id,
        payment_date_val: paymentDate,
        payment_reference_val: paymentReference,
        amount_received_ghs: Number(amountReceived),
        payment_account_code: paymentAccountCode,
        acting_user_id: user.id,
      })

      generateReceipt({
        invoiceId: invoice.id,
        amountPaid: Number(amountReceived),
        paymentDate,
        paymentReference,
      })

      onSuccess?.(invoice.id)
      onClose()
    } catch (submitError) {
      setError(submitError.message || 'Unable to record payment')
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
            className="rounded-xl border border-border-soft bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || generating || loadingData}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? 'Generating Receipt...' : loading ? 'Recording...' : 'Record Payment'}
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
          <div className="rounded-3xl border border-border-soft bg-slate-950/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Invoice</div>
            <div className="mt-3 text-lg font-semibold text-white">{activeInvoice.invoice_number || 'Untitled'}</div>
            <div className="mt-2 space-y-1 text-sm text-slate-400">
              <div>{activeInvoice.client?.name || 'Unknown client'}</div>
              <div>{activeInvoice.project?.name || 'Unknown project'}</div>
              <div>{activeInvoice.division?.name || 'Unknown division'}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-border-soft bg-slate-950/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Due</div>
            <div className="mt-3 text-lg font-semibold text-white">
              {formatCurrency(outstandingAmount, 'GHS')}
            </div>
            <div className="mt-2 text-sm text-slate-400">{invoiceCurrency} net receipt</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              <span>{invoiceCurrency}</span>
              <span>FX Rate {invoiceRate.toFixed(4)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Payment Reference</span>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-400/50 focus:bg-white/10 outline-none"
              placeholder="Enter payment reference"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Payment Date</span>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-white outline-none"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Payment Account</span>
            <ScrollableSelect
              searchable
              optionLayout="account"
              showValueWhenClosed
              value={paymentAccountCode}
              onChange={setPaymentAccountCode}
              options={paymentAccountOptions}
              placeholder="Select cash or bank account"
              searchPlaceholder="Search accounts…"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Amount Received (GHS)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-400/50 focus:bg-white/10 outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Invoice Currency</div>
            <div className="mt-2 text-lg font-semibold text-white">{invoiceCurrency}</div>
            {invoiceCurrency !== 'GHS' && (
              <div className="mt-1 text-sm text-slate-400">
                {formatCurrency(expectedReceiptForeign, invoiceCurrency)} expected receipt
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Target GHS Receipt</div>
            <div className="mt-2 text-lg font-semibold text-white">{formatCurrency(expectedReceiptGhs, 'GHS')}</div>
          </div>

          <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Outstanding</div>
            <div className="mt-2 text-lg font-semibold text-white">{formatCurrency(outstandingAmount, 'GHS')}</div>
            <div className="mt-1 text-sm text-slate-400">This invoice will be marked paid after recording.</div>
          </div>
        </div>

        <div className={`rounded-2xl border px-4 py-4 ${varianceStyle}`}>
          <div className="text-sm font-medium">FX Variance</div>
          <div className="mt-2 text-lg font-semibold">
            {formatCurrency(variance, 'GHS')}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {variancePercent.toFixed(2)}% difference from expected receipt
          </div>
          {hasFxVariance && (
            <div className="mt-3 text-sm text-slate-300">
              {variance > 0
                ? 'Receivable will be settled and foreign exchange gain posted.'
                : 'Receivable will be settled and foreign exchange loss posted.'}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border-soft bg-slate-950/80 p-4">
          <div className="text-sm font-medium text-slate-200">General Ledger Preview</div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between border-b border-border-soft pb-3">
              <span>Debit: Payment Account</span>
              <span>{formatCurrency(amountReceived, 'GHS')}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border-soft pb-3 pt-3">
              <span>Credit: Accounts Receivable (1110)</span>
              <span>{formatCurrency(arCreditAmount, 'GHS')}</span>
            </div>
            {fxEntry && (
              <div className="flex items-center justify-between pt-3">
                <span>{fxEntry.account_name} ({fxEntry.account_code})</span>
                <span>{fxEntry.debit_amount > 0 ? formatCurrency(fxEntry.debit_amount, 'GHS') : formatCurrency(fxEntry.credit_amount, 'GHS')}</span>
              </div>
            )}
            <div className="rounded-2xl border border-border-soft bg-slate-950/90 p-3 text-xs text-slate-400">
              Selected account: {selectedAccount ? `${selectedAccount.account_code} — ${selectedAccount.account_name}` : 'No account selected'}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
