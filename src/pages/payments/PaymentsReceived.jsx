import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getDebtorList,
  getClientOutstandingInvoices,
  getClientStatement,
  getPaymentAccounts,
  recordPayment,
} from '../../services/paymentService'

const STATUS_BADGES = {
  partially_paid: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  sent: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
}

const PAYMENT_ACCOUNT_SELECT_CLASS = 'text-white bg-slate-800 border border-border-soft rounded-xl px-3 py-2 outline-none'
const AMOUNT_INPUT_CLASS = 'text-white bg-slate-800 border border-border-soft rounded-xl px-3 py-2 outline-none w-full'

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
      await recordPayment({
        clientId: selectedClient.id,
        paymentDate,
        paymentReference: paymentReference.trim(),
        paymentAccountCode: selectedAccount.account_code,
        paymentAccountName: selectedAccount.account_name,
        invoiceAllocations: allocations.map(({ invoiceId, invoiceNumber, amount }) => ({ invoiceId, invoiceNumber, amount })),
        totalAmount,
        recordedBy: profile.id,
      })

      setSuccessMessage('Payment recorded successfully.')
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Payments Received</h1>
          <p className="text-sm text-slate-400">Manage incoming client receipts and view account statements.</p>
        </div>
        {successMessage && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border-soft bg-slate-900/80 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Debtor List</h2>
            <p className="text-sm text-slate-400">Clients with outstanding invoices.</p>
          </div>
        </div>

        {debtorsError && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{debtorsError}</div>
        )}

        <div className="mt-6 overflow-x-auto rounded-3xl border border-border-soft bg-slate-950/40">
          <table className="min-w-full text-sm text-slate-300">
            <thead className="border-b border-border-soft bg-slate-900/80 text-left text-xs uppercase tracking-[0.24em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Client Name</th>
                <th className="px-4 py-3">Total Outstanding Balance (GHS)</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingDebtors ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Loading…</td>
                </tr>
              ) : debtors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No debtors found.</td>
                </tr>
              ) : (
                debtors.map((debtor) => (
                  <tr key={debtor.id} className="border-b border-border-soft hover:bg-white/5 transition">
                    <td className="px-4 py-4 font-medium text-white">{debtor.name ?? 'Unknown'}</td>
                    <td className="px-4 py-4">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(debtor.total_outstanding_balance || 0))}</td>
                    <td className="px-4 py-4 flex flex-wrap gap-2">
                      {isAccountant && (
                        <button
                          type="button"
                          onClick={() => openRecordPayment(debtor)}
                          className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openStatement(debtor)}
                        className="rounded-xl border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-border-soft bg-slate-900/95 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-border-soft px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Record Payment</h2>
                <p className="text-sm text-slate-400">Allocate payment to outstanding invoices for {selectedClient?.name}.</p>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                className="rounded-full border border-border-soft bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-sm text-slate-200">
                  <span>Payment Date</span>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200 md:col-span-2">
                  <span>Payment Reference</span>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="Enter payment reference"
                    className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-200">
                  <span>Payment Account</span>
                  <select
                    value={selectedPaymentAccount}
                    onChange={(event) => setSelectedPaymentAccount(event.target.value)}
                    className={PAYMENT_ACCOUNT_SELECT_CLASS}
                  >
                    {paymentAccounts.map((account) => (
                      <option key={account.account_code} value={account.account_code} className="bg-slate-900 text-white">
                        {account.account_code} — {account.account_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2 text-sm text-slate-200">
                  <span>Total Allocated</span>
                  <div className="rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white">
                    {new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(totalAllocated)}
                  </div>
                </div>
              </div>

              {paymentError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{paymentError}</div>
              )}

              <div className="overflow-x-auto rounded-3xl border border-border-soft bg-slate-950/40">
                <table className="min-w-full text-sm text-slate-300">
                  <thead className="border-b border-border-soft bg-slate-900/80 text-left text-xs uppercase tracking-[0.24em] text-slate-500">
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
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading invoices…</td>
                      </tr>
                    ) : outstandingInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No outstanding invoices found.</td>
                      </tr>
                    ) : (
                      outstandingInvoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-border-soft hover:bg-white/5 transition">
                          <td className="px-4 py-4">
                            <div className="font-medium text-white">{invoice.invoice_number}</div>
                            <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${STATUS_BADGES[invoice.status] ?? 'border-border-soft bg-white/5 text-slate-300'}`}>
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
                  className="rounded-xl border border-border-soft bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPayment}
                  disabled={paymentLoading}
                  className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paymentLoading ? 'Submitting…' : 'Submit Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-border-soft bg-slate-900/95 shadow-2xl shadow-black/40">
            <div className="flex flex-col gap-4 border-b border-border-soft px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Client Statement</h2>
                <p className="text-sm text-slate-400">{statementClient?.name ?? 'Client details will appear here.'}</p>
                {statementClient && (
                  <p className="mt-2 text-sm text-slate-400">{statementClient.contact_person ?? 'No contact'} · {statementClient.contact_phone ?? 'No phone'} · {statementClient.contact_email ?? 'No email'}</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeStatement}
                className="rounded-full border border-border-soft bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              {statementError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{statementError}</div>
              )}

              <div className="overflow-x-auto rounded-3xl border border-border-soft bg-slate-950/40">
                <table className="min-w-full text-sm text-slate-300">
                  <thead className="border-b border-border-soft bg-slate-900/80 text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Invoice Number</th>
                      <th className="px-4 py-3">Debit</th>
                      <th className="px-4 py-3">Credit</th>
                      <th className="px-4 py-3">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading statement…</td>
                      </tr>
                    ) : statementRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No statement records found.</td>
                      </tr>
                    ) : (
                      statementRows.map((row, index) => (
                        <tr key={`${row.type}-${index}`} className="border-b border-border-soft hover:bg-white/5 transition">
                          <td className="px-4 py-4">{row.date}</td>
                          <td className="px-4 py-4">{row.description}</td>
                          <td className="px-4 py-4">{row.invoiceNumber}</td>
                          <td className="px-4 py-4">{row.debit ? new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(row.debit) : '—'}</td>
                          <td className="px-4 py-4">{row.credit ? new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(row.credit) : '—'}</td>
                          <td className="px-4 py-4">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(row.balance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3 rounded-3xl border border-border-soft bg-slate-900/80 px-4 py-4 text-sm text-slate-300">
                <span className="font-semibold text-white">Total Outstanding Balance:</span>
                <span>{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(statementBalance)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
