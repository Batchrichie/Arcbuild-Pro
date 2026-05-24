import React, { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { buildReceiptPdfFilename } from '../lib/invoice-pdf-utils'
import { getReceiptData } from '../services/receiptService'
import PaymentReceiptPdf from '../components/pdf/PaymentReceiptPdf'

export function usePaymentReceipt() {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function generateReceipt({ invoiceId, amountPaid, paymentDate, paymentReference }) {
    setGenerating(true)
    setError(null)

    try {
      const receiptData = await getReceiptData(invoiceId)

      const doc = React.createElement(PaymentReceiptPdf, { receiptData, amountPaid, paymentDate, paymentReference })
      const blob = await pdf(doc).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildReceiptPdfFilename({
        clientName: receiptData?.client?.name,
        invoiceNumber: receiptData?.invoice_number || invoiceId,
      })
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()

      // open in new tab for printing
      try { window.open(url, '_blank') } catch { /* ignore */ }

      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      console.error('Receipt generation failed:', err)
      setError(err?.message || String(err))
    } finally {
      setGenerating(false)
    }
  }

  return { generateReceipt, generating, error }
}

export default usePaymentReceipt
