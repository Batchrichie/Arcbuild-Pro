import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { supabase } from '../../lib/supabase'
import { buildInvoicePdfFilename } from '../../lib/invoice-pdf-utils'
import InvoicePdf from './InvoicePdf'

const INVOICE_PDF_SELECT = `
  id,invoice_number,currency,fx_rate_to_ghs,subtotal,vat_amount,nhil_amount,getfund_amount,
  gross_total,wht_amount,expected_receipt,status,created_at,due_date,notes,
  client:clients(name,address,tin,email,region,country),
  project:projects(name),
  division:divisions(name)
`

export default function InvoicePdfLink({ invoiceId, filename }) {
  const [invoiceData, setInvoiceData] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const resolvedFilename =
    filename ||
    (invoiceData
      ? buildInvoicePdfFilename({
          clientName: invoiceData.client?.name,
          projectName: invoiceData.project?.name,
          divisionName: invoiceData.division?.name,
          invoiceNumber: invoiceData.invoice_number,
          notes: invoiceData.notes,
        })
      : `invoice-${invoiceId}.pdf`)

  const fetchPdfData = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(INVOICE_PDF_SELECT)
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
      <button
        type="button"
        disabled
        className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-100 opacity-70"
      >
        Loading PDF…
      </button>
    )
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={fetchPdfData}
        className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
      >
        Retry PDF
      </button>
    )
  }

  if (!invoiceData) {
    return (
      <button
        type="button"
        onClick={fetchPdfData}
        className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
      >
        Download PDF
      </button>
    )
  }

  return (
    <PDFDownloadLink
      document={
        <InvoicePdf
          invoice={invoiceData}
          lineItems={lineItems}
          client={invoiceData.client}
          project={invoiceData.project}
          division={invoiceData.division}
        />
      }
      fileName={resolvedFilename}
      className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
    >
      {({ loading: pdfLoading }) => (pdfLoading ? 'Preparing PDF…' : 'Download PDF')}
    </PDFDownloadLink>
  )
}
