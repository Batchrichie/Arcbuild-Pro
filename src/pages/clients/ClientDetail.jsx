import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getClientById, getClientAgeing } from '../../services/clientService'

const STATUS_STYLE = {
  Active:      'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Inactive:    'bg-slate-500/10 text-slate-400 border-slate-500/30',
  Blacklisted: 'bg-red-500/10 text-red-300 border-red-500/30',
}

const INVOICE_STATUS_STYLE = {
  draft:    'bg-slate-500/10 text-slate-400',
  approved: 'bg-blue-500/10 text-blue-300',
  sent:     'bg-indigo-500/10 text-indigo-300',
  paid:     'bg-emerald-500/10 text-emerald-300',
  voided:   'bg-red-500/10 text-red-300',
}

export default function ClientDetail({ clientId: clientIdProp, onBack }) {
  const { id: routeId } = useParams()
  const id = clientIdProp || routeId
  const [client, setClient]   = useState(null)
  const [ageing, setAgeing]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [clientData, ageingData] = await Promise.all([
          getClientById(id),
          getClientAgeing(id),
        ])
        setClient(clientData)
        setAgeing(ageingData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className="p-6 text-slate-400">Loading…</div>
  if (error)   return <div className="p-6 text-red-300">{error}</div>
  if (!client) return <div className="p-6 text-slate-400">Client not found.</div>

  const invoices = client.invoices ?? []
  const totalOutstanding = invoices
    .filter(i => ['sent','approved'].includes(i.status))
    .reduce((s, i) => s + Number(i.expected_receipt_ghs ?? 0), 0)

  const fmt = (n) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(n ?? 0)
  const displayClientType = (type) => {
    if (!type) return 'individual'
    const normalized = String(type).toLowerCase()
    if (normalized === 'company' || normalized === 'corporate') return 'corporate'
    if (normalized === 'government') return 'government'
    return normalized === 'individual' ? 'individual' : normalized
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-slate-400 hover:text-white text-sm transition">← Clients</button>
        ) : (
          <Link to="/clients" className="text-slate-400 hover:text-white text-sm transition">← Clients</Link>
        )}
        <h1 className="text-2xl font-semibold text-white">{client.name}</h1>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[client.status] ?? ''}`}>
          {client.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          ['Type',            displayClientType(client.client_type)],
          ['TIN',             client.tin || '—'],
          ['VAT Registered',  client.vat_registered ? 'Yes' : 'No'],
          ['VAT Number',      client.vat_number || '—'],
          ['Contact Person',  client.contact_person || '—'],
          ['Phone',           client.contact_phone || '—'],
          ['Email',           client.contact_email || '—'],
          ['Address',         client.address || '—'],
          ['Region',          client.region || '—'],
          ['Country',         client.country || '—'],
          ['Currency',        client.currency],
          ['Payment Terms',   `${client.payment_terms ?? 30} days`],
          ['Credit Limit',    fmt(client.credit_limit)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
            <div className="mt-1 text-sm text-white">{value}</div>
          </div>
        ))}
      </div>

      {ageing && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Aged Receivables</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ['Current',   ageing.current],
              ['1–30 days', ageing.days_1_30],
              ['31–60 days',ageing.days_31_60],
              ['61–90 days',ageing.days_61_90],
              ['90+ days',  ageing.days_90_plus],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold text-white">{fmt(value)}</div>
              </div>
            ))}
          </div>
          <div className="text-sm text-slate-400">Total Outstanding: <span className="text-white font-semibold">{fmt(totalOutstanding)}</span></div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Invoices</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm text-slate-300">
            <thead className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                {['Invoice #','Status','Amount','Currency','Issue Date','Due Date','Payment Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No invoices found.</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-4 py-3 font-medium text-white">{inv.invoice_number}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_STYLE[inv.status] ?? ''}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{fmt(inv.expected_receipt_ghs)}</td>
                  <td className="px-4 py-3">{inv.currency}</td>
                  <td className="px-4 py-3">{inv.created_at ?? '—'}</td>
                  <td className="px-4 py-3">{inv.due_date ?? '—'}</td>
                  <td className="px-4 py-3">{inv.payment_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {client.notes && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Notes</div>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{client.notes}</p>
        </div>
      )}
    </div>
  )
}