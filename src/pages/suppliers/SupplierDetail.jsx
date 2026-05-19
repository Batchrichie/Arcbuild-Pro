import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useParams, Link } from 'react-router-dom'
import { getSupplierById, getSupplierAgeing } from '../../services/supplierService'
import WhtCertificateButton from '../../components/pdf/WhtCertificateButton'

const STATUS_STYLE = {
  Active:      'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Inactive:    'bg-slate-500/10 text-slate-400 border-slate-500/30',
  Blacklisted: 'bg-red-500/10 text-red-300 border-red-500/30',
}

export default function SupplierDetail() {
  const { profile } = useAuth()
  const { id } = useParams()
  const [supplier, setSupplier] = useState(null)
  const [ageing, setAgeing]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [supplierData, ageingData] = await Promise.all([
          getSupplierById(id),
          getSupplierAgeing(id),
        ])
        setSupplier(supplierData)
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
  if (!supplier) return <div className="p-6 text-slate-400">Supplier not found.</div>

  const costs = supplier.project_costs ?? []
  const fmt   = (n) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(n ?? 0)
  const totalPayable = Object.values(ageing ?? {}).reduce((s, v) => s + v, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/suppliers" className="text-slate-400 hover:text-white text-sm transition">← Suppliers</Link>
        <h1 className="text-2xl font-semibold text-white">{supplier.name}</h1>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[supplier.status] ?? ''}`}>
          {supplier.status}
        </span>
        {supplier.wht_applicable && ['ceo', 'accountant'].includes(profile?.role) && (
          <WhtCertificateButton
            supplierId={supplier.id}
            supplierName={supplier.name}
            tin={supplier.tin}
            whtRate={supplier.wht_rate}
            uploadedBy={profile?.id ?? null}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          ['Type',            supplier.supplier_type],
          ['TIN',             supplier.tin || '—'],
          ['VAT Registered',  supplier.vat_registered ? 'Yes' : 'No'],
          ['VAT Number',      supplier.vat_number || '—'],
          ['WHT Applicable',  supplier.wht_applicable ? 'Yes' : 'No'],
          ['WHT Rate',        supplier.wht_applicable ? `${supplier.wht_rate}%` : 'N/A'],
          ['Contact Person',  supplier.contact_person || '—'],
          ['Phone',           supplier.contact_phone || '—'],
          ['Email',           supplier.contact_email || '—'],
          ['Address',         supplier.address || '—'],
          ['Region',          supplier.region || '—'],
          ['Country',         supplier.country || '—'],
          ['Bank Name',       supplier.bank_name || '—'],
          ['Bank Account',    supplier.bank_account_no || '—'],
          ['Bank Branch',     supplier.bank_branch || '—'],
          ['Currency',        supplier.currency],
          ['Payment Terms',   `${supplier.payment_terms ?? 30} days`],
          ['Credit Limit',    fmt(supplier.credit_limit)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
            <div className="mt-1 text-sm text-white">{value}</div>
          </div>
        ))}
      </div>

      {ageing && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Aged Payables</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ['Current',    ageing.current],
              ['1–30 days',  ageing.days_1_30],
              ['31–60 days', ageing.days_31_60],
              ['61–90 days', ageing.days_61_90],
              ['90+ days',   ageing.days_90_plus],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold text-white">{fmt(value)}</div>
              </div>
            ))}
          </div>
          <div className="text-sm text-slate-400">Total Payable: <span className="text-white font-semibold">{fmt(totalPayable)}</span></div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Linked Project Costs</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm text-slate-300">
            <thead className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                {['Description','Amount','Date','Type','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {costs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No costs linked to this supplier.</td></tr>
              ) : costs.map(c => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-white">{c.description}</td>
                  <td className="px-4 py-3">{fmt(c.amount)}</td>
                  <td className="px-4 py-3">{c.cost_date ?? '—'}</td>
                  <td className="px-4 py-3">{c.cost_type ?? '—'}</td>
                  <td className="px-4 py-3">{c.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {supplier.notes && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Notes</div>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{supplier.notes}</p>
        </div>
      )}
    </div>
  )
}