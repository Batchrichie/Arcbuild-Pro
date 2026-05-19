import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { supabase } from '../../lib/supabase'
import WhtCertificatePdf from './WhtCertificatePdf'

export default function WhtCertificateButton({ supplierId, supplierName, tin, whtRate, uploadedBy }) {
  const [certData, setCertData] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const year = new Date().getFullYear()

  const fetchAndPrepare = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('project_costs')
        .select('id, amount, wht_amount, cost_date, description')
        .eq('supplier_id', supplierId)
        .gte('cost_date', `${year}-01-01`)
        .lte('cost_date', `${year}-12-31`)

      if (fetchError) throw fetchError

      const totalGross = (data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0)
      const totalWHT   = (data ?? []).reduce((s, r) => s + Number(r.wht_amount ?? 0), 0)

      const certificate = {
        year,
        name: supplierName,
        tin: tin || 'N/A',
        wht_rate: whtRate ?? 5,
        total_gross_paid: totalGross,
        total_wht_deducted: totalWHT,
      }

      setCertData(certificate)

      await supabase.from('documents').insert({
        related_type: 'supplier',
        related_id: supplierId,
        document_type: 'WHT Certificate',
        file_name: `WHT-Certificate-${supplierName}-${year}.pdf`,
        file_url: null,
        description: `WHT Certificate for ${supplierName} — ${year}`,
        document_date: new Date().toISOString().split('T')[0],
        uploaded_by: uploadedBy ?? null,
      })
    } catch (err) {
      setError(err.message || 'Failed to prepare certificate')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <button type="button" disabled
        className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 opacity-70">
        Preparing…
      </button>
    )
  }

  if (error) {
    return (
      <button type="button" onClick={fetchAndPrepare}
        className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition">
        Retry Certificate
      </button>
    )
  }

  if (!certData) {
    return (
      <button type="button" onClick={fetchAndPrepare}
        className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition">
        Generate WHT Certificate
      </button>
    )
  }

  return (
    <PDFDownloadLink
      document={<WhtCertificatePdf certificate={certData} />}
      fileName={`WHT-Certificate-${supplierName}-${year}.pdf`}
      className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
    >
      {({ loading: pdfLoading }) => (pdfLoading ? 'Building PDF…' : 'Download WHT Certificate')}
    </PDFDownloadLink>
  )
}
