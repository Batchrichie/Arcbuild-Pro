import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import {
  invoiceOverdueTemplate,
  budgetOverrunTemplate,
  taxDeadlineTemplate,
  contractExpiryTemplate,
} from '../_shared/email-templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYSTEM_ACTOR_ID = Deno.env.get('SYSTEM_ACTOR_ID')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function getRecipientEmails(roles: string[]): Promise<string[]> {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id')
    .in('role', roles)
    .eq('is_active', true)

  if (profileError) throw profileError

  const userIds = (profiles ?? []).map((profile: any) => profile.user_id).filter(Boolean)
  if (userIds.length === 0) return []

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .in('id', userIds)

  if (userError) throw userError

  return (users ?? []).map((user: any) => user.email).filter(Boolean)
}

async function logAlert(type: string, relatedTable: string, relatedId: string, subject: string, recipients: string[]) {
  await supabase.from('alert_log').insert({
    alert_type: type,
    recipient_email: recipients.join(', '),
    subject,
    related_table: relatedTable,
    related_id: relatedId,
    delivery_status: 'sent',
    sent_at: new Date().toISOString(),
  })
}

async function checkOverdueInvoices() {
  const overdueThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, expected_receipt_ghs, due_date, clients(name)')
    .eq('status', 'sent')
    .lte('due_date', overdueThreshold)

  if (error) throw error
  if (!invoices?.length) return

  const recipients = await getRecipientEmails(['accountant'])
  if (!recipients.length) return

  for (const invoice of invoices) {
    const daysOverdue = Math.max(
      0,
      Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
    )

    const subject = `Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue`
    const html = invoiceOverdueTemplate({
      clientName: invoice.clients?.name ?? 'Client',
      invoiceNumber: invoice.invoice_number,
      amount: Number(invoice.expected_receipt_ghs || 0).toLocaleString(),
      daysOverdue,
      dueDate: invoice.due_date ?? 'N/A',
    })

    const sent = await sendEmail({ to: recipients, subject, html })
    if (sent) {
      await logAlert('invoice_overdue', 'invoices', invoice.id, subject, recipients)
    }
  }
}

async function checkBudgetOverruns() {
  const { data: projects, error } = await supabase
    .from('project_finance_summary')
    .select('project_id, project_name, total_budget_ghs, total_costs_ghs')
    .gt('total_costs_ghs', 0)

  if (error) throw error
  if (!projects?.length) return

  const recipients = await getRecipientEmails(['ceo', 'accountant'])
  if (!recipients.length) return

  for (const proj of projects) {
    if (!proj.total_budget_ghs || proj.total_budget_ghs === 0) continue
    const budgetAmount = Number(proj.total_budget_ghs || 0)
    const actualAmount = Number(proj.total_costs_ghs || 0)
    const overrunPct = ((actualAmount - budgetAmount) / budgetAmount) * 100
    if (overrunPct < 10) continue

    const subject = `Budget overrun: ${proj.project_name} is ${overrunPct.toFixed(1)}% over budget`
    const html = budgetOverrunTemplate({
      projectName: proj.project_name,
      costCategory: 'Total',
      budgetAmount: budgetAmount.toLocaleString(),
      actualAmount: actualAmount.toLocaleString(),
      variancePct: overrunPct.toFixed(1),
    })

    const sent = await sendEmail({ to: recipients, subject, html })
    if (sent) {
      await logAlert('budget_overrun', 'project_finance_summary', proj.project_id, subject, recipients)
    }
  }
}

async function checkTaxDeadlines() {
  const today = new Date().toISOString().slice(0, 10)
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: upcoming, error } = await supabase
    .from('tax_calendar')
    .select('*')
    .in('status', ['upcoming', 'due'])
    .gte('due_date', today)
    .lte('due_date', in14Days)

  if (error) throw error
  if (!upcoming?.length) return

  const recipients = await getRecipientEmails(['ceo', 'accountant'])
  if (!recipients.length) return

  for (const tax of upcoming) {
    const daysUntilDue = Math.max(
      0,
      Math.ceil((new Date(tax.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    )
    const subject = `${tax.tax_type} return due in ${daysUntilDue} days — ${tax.period_start}`
    const html = taxDeadlineTemplate({
      taxType: tax.tax_type,
      period: tax.period_start ?? 'Period',
      dueDate: tax.due_date,
      daysUntilDue,
      estimatedAmount: Number(tax.amount_due || 0).toLocaleString(),
    })

    const sent = await sendEmail({ to: recipients, subject, html })
    if (sent) {
      await logAlert('tax_deadline', 'tax_calendar', String(tax.id), subject, recipients)
    }
  }
}

async function checkContractExpiries() {
  const today = new Date().toISOString().slice(0, 10)
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: expiring, error } = await supabase
    .from('employees')
    .select('id, job_title, termination_date, profiles(full_name)')
    .not('termination_date', 'is', null)
    .gte('termination_date', today)
    .lte('termination_date', in30Days)

  if (error) throw error
  if (!expiring?.length) return

  const recipients = await getRecipientEmails(['hr_manager'])
  if (!recipients.length) return

  for (const emp of expiring) {
    const daysUntilExpiry = Math.max(
      0,
      Math.ceil((new Date(emp.termination_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    )
    const subject = `Contract expiry: ${(emp.profiles?.full_name ?? 'Employee')} — ${daysUntilExpiry} days remaining`
    const html = contractExpiryTemplate({
      employeeName: emp.profiles?.full_name ?? 'Employee',
      jobTitle: emp.job_title ?? 'Role',
      expiryDate: emp.termination_date,
      daysUntilExpiry,
    })

    const sent = await sendEmail({ to: recipients, subject, html })
    if (sent) {
      await logAlert('contract_expiry', 'employees', emp.id, subject, recipients)
    }
  }
}

Deno.serve(async () => {
  try {
    await checkOverdueInvoices()
    await checkBudgetOverruns()
    await checkTaxDeadlines()
    await checkContractExpiries()

    return new Response(JSON.stringify({ success: true, ran_at: new Date().toISOString() }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Alert runner error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
