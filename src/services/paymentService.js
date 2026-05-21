import { supabase } from '../lib/supabase'

async function resolveProfileId(userId) {
  if (userId) {
    const { data: profileById, error: profileByIdError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (profileByIdError) throw profileByIdError
    if (profileById) return profileById.id

    const { data: profileByAuthUser, error: profileByAuthUserError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (profileByAuthUserError) throw profileByAuthUserError
    return profileByAuthUser?.id
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) throw sessionError
  if (!session?.user?.id) throw new Error('Unable to resolve current user profile ID.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (profileError) throw profileError
  if (!profile) throw new Error('No profile found for current user.')

  return profile.id
}

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
  invoice_uuid,
  payment_date_val,
  payment_reference_val,
  amount_received_ghs,
  payment_account_code,
  acting_user_id,
}) {
  if (invoice_uuid) {
    paymentDate = paymentDate || payment_date_val
    paymentReference = paymentReference || payment_reference_val
    paymentAccountCode = paymentAccountCode || payment_account_code
    recordedBy = recordedBy || acting_user_id
    totalAmount = totalAmount ?? (amount_received_ghs !== undefined ? Number(amount_received_ghs) : undefined)
    invoiceAllocations = invoiceAllocations && invoiceAllocations.length > 0
      ? invoiceAllocations
      : [{ invoiceId: invoice_uuid, amount: Number(amount_received_ghs ?? totalAmount ?? 0) }]
  }

  if (!clientId && !invoice_uuid) throw new Error('Client ID is required.')
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

  if (allocations.some((allocation) => !allocation.invoiceId || allocation.amount <= 0)) {
    throw new Error('Each invoice allocation must include invoiceId and amount > 0.')
  }

  if (!paymentAccountName && paymentAccountCode) {
    const { data: accountData, error: accountError } = await supabase
      .from('chart_of_accounts')
      .select('account_name')
      .eq('account_code', paymentAccountCode)
      .maybeSingle()

    if (accountError) throw accountError
    paymentAccountName = accountData?.account_name
  }

  if (!paymentAccountName) {
    throw new Error('Payment account name is required.')
  }

  const allocationSum = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  if (Number(allocationSum.toFixed(2)) !== Number(amountTotal.toFixed(2))) {
    throw new Error('Total amount must equal the sum of invoice allocation amounts.')
  }

  const invoiceIds = [...new Set(allocations.map((allocation) => allocation.invoiceId))]
  const { data: invoices, error: invoiceFetchError } = await supabase
    .from('invoices')
    .select('id, invoice_number, balance_due, expected_receipt_ghs, amount_paid, client_id, project_id, division_id, currency, status')
    .in('id', invoiceIds)

  if (invoiceFetchError) throw invoiceFetchError
  if (!invoices || invoices.length !== invoiceIds.length) {
    throw new Error('One or more invoice allocations refer to invoices that could not be found.')
  }

  const invoiceById = invoices.reduce((acc, invoice) => {
    acc[invoice.id] = invoice
    return acc
  }, {})

  if (!clientId) {
    const clientIds = new Set(invoices.map((invoice) => invoice.client_id))
    if (clientIds.size > 1) {
      throw new Error('Payment allocations must belong to the same client.')
    }
    clientId = invoices[0]?.client_id
  }

  for (const allocation of allocations) {
    const invoice = invoiceById[allocation.invoiceId]
    if (!invoice) continue

    allocation.invoiceNumber = allocation.invoiceNumber || invoice.invoice_number
    allocation.invoice = invoice

    const balanceDue = Number(invoice.balance_due ?? 0)
    if (allocation.amount > balanceDue + 0.001) {
      throw new Error(`Allocation amount for invoice ${allocation.invoiceNumber} exceeds its balance due.`)
    }
  }

  const profileId = await resolveProfileId(recordedBy)
  const journalEntryPayload = {
    entry_date: paymentDate,
    description: `Payment received — ${paymentReference}`,
    reference: paymentReference,
    source_type: 'payment',
    source_id: invoiceIds.length === 1 ? invoiceIds[0] : null,
    created_by: profileId,
    posted_by: profileId,
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
      description: `Payment received — ${paymentReference}`,
      client_id: clientId,
    },
  ]

  for (const allocation of allocations) {
    const invoice = invoiceById[allocation.invoiceId]
    const balanceDue = Number(invoice.balance_due ?? 0)
    const currentPaid = Number(invoice.amount_paid ?? 0)
    const newAmountPaid = Number((currentPaid + allocation.amount).toFixed(2))
    let newBalanceDue = Number((balanceDue - allocation.amount).toFixed(2))
    if (Math.abs(newBalanceDue) <= 0.01) {
      newBalanceDue = 0
    }
    const newStatus = newBalanceDue <= 0.01 ? 'paid' : 'partially_paid'
    const isLegacyFxPayment = invoice.status === 'sent' && newStatus === 'paid' && currentPaid === 0
    const expectedReceipt = Number(invoice.expected_receipt_ghs ?? 0)
    const fxVariance = isLegacyFxPayment ? allocation.amount - expectedReceipt : 0

    if (isLegacyFxPayment && Math.abs(fxVariance) > 0.01) {
      ledgerEntriesPayload.push({
        journal_entry_id: journalEntry.id,
        account_code: '1110',
        account_name: 'Accounts Receivable',
        debit_amount: 0,
        credit_amount: expectedReceipt,
        description: `Accounts Receivable reduction for invoice ${invoice.invoice_number}`,
        client_id: invoice.client_id,
        project_id: invoice.project_id,
        division_id: invoice.division_id,
        currency: invoice.currency,
        foreign_amount: null,
        fx_rate: null,
      })

      if (fxVariance > 0) {
        ledgerEntriesPayload.push({
          journal_entry_id: journalEntry.id,
          account_code: '4501',
          account_name: 'FX Gain',
          debit_amount: 0,
          credit_amount: fxVariance,
          description: `Foreign exchange gain on invoice payment ${invoice.invoice_number}`,
          client_id: invoice.client_id,
          project_id: invoice.project_id,
          division_id: invoice.division_id,
          currency: invoice.currency,
          foreign_amount: null,
          fx_rate: null,
        })
      } else {
        ledgerEntriesPayload.push({
          journal_entry_id: journalEntry.id,
          account_code: '6303',
          account_name: 'FX Loss',
          debit_amount: Math.abs(fxVariance),
          credit_amount: 0,
          description: `Foreign exchange loss on invoice payment ${invoice.invoice_number}`,
          client_id: invoice.client_id,
          project_id: invoice.project_id,
          division_id: invoice.division_id,
          currency: invoice.currency,
          foreign_amount: null,
          fx_rate: null,
        })
      }
    } else {
      ledgerEntriesPayload.push({
        journal_entry_id: journalEntry.id,
        account_code: '1110',
        account_name: 'Accounts Receivable',
        debit_amount: 0,
        credit_amount: allocation.amount,
        description: `Accounts Receivable reduction for invoice ${invoice.invoice_number}`,
        client_id: invoice.client_id,
        project_id: invoice.project_id,
        division_id: invoice.division_id,
        currency: invoice.currency,
        foreign_amount: null,
        fx_rate: null,
      })
    }
  }

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
        recorded_by: profileId,
      })
      .select('*')
      .single()

    if (paymentError) throw paymentError

    const invoiceUpdatePayload = {
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      last_payment_date: paymentDate,
      last_payment_reference: paymentReference,
      status: newStatus,
    }

    if (newStatus === 'paid') {
      invoiceUpdatePayload.payment_date = paymentDate
      invoiceUpdatePayload.payment_reference = paymentReference
    }

    if (allocation.invoice.status === 'sent' && newStatus === 'paid' && Number(allocation.invoice.amount_paid ?? 0) === 0) {
      invoiceUpdatePayload.fx_gain_loss_ghs = allocation.amount - Number(allocation.invoice.expected_receipt_ghs ?? 0)
    }

    const { error: invoiceUpdateError } = await supabase
      .from('invoices')
      .update(invoiceUpdatePayload)
      .eq('id', allocation.invoiceId)

    if (invoiceUpdateError) throw invoiceUpdateError

    insertedPayments.push(paymentRow)
  }

  const auditPayload = {
    user_id: profileId,
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
