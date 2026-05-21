import { supabase } from '../lib/supabase'

export async function getReceiptData(invoiceId) {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      `id,invoice_number,client_id,project_id,currency,fx_rate_to_ghs,subtotal,vat_amount,nhil_amount,getfund_amount,gross_total,wht_amount,expected_receipt,subtotal_ghs,vat_amount_ghs,nhil_amount_ghs,getfund_amount_ghs,gross_total_ghs,wht_amount_ghs,expected_receipt_ghs,status,due_date,payment_date,payment_reference,notes,retention_rate,retention_withheld,net_payable,created_at,client:clients(name,client_type,address,contact_person,contact_phone,contact_email,tin,region,country),project:projects(name),division:divisions(name)`
    )
    .eq('id', invoiceId)
    .single()

  if (error) throw error
  return data
}

export default { getReceiptData }
