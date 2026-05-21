import { supabase } from '../lib/supabase'

export async function getDebtorList() {
  const { data, error } = await supabase
    .from('invoices')
    .select('client_id, balance_due, client:clients(id, name)')
    .in('status', ['sent', 'partially_paid'])

  if (error) throw error

  const grouped = (data ?? []).reduce((acc, invoice) => {
    const clientId = invoice.client_id
    const clientName = invoice.client?.name ?? 'Unknown'
    const balanceDue = Number(invoice.balance_due ?? 0)

    if (!acc[clientId]) {
      acc[clientId] = {
        id: clientId,
        name: clientName,
        total_outstanding_balance: 0,
      }
    }

    acc[clientId].total_outstanding_balance += balanceDue
    return acc
  }, {})

  return Object.values(grouped)
}

export async function getClientOutstandingInvoices(clientId) {
  if (!clientId) throw new Error('Client ID is required.')

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, created_at, due_date, currency, expected_receipt_ghs, amount_paid, balance_due, status, project:projects(name)')
    .eq('client_id', clientId)
    .in('status', ['sent', 'partially_paid'])
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getClientStatement(clientId) {
  if (!clientId) throw new Error('Client ID is required.')

  const [{ data: client, error: clientError }, { data: invoices, error: invoiceError }, { data: payments, error: paymentError }] = await Promise.all([
    supabase.from('clients').select('id, name, client_type, tin, contact_person, contact_phone, contact_email, credit_limit, payment_terms, currency, vat_registered, vat_number, address, region, country, status, notes').eq('id', clientId).maybeSingle(),
    supabase
      .from('invoices')
      .select('id, invoice_number, created_at, due_date, currency, expected_receipt_ghs, amount_paid, balance_due, status, project:projects(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true }),
    supabase
      .from('invoice_payments')
      .select('id, invoice_id, payment_date, payment_reference, payment_account_code, payment_account_name, amount_ghs, journal_entry_id, recorded_by, notes, created_at, invoice:invoices(invoice_number)')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: true }),
  ])

  if (clientError) throw clientError
  if (invoiceError) throw invoiceError
  if (paymentError) throw paymentError

  return {
    client,
    invoices: invoices ?? [],
    payments: payments ?? [],
  }
}

export async function getPaymentAccounts() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('account_code, account_name')
    .eq('account_type', 'asset')
    .eq('is_active', true)
    .eq('status', 'Active')
    .order('account_code', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function recordPayment({
  clientId,
  paymentDate,
  paymentReference,
  paymentAccountCode,
  paymentAccountName,
  invoiceAllocations,
  totalAmount,
  recordedBy,
}) {
  if (!clientId) throw new Error('Client ID is required.')
  if (!paymentDate) throw new Error('Payment date is required.')
  if (!paymentReference) throw new Error('Payment reference is required.')
  if (!paymentAccountCode) throw new Error('Payment account code is required.')
  if (!Array.isArray(invoiceAllocations) || invoiceAllocations.length === 0) {
    throw new Error('At least one invoice allocation is required.')
  }

  const amountTotal = Number(totalAmount)
  if (!amountTotal || amountTotal <= 0) {
    throw new Error('Total amount must be greater than zero.')
  }

  const allocations = invoiceAllocations.map((allocation) => ({
    invoiceId: allocation.invoiceId,
    invoiceNumber: allocation.invoiceNumber,
    amount: Number(allocation.amount),
  }))

  if (allocations.some((allocation) => !allocation.invoiceId || !allocation.invoiceNumber || allocation.amount <= 0)) {
    throw new Error('Each invoice allocation must include invoiceId, invoiceNumber, and amount > 0.')
  }

  const allocationSum = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  if (Number(allocationSum.toFixed(2)) !== Number(amountTotal.toFixed(2))) {
    throw new Error('Total amount must equal the sum of invoice allocation amounts.')
  }

  const invoiceIds = [...new Set(allocations.map((allocation) => allocation.invoiceId))]
  const { data: invoices, error: invoiceFetchError } = await supabase
    .from('invoices')
    .select('id, invoice_number, balance_due, expected_receipt_ghs, amount_paid')
    .in('id', invoiceIds)

  if (invoiceFetchError) throw invoiceFetchError
  if (!invoices || invoices.length !== invoiceIds.length) {
    throw new Error('One or more invoice allocations refer to invoices that could not be found.')
  }

  const invoiceById = invoices.reduce((acc, invoice) => {
    acc[invoice.id] = invoice
    return acc
  }, {})

  for (const allocation of allocations) {
    const invoice = invoiceById[allocation.invoiceId]
    if (!invoice) continue

    const balanceDue = Number(invoice.balance_due ?? 0)
    if (allocation.amount > balanceDue + 0.001) {
      throw new Error(`Allocation amount for invoice ${allocation.invoiceNumber} exceeds its balance due.`)
    }
  }

  const journalEntryPayload = {
    entry_date: paymentDate,
    description: `Payment received — ${paymentReference}`,
    reference: paymentReference,
    source_type: 'payment',
    created_by: recordedBy,
    posted_by: recordedBy,
    is_posted: true,
  }

  const { data: journalEntry, error: journalError } = await supabase
    .from('journal_entries')
    .insert(journalEntryPayload)
    .select('id')
    .single()

  if (journalError) throw journalError
  if (!journalEntry?.id) throw new Error('Failed to create payment journal entry.')

  const ledgerEntriesPayload = [
    {
      journal_entry_id: journalEntry.id,
      account_code: paymentAccountCode,
      account_name: paymentAccountName,
      debit_amount: amountTotal,
      credit_amount: 0,
      description: `Payment deposit — ${paymentReference}`,
      client_id: clientId,
    },
    {
      journal_entry_id: journalEntry.id,
      account_code: '1110',
      account_name: 'Accounts Receivable',
      debit_amount: 0,
      credit_amount: amountTotal,
      description: `Accounts Receivable settlement — ${paymentReference}`,
      client_id: clientId,
    },
  ]

  const { error: ledgerEntriesError } = await supabase
    .from('ledger_entries')
    .insert(ledgerEntriesPayload)

  if (ledgerEntriesError) throw ledgerEntriesError

  const insertedPayments = []

  for (const allocation of allocations) {
    const invoice = invoiceById[allocation.invoiceId]
    const currentPaid = Number(invoice.amount_paid ?? 0)
    const expectedReceipt = Number(invoice.expected_receipt_ghs ?? 0)
    const newAmountPaid = Number((currentPaid + allocation.amount).toFixed(2))
    let newBalanceDue = Number((expectedReceipt - newAmountPaid).toFixed(2))
    if (Math.abs(newBalanceDue) <= 0.01) {
      newBalanceDue = 0
    }
    const newStatus = newBalanceDue <= 0.01 ? 'paid' : 'partially_paid'

    const { data: paymentRow, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: allocation.invoiceId,
        client_id: clientId,
        payment_date: paymentDate,
        payment_reference: paymentReference,
        payment_account_code: paymentAccountCode,
        payment_account_name: paymentAccountName,
        amount_ghs: allocation.amount,
        journal_entry_id: journalEntry.id,
        recorded_by: recordedBy,
      })
      .select('*')
      .single()

    if (paymentError) throw paymentError

    const { error: invoiceUpdateError } = await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue,
        last_payment_date: paymentDate,
        last_payment_reference: paymentReference,
        status: newStatus,
      })
      .eq('id', allocation.invoiceId)

    if (invoiceUpdateError) throw invoiceUpdateError

    insertedPayments.push(paymentRow)
  }

  const auditPayload = {
    user_id: recordedBy,
    action: 'INSERT',
    table_name: 'invoice_payments',
    record_id: null,
    old_value: null,
    new_value: JSON.stringify({
      clientId,
      paymentDate,
      paymentReference,
      paymentAccountCode,
      paymentAccountName,
      totalAmount: amountTotal,
      invoiceAllocations: allocations,
      journalEntryId: journalEntry.id,
      recordedBy,
    }),
  }

  const { error: auditError } = await supabase.from('audit_log').insert(auditPayload)
  if (auditError) throw auditError

  return {
    journalEntryId: journalEntry.id,
    payments: insertedPayments,
  }
}
