import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { exportToExcel } from '../../utils/exportToExcel'
import { getSuppliers, createSupplier, updateSupplier } from '../../services/supplierService'

const STATUS_STYLE = {
  Active:      'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Inactive:    'bg-slate-500/10 text-slate-400 border-slate-500/30',
  Blacklisted: 'bg-red-500/10 text-red-300 border-red-500/30',
}

const SUPPLIER_TYPE_OPTIONS = ['Vendor', 'Subcontractor', 'Professional Service', 'Utility']
const STATUS_OPTIONS         = ['Active', 'Inactive', 'Blacklisted']
const CURRENCY_OPTIONS       = ['GHS', 'USD', 'GBP', 'EUR']

const WHT_RATE_BY_TYPE = {
  'Vendor': 5.00,
  'Subcontractor': 5.00,
  'Professional Service': 7.50,
  'Utility': 0.00,
}

const EMPTY_FORM = {
  name: '', supplier_type: 'Vendor', tin: '', vat_registered: false, vat_number: '',
  wht_applicable: true, wht_rate: 5.00, payment_terms: 30, currency: 'GHS',
  contact_person: '', contact_phone: '', contact_email: '', address: '', region: '',
  country: 'Ghana', bank_name: '', bank_account_no: '', bank_branch: '',
  credit_limit: 0, status: 'Active', notes: '',
}

export default function SupplierRegistry({ onViewSupplier }) {
  const { profile } = useAuth()
  const canEdit = ['ceo', 'accountant'].includes(profile?.role)

  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]           = useState(1)
  const PAGE_SIZE = 20

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState(null)

  useEffect(() => { loadSuppliers() }, [search, statusFilter])

  async function loadSuppliers() {
    setLoading(true)
    setError(null)
    try {
      const data = await getSuppliers({ search, status: statusFilter || undefined })
      setSuppliers(data)
      setPage(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(supplier) {
    setEditing(supplier)
    setForm({
      name: supplier.name ?? '',
      supplier_type: supplier.supplier_type ?? 'Vendor',
      tin: supplier.tin ?? '',
      vat_registered: supplier.vat_registered ?? false,
      vat_number: supplier.vat_number ?? '',
      wht_applicable: supplier.wht_applicable ?? true,
      wht_rate: supplier.wht_rate ?? 5.00,
      payment_terms: supplier.payment_terms ?? 30,
      currency: supplier.currency ?? 'GHS',
      contact_person: supplier.contact_person ?? '',
      contact_phone: supplier.contact_phone ?? '',
      contact_email: supplier.contact_email ?? '',
      address: supplier.address ?? '',
      region: supplier.region ?? '',
      country: supplier.country ?? 'Ghana',
      bank_name: supplier.bank_name ?? '',
      bank_account_no: supplier.bank_account_no ?? '',
      bank_branch: supplier.bank_branch ?? '',
      credit_limit: supplier.credit_limit ?? 0,
      status: supplier.status ?? 'Active',
      notes: supplier.notes ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  function handleTypeChange(type) {
    setForm(f => ({ ...f, supplier_type: type, wht_rate: WHT_RATE_BY_TYPE[type] ?? 5.00 }))
  }

  async function handleSave() {
    setFormError(null)
    if (!form.name.trim()) { setFormError('Supplier name is required.'); return }
    setSaving(true)
    try {
      if (editing) {
        await updateSupplier(editing.id, form, profile.id)
      } else {
        await createSupplier(form, profile.id)
      }
      setModalOpen(false)
      await loadSuppliers()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const paginated  = suppliers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(suppliers.length / PAGE_SIZE)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Supplier Registry</h1>
        <div className="flex gap-3">
          <button
            onClick={() => exportToExcel(
              suppliers,
              [
                { header: 'Name',            key: 'name' },
                { header: 'Type',            key: 'supplier_type' },
                { header: 'TIN',             key: 'tin' },
                { header: 'Contact Person',  key: 'contact_person' },
                { header: 'Phone',           key: 'contact_phone' },
                { header: 'Email',           key: 'contact_email' },
                { header: 'Address',         key: 'address' },
                { header: 'Region',          key: 'region' },
                { header: 'Country',         key: 'country' },
                { header: 'Currency',        key: 'currency' },
                { header: 'WHT Applicable',  key: 'wht_applicable' },
                { header: 'WHT Rate (%)',    key: 'wht_rate' },
                { header: 'Bank Name',       key: 'bank_name' },
                { header: 'Bank Account',    key: 'bank_account_no' },
                { header: 'Credit Limit',    key: 'credit_limit' },
                { header: 'Payment Terms',   key: 'payment_terms' },
                { header: 'Status',          key: 'status' },
              ],
              'Suppliers.xlsx'
            )}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 transition">
            Export Excel
          </button>
          {canEdit && (
            <button onClick={openCreate}
              className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition">
              + Add New Supplier
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search suppliers…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50 w-64"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm text-slate-300">
          <thead className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              {['Name','Type','TIN','WHT Rate','Contact','Status',''].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No suppliers found.</td></tr>
            ) : paginated.map(s => (
              <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                <td className="px-4 py-3">{s.supplier_type}</td>
                <td className="px-4 py-3">{s.tin ?? '—'}</td>
                <td className="px-4 py-3">{s.wht_applicable ? `${s.wht_rate}%` : 'N/A'}</td>
                <td className="px-4 py-3">{s.contact_person ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? ''}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  {onViewSupplier ? (
                    <button type="button" onClick={() => onViewSupplier(s.id)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition">
                      View
                    </button>
                  ) : (
                    <Link to={`/suppliers/${s.id}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition">
                      View
                    </Link>
                  )}
                  {canEdit && (
                    <button onClick={() => openEdit(s)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition">
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 items-center text-sm text-slate-400">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40 hover:bg-white/5 transition">Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40 hover:bg-white/5 transition">Next</button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4 overflow-y-auto max-h-[90vh]">
            <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
            {formError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{formError}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Supplier Name *', key: 'name', type: 'text' },
                { label: 'Contact Person',  key: 'contact_person', type: 'text' },
                { label: 'Contact Phone',   key: 'contact_phone', type: 'text' },
                { label: 'Contact Email',   key: 'contact_email', type: 'email' },
                { label: 'TIN',             key: 'tin', type: 'text' },
                { label: 'VAT Number',      key: 'vat_number', type: 'text' },
                { label: 'Bank Name',       key: 'bank_name', type: 'text' },
                { label: 'Bank Account No', key: 'bank_account_no', type: 'text' },
                { label: 'Bank Branch',     key: 'bank_branch', type: 'text' },
                { label: 'Credit Limit (GHS)', key: 'credit_limit', type: 'number' },
                { label: 'Payment Terms (days)', key: 'payment_terms', type: 'number' },
                { label: 'Address',         key: 'address', type: 'text' },
                { label: 'Region',          key: 'region', type: 'text' },
                { label: 'Country',         key: 'country', type: 'text' },
              ].map(({ label, key, type }) => (
                <label key={key} className="space-y-1 text-xs text-slate-400">
                  <span className="uppercase tracking-widest">{label}</span>
                  <input type={type} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
                  />
                </label>
              ))}

              <label className="space-y-1 text-xs text-slate-400">
                <span className="uppercase tracking-widest">Supplier Type</span>
                <select value={form.supplier_type} onChange={e => handleTypeChange(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50">
                  {SUPPLIER_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              <label className="space-y-1 text-xs text-slate-400">
                <span className="uppercase tracking-widest">WHT Rate (%)</span>
                <input type="number" step="0.01" value={form.wht_rate}
                  onChange={e => setForm(f => ({ ...f, wht_rate: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
                />
              </label>

              <label className="space-y-1 text-xs text-slate-400">
                <span className="uppercase tracking-widest">Currency</span>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50">
                  {CURRENCY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              <label className="space-y-1 text-xs text-slate-400">
                <span className="uppercase tracking-widest">Status</span>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50">
                  {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.vat_registered}
                  onChange={e => setForm(f => ({ ...f, vat_registered: e.target.checked }))}
                  className="rounded" />
                VAT Registered
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.wht_applicable}
                  onChange={e => setForm(f => ({ ...f, wht_applicable: e.target.checked }))}
                  className="rounded" />
                WHT Applicable
              </label>
            </div>

            <label className="block space-y-1 text-xs text-slate-400">
              <span className="uppercase tracking-widest">Notes</span>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50" />
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 transition">
                {saving ? 'Saving…' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
