import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePaymentReceipt } from '../../hooks/usePaymentReceipt'
import {
  getDebtorList,
  getClientOutstandingInvoices,
  getClientStatement,
  getPaymentAccounts,
  recordPayment,
  voidPayment,
} from '../../services/paymentService'

const STATUS_BADGES = {
  partially_paid: 'border-portal-warning bg-portal-warning text-portal-warning',
  sent: 'border-portal-info bg-portal-info text-portal-info',
  paid: 'border-portal-success bg-portal-success text-portal-success',
}

const PAYMENT_ACCOUNT_SELECT_CLASS = 'text-portal-primary bg-portal-input border border-border-soft rounded-xl px-3 py-2 outline-none'
const AMOUNT_INPUT_CLASS = 'text-portal-primary bg-portal-input border border-border-soft rounded-xl px-3 py-2 outline-none w-full'

export default function PaymentsReceived() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAccountant = profile?.role === 'accountant'
  const isCeo = profile?.role === 'ceo'

  const [debtors, setDebtors] = useState([])
  const [loadingDebtors, setLoadingDebtors] = useState(true)
  const [debtorsError, setDebtorsError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [outstandingInvoices, setOutstandingInvoices] = useState([])
  const [outstandingLoading, setOutstandingLoading] = useState(false)
  const [invoiceAllocations, setInvoiceAllocations] = useState({})
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState('')
  const [paymentError, setPaymentError] = useState(null)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const [statementOpen, setStatementOpen] = useState(false)
  const [statementClient, setStatementClient] = useState(null)
  const [statementRows, setStatementRows] = useState([])
  const [statementBalance, setStatementBalance] = useState(0)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementError, setStatementError] = useState(null)
  const [voidModalOpen, setVoidModalOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState('')
  const [voidLoading, setVoidLoading] = useState(false)

  const { generateReceipt } = usePaymentReceipt()

  useEffect(() => {
    if (profile && !isAccountant && !isCeo) {
      navigate('/unauthorized', { replace: true })
    }
  }, [profile, isAccountant, isCeo, navigate])

  useEffect(() => {
    loadDebtors()
    loadPaymentAccounts()
  }, [])

  async function loadDebtors() {
    setLoadingDebtors(true)
    setDebtorsError(null)
    setSuccessMessage('')
    try {
      const data = await getDebtorList()
      setDebtors(data)
    } catch (err) {
      setDebtorsError(err.message)
    } finally {
      setLoadingDebtors(false)
    }
  }

  async function loadPaymentAccounts() {
    try {
      const accounts = await getPaymentAccounts()
      setPaymentAccounts(accounts)
      if (accounts.length > 0) {
        setSelectedPaymentAccount(accounts[0].account_code)
      }
    } catch (err) {
      console.error(err)
    }
  }

  function openRecordPayment(client) {
    setSelectedClient(client)
    setInvoiceAllocations({})
    setPaymentReference('')
    setPaymentError(null)
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentModalOpen(true)
    loadOutstandingInvoices(client.id)
  }

  async function loadOutstandingInvoices(clientId) {
    setOutstandingLoading(true)
    try {
      const invoices = await getClientOutstandingInvoices(clientId)
      setOutstandingInvoices(invoices)
      setInvoiceAllocations(
        invoices.reduce((state, invoice) => {
          state[invoice.id] = 0
          return state
        }, {})
      )
    } catch (err) {
      setPaymentError(err.message)
    } finally {
      setOutstandingLoading(false)
    }
  }

  function closePaymentModal() {
    setPaymentModalOpen(false)
    setOutstandingInvoices([])
    setSelectedClient(null)
    setPaymentError(null)
  }

  function handleAllocationChange(invoiceId, value) {
    const cleaned = value === '' ? '' : value.replace(/[^0-9.]/g, '')
    setInvoiceAllocations((prev) => ({
      ...prev,
      [invoiceId]: cleaned,
    }))
  }

  const totalAllocated = useMemo(() => {
    return outstandingInvoices.reduce((sum, invoice) => {
      const amount = Number(invoiceAllocations[invoice.id] || 0)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)
  }, [outstandingInvoices, invoiceAllocations])

  async function submitPayment() {
    setPaymentError(null)

    if (!selectedPaymentAccount) {
      setPaymentError('Select a payment account.')
      return
    }

    if (!paymentReference.trim()) {
      setPaymentError('Payment reference is required.')
      return
    }

    const allocations = outstandingInvoices
      .map((invoice) => ({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount: Number(invoiceAllocations[invoice.id] || 0),
        balance_due: Number(invoice.balance_due || 0),
      }))
      .filter((allocation) => allocation.amount > 0)

    if (allocations.length === 0) {
      setPaymentError('Enter at least one allocation amount.')
      return
    }

    for (const allocation of allocations) {
      if (allocation.amount > allocation.balance_due + 0.001) {
        setPaymentError(`Allocation for ${allocation.invoiceNumber} exceeds balance due.`)
        return
      }
    }

    const totalAmount = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    if (totalAmount <= 0) {
      setPaymentError('Total allocated amount must be greater than zero.')
      return
    }

    const selectedAccount = paymentAccounts.find((account) => account.account_code === selectedPaymentAccount)
    if (!selectedAccount) {
      setPaymentError('Selected payment account is invalid.')
      return
    }

    setPaymentLoading(true)
    try {
      const result = await recordPayment({
        clientId: selectedClient.id,
        paymentDate,
        paymentReference: paymentReference.trim(),
        paymentAccountCode: selectedAccount.account_code,
        paymentAccountName: selectedAccount.account_name,
        invoiceAllocations: allocations.map(({ invoiceId, invoiceNumber, amount }) => ({ invoiceId, invoiceNumber, amount })),
        totalAmount,
        recordedBy: profile.id,
      })

      if (result.pendingApproval) {
        setSuccessMessage('Payment recorded and queued for director approval before GL posting.')
      } else {
        for (const allocation of allocations) {
          try {
            await generateReceipt({
              invoiceId: allocation.invoiceId,
              amountPaid: allocation.amount,
              paymentDate,
              paymentReference: paymentReference.trim(),
            })
          } catch {
            // Receipt download is best-effort; payment is already recorded.
          }
        }
        setSuccessMessage('Payment recorded successfully. Receipt PDF(s) downloaded where applicable.')
      }
      closePaymentModal()
      await loadDebtors()
    } catch (err) {
      setPaymentError(err.message)
    } finally {
      setPaymentLoading(false)
    }
  }

  function openStatement(client) {
    setStatementOpen(true)
    setStatementClient(null)
    setStatementRows([])
    setStatementBalance(0)
    setStatementError(null)
    loadClientStatement(client.id)
  }

  async function loadClientStatement(clientId) {
    setStatementLoading(true)
    setStatementError(null)
    try {
      const { client, invoices, payments } = await getClientStatement(clientId)
      const combined = [
        ...((invoices ?? []).map((invoice) => ({
          type: 'invoice',
          date: invoice.created_at?.slice(0, 10),
          description: 'Invoice Raised',
          invoiceNumber: invoice.invoice_number,
          debit: Number(invoice.expected_receipt_ghs || 0),
          credit: 0,
        }))),
        ...((payments ?? []).map((payment) => ({
          type: 'payment',
          date: payment.payment_date,
          description: `Payment Received — ${payment.payment_reference}`,
          invoiceNumber: payment.invoice?.invoice_number ?? '—',
          debit: 0,
          credit: Number(payment.amount_ghs || 0),
          journalStatus: payment.journal?.status || null,
          paymentRow: payment,
        }))),
      ].sort((a, b) => {
        if (a.date === b.date) {
          if (a.type === b.type) return 0
          return a.type === 'invoice' ? -1 : 1
        }
        return new Date(a.date) - new Date(b.date)
      })

      let runningBalance = 0
      const rows = combined.map((row) => {
        runningBalance += Number(row.debit || 0) - Number(row.credit || 0)
        return {
          ...row,
          balance: runningBalance,
        }
      })

      setStatementClient(client)
      setStatementRows(rows)
      setStatementBalance(runningBalance)
    } catch (err) {
      setStatementError(err.message)
    } finally {
      setStatementLoading(false)
    }
  }

  function closeStatement() {
    setStatementOpen(false)
    setStatementClient(null)
    setStatementRows([])
    setStatementBalance(0)
  }

  async function confirmVoid() {
    if (!voidTarget) return
    if (!voidReason || voidReason.trim().length < 5) {
      setVoidError('Reason is required and must be at least 5 characters.')
      return
    }
    if (!profile?.id) {
      setVoidError('Unable to identify your profile. Please sign in again.')
      return
    }

    setVoidLoading(true)
    setVoidError('')
    try {
      await voidPayment(voidTarget.id, profile.id, voidReason.trim())
      setVoidModalOpen(false)
      setVoidTarget(null)
      setSuccessMessage('Payment voided successfully.')
      await loadDebtors()
      await loadClientStatement(statementClient?.id)
    } catch (err) {
      console.error('Failed to void payment', err)
      setVoidError(err.message || 'Unable to void payment.')
    } finally {
      setVoidLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-portal-primary">Payments Received</h1>
          <p className="text-sm text-portal-muted">Manage incoming client receipts and view account statements.</p>
        </div>
        {successMessage && (
          <div className="rounded-2xl border border-portal-success bg-portal-success px-4 py-3 text-sm text-portal-success">
            {successMessage}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border-soft bg-portal-surface-2 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-portal-primary">Debtor List</h2>
            <p className="text-sm text-portal-muted">Clients with outstanding invoices.</p>
          </div>
        </div>

        {debtorsError && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{debtorsError}</div>
        )}

        <div className="mt-6 overflow-x-auto rounded-3xl border border-border-soft bg-portal-surface-2">
          <table className="min-w-full text-sm text-portal-muted">
            <thead className="border-b border-border-soft bg-portal-surface-2 text-left text-xs uppercase tracking-[0.24em] text-portal-muted">
              <tr>
                <th className="px-4 py-3">Client Name</th>
                <th className="px-4 py-3">Total Outstanding Balance (GHS)</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingDebtors ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-portal-muted">Loading…</td>
                </tr>
              ) : debtors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-portal-muted">No debtors found.</td>
                </tr>
              ) : (
                debtors.map((debtor) => (
                  <tr key={debtor.id} className="border-b border-border-soft hover:bg-portal-overlay transition">
                    <td className="px-4 py-4 font-medium text-portal-primary">{debtor.name ?? 'Unknown'}</td>
                    <td className="px-4 py-4">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(debtor.total_outstanding_balance || 0))}</td>
                    <td className="px-4 py-4 flex flex-wrap gap-2">
                      {isAccountant && (
                        <button
                          type="button"
                          onClick={() => openRecordPayment(debtor)}
                          className="rounded-xl border border-portal-success bg-portal-success px-4 py-2 text-sm font-semibold text-portal-success hover:bg-portal-success/20 transition"
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openStatement(debtor)}
                        className="rounded-xl border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted-strong hover:bg-portal-overlay transition"
                      >
                        View Statement
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-portal-backdrop p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-auto rounded-3xl border border-border-soft bg-portal-surface-2 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-border-soft px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-portal-primary">Record Payment</h2>
                <p className="text-sm text-portal-muted">Allocate payment to outstanding invoices for {selectedClient?.name}.</p>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                className="rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-sm text-portal-muted-strong hover:bg-portal-overlay transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-sm text-portal-muted-strong">
                  <span>Payment Date</span>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className="w-full rounded-xl border border-border-soft bg-portal-input px-3 py-2 text-portal-primary outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-portal-muted-strong md:col-span-2">
                  <span>Payment Reference</span>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="Enter payment reference"
                    className="w-full rounded-xl border border-border-soft bg-portal-input px-3 py-2 text-portal-primary outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-portal-muted-strong">
                  <span>Payment Account</span>
                  <select
                    value={selectedPaymentAccount}
                    onChange={(event) => setSelectedPaymentAccount(event.target.value)}
                    className={PAYMENT_ACCOUNT_SELECT_CLASS}
                  >
                    {paymentAccounts.map((account) => (
                      <option key={account.account_code} value={account.account_code} className="bg-portal-surface-2 text-portal-primary">
                        {account.account_code} — {account.account_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2 text-sm text-portal-muted-strong">
                  <span>Total Allocated</span>
                  <div className="rounded-xl border border-border-soft bg-portal-input px-3 py-2 text-portal-primary">
                    {new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(totalAllocated)}
                  </div>
                </div>
              </div>

              {paymentError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{paymentError}</div>
              )}

              <div className="overflow-x-auto rounded-3xl border border-border-soft bg-portal-surface-2">
                <table className="min-w-full text-sm text-portal-muted">
                  <thead className="border-b border-border-soft bg-portal-surface-2 text-left text-xs uppercase tracking-[0.24em] text-portal-muted">
                    <tr>
                      <th className="px-4 py-3">Invoice Number</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Balance Due (GHS)</th>
                      <th className="px-4 py-3">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-portal-muted">Loading invoices…</td>
                      </tr>
                    ) : outstandingInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-portal-muted">No outstanding invoices found.</td>
                      </tr>
                    ) : (
                      outstandingInvoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-border-soft hover:bg-portal-overlay transition">
                          <td className="px-4 py-4">
                            <div className="font-medium text-portal-primary">{invoice.invoice_number}</div>
                            <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${STATUS_BADGES[invoice.status] ?? 'border-border-soft bg-portal-overlay text-portal-muted'}`}>
                              <span>{invoice.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">{invoice.project?.name ?? '—'}</td>
                          <td className="px-4 py-4">{invoice.due_date ?? '—'}</td>
                          <td className="px-4 py-4">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(invoice.balance_due || 0))}</td>
                          <td className="px-4 py-4 w-36">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={invoiceAllocations[invoice.id] ?? 0}
                              onChange={(event) => handleAllocationChange(invoice.id, event.target.value)}
                              className={AMOUNT_INPUT_CLASS}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="rounded-xl border border-border-soft bg-portal-overlay px-4 py-3 text-sm text-portal-muted-strong hover:bg-portal-overlay transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPayment}
                  disabled={paymentLoading}
                  className="rounded-xl border border-portal-success bg-portal-success px-4 py-3 text-sm font-semibold text-portal-success hover:bg-portal-success/20 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paymentLoading ? 'Submitting…' : 'Submit Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {voidModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-portal-backdrop p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-border-soft bg-portal-surface-2 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-border-soft px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-portal-primary">Void Payment</h2>
                <p className="text-sm text-portal-muted">Provide a reason to void this payment. This will be recorded in the audit log.</p>
              </div>
              <button
                type="button"
                onClick={() => { setVoidModalOpen(false); setVoidTarget(null); setVoidError('') }}
                className="rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-sm text-portal-muted-strong hover:bg-portal-overlay transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <p className="text-sm text-portal-muted">Payment: {voidTarget?.payment_reference ?? voidTarget?.payment_reference}</p>
              <label className="portal-label block space-y-2">
                <span>Reason</span>
                <textarea
                  rows={4}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full rounded-xl border border-border-soft bg-portal-input px-3 py-2 text-portal-primary outline-none"
                  placeholder="Enter a reason (required)"
                />
              </label>
              {voidError && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{voidError}</div>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setVoidModalOpen(false); setVoidTarget(null); setVoidError('') }}
                  className="rounded-xl border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted-strong hover:bg-portal-overlay transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmVoid}
                  disabled={voidLoading}
                  className="rounded-xl border border-portal-danger bg-portal-danger px-4 py-2 text-sm font-semibold text-portal-danger hover:bg-portal-danger disabled:opacity-60"
                >
                  {voidLoading ? 'Voiding…' : 'Confirm Void'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-portal-backdrop p-4">
          <div className="flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border-soft bg-portal-surface-2 shadow-2xl shadow-black/40">
            <div className="shrink-0 flex flex-col gap-4 border-b border-border-soft px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-portal-primary">Client Statement</h2>
                <p className="text-sm text-portal-muted">{statementClient?.name ?? 'Client details will appear here.'}</p>
                {statementClient && (
                  <p className="mt-2 text-sm text-portal-muted">{statementClient.contact_person ?? 'No contact'} · {statementClient.contact_phone ?? 'No phone'} · {statementClient.contact_email ?? 'No email'}</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeStatement}
                className="rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-sm text-portal-muted-strong hover:bg-portal-overlay transition"
              >
                Close
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-6">
              {statementError && (
                <div className="shrink-0 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{statementError}</div>
              )}

              <div className="min-h-0 flex-1 overflow-auto rounded-3xl border border-border-soft bg-portal-surface-2">
                <table className="min-w-full text-sm text-portal-muted">
                  <thead className="border-b border-border-soft bg-portal-surface-2 text-left text-xs uppercase tracking-[0.24em] text-portal-muted">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Invoice Number</th>
                      <th className="px-4 py-3">Debit</th>
                      <th className="px-4 py-3">Credit</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-portal-muted">Loading statement…</td>
                      </tr>
                    ) : statementRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-portal-muted">No statement records found.</td>
                      </tr>
                    ) : (
                      statementRows.map((row, index) => (
                        <tr key={`${row.type}-${index}`} className="border-b border-border-soft hover:bg-portal-overlay transition">
                          <td className="px-4 py-4">{row.date}</td>
                          <td className="px-4 py-4">{row.description}</td>
                              <td className="px-4 py-4">{row.invoiceNumber}</td>
                              <td className="px-4 py-4">{row.debit ? new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(row.debit) : '—'}</td>
                              <td className="px-4 py-4">{row.credit ? new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(row.credit) : '—'}</td>
                              <td className="px-4 py-4">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(row.balance)}</td>
                              <td className="px-4 py-4">
                                {row.type === 'payment' && (
                                  <div className="flex items-center gap-2">
                                    {row.journalStatus === 'REVERSED' ? (
                                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-portal-danger text-portal-danger">VOID</span>
                                    ) : row.journalStatus === 'POSTED' ? (
                                      <button
                                        type="button"
                                        onClick={() => { setVoidTarget(row.paymentRow); setVoidReason(''); setVoidError(''); setVoidModalOpen(true) }}
                                        className="min-touch rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-xs text-portal-muted-strong transition hover:border-portal-danger hover:text-portal-danger"
                                      >
                                        Void
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="shrink-0 flex items-center justify-end gap-3 rounded-3xl border border-border-soft bg-portal-surface-2 px-4 py-4 text-sm text-portal-muted">
                <span className="font-semibold text-portal-primary">Total Outstanding Balance:</span>
                <span>{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(statementBalance)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
