import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useClient } from '../../context/ClientContext'
import { formatGhs, INVOICE_STATUS_STYLE } from '../../lib/client-utils'
import InvoicePdfLink from '../pdf/InvoicePdfLink'

export default function ClientInvoices() {
  const { clientId } = useClient()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, project_id, created_at, due_date, gross_total_ghs, expected_receipt_ghs, status, projects(name)')
      .eq('client_id', clientId)
      .in('status', ['approved', 'sent', 'paid'])
      .order('created_at', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    load()
  }, [load])

  const outstanding = rows
    .filter((r) => r.status === 'sent')
    .reduce((s, r) => s + Number(r.expected_receipt_ghs || r.gross_total_ghs || 0), 0)

  return (
    <div className="space-y-6">
      <div className="client-card border-teal-100 bg-teal-50/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Outstanding balance</p>
        <p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '—' : formatGhs(outstanding)}</p>
        <p className="mt-1 text-sm text-slate-600">Total sent invoices awaiting payment</p>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      ) : rows.length === 0 ? (
        <p className="text-center text-slate-500">No invoices available yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount (GHS)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.invoice_number}</td>
                  <td className="px-4 py-3 text-slate-600">{row.projects?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(row.created_at).toLocaleDateString('en-GH')}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatGhs(row.gross_total_ghs)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${INVOICE_STATUS_STYLE[row.status] || ''}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.due_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <InvoicePdfLink invoiceId={row.id} filename={`invoice-${row.invoice_number}.pdf`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
