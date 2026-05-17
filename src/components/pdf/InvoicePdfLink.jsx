import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { supabase } from '../../lib/supabase'
import InvoicePdf from './InvoicePdf'

export default function InvoicePdfLink({ invoiceId, filename }) {
  const [invoiceData, setInvoiceData] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPdfData = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(
          'id,invoice_number,currency,gross_total_ghs,expected_receipt_ghs,status,created_at,due_date,notes, client:clients(name,address,tin,email), project:projects(name), division:divisions(name)'
        )
        .eq('id', invoiceId)
        .single()

      if (invoiceError) throw invoiceError
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .select('description,quantity,unit_price')
        .eq('invoice_id', invoiceId)
        .order('id', { ascending: true })

      if (lineItemsError) throw lineItemsError

      setInvoiceData(invoice)
      setLineItems(lineItemsData || [])
    } catch (err) {
      setError(err.message || 'Unable to load invoice PDF data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <button type="button" disabled className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-100 opacity-70">
        Loading PDF…
      </button>
    )
  }

  if (error) {
    return (
      <button type="button" onClick={fetchPdfData} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20">
        Retry PDF
      </button>
    )
  }

  if (!invoiceData) {
    return (
      <button type="button" onClick={fetchPdfData} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20">
        Download PDF
      </button>
    )
  }

  return (
    <PDFDownloadLink
      document={<InvoicePdf invoice={invoiceData} lineItems={lineItems} client={invoiceData.client} />}
      fileName={filename || `invoice-${invoiceData.invoice_number || invoiceId}.pdf`}
      className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
    >
      {({ loading: pdfLoading }) => (pdfLoading ? 'Preparing PDF…' : 'Download PDF')}
    </PDFDownloadLink>
  )
}
