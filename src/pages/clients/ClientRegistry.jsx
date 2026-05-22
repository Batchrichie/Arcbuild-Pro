import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { exportToExcel } from '../../utils/exportToExcel'
import { getClients, createClient, updateClient } from '../../services/clientService'

const STATUS_STYLE = {
  Active:      'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Inactive:    'bg-slate-500/10 text-slate-400 border-slate-500/30',
  Blacklisted: 'bg-red-500/10 text-red-300 border-red-500/30',
}

const CLIENT_TYPE_OPTIONS = [
  { label: 'Individual', value: 'individual' },
  { label: 'Corporate', value: 'corporate' },
  { label: 'Government', value: 'government' },
]
const STATUS_OPTIONS      = ['Active', 'Inactive', 'Blacklisted']
const CURRENCY_OPTIONS    = ['GHS', 'USD', 'GBP', 'EUR']

const EMPTY_FORM = {
  name: '', client_type: 'individual', tin: '', vat_registered: false, vat_number: '',
  credit_limit: 0, payment_terms: 30, currency: 'GHS', contact_person: '',
  contact_phone: '', contact_email: '', address: '', region: '', country: 'Ghana',
  status: 'Active', notes: '',
}

export default function ClientRegistry({ onViewClient }) {
  const { profile } = useAuth()
  const canEdit = ['ceo', 'accountant'].includes(profile?.role)

  const [clients, setClients]     = useState([])
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

  useEffect(() => {
    loadClients()
  }, [search, statusFilter])

  async function loadClients() {
    setLoading(true)
    setError(null)
    try {
      const data = await getClients({ search, status: statusFilter || undefined })
      setClients(data)
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

  function normalizeClientType(value) {
    if (!value) return 'individual'
    const normalized = String(value).toLowerCase()
    if (normalized === 'company' || normalized === 'corporate') return 'corporate'
    if (normalized === 'government') return 'government'
    return normalized === 'individual' ? 'individual' : normalized
  }

  function openEdit(client) {
    setEditing(client)
    setForm({
      name: client.name ?? '',
      client_type: normalizeClientType(client.client_type),
      tin: client.tin ?? '',
      vat_registered: client.vat_registered ?? false,
      vat_number: client.vat_number ?? '',
      credit_limit: client.credit_limit ?? 0,
      payment_terms: client.payment_terms ?? 30,
      currency: client.currency ?? 'GHS',
      contact_person: client.contact_person ?? '',
      contact_phone: client.contact_phone ?? '',
      contact_email: client.contact_email ?? '',
      address: client.address ?? '',
      region: client.region ?? '',
      country: client.country ?? 'Ghana',
      status: client.status ?? 'Active',
      notes: client.notes ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    if (!form.name.trim()) { setFormError('Client name is required.'); return }
    setSaving(true)
    try {
      if (editing) {
        await updateClient(editing.id, form, profile.id)
      } else {
        await createClient(form, profile.id)
      }
      setModalOpen(false)
      await loadClients()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const paginated = clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(clients.length / PAGE_SIZE)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Client Registry</h1>
        <div className="flex gap-3">
          <button
            onClick={() => exportToExcel(
              clients,
              [
                { header: 'Name',           key: 'name' },
                { header: 'Type',           key: 'client_type' },
                { header: 'TIN',            key: 'tin' },
                { header: 'Contact Person', key: 'contact_person' },
                { header: 'Phone',          key: 'contact_phone' },
                { header: 'Email',          key: 'contact_email' },
                { header: 'Address',        key: 'address' },
                { header: 'Region',         key: 'region' },
                { header: 'Country',        key: 'country' },
                { header: 'Currency',       key: 'currency' },
                { header: 'Credit Limit',   key: 'credit_limit' },
                { header: 'Payment Terms',  key: 'payment_terms' },
                { header: 'VAT Registered', key: 'vat_registered' },
                { header: 'Status',         key: 'status' },
              ],
              'Clients.xlsx'
            )}
            className="rounded-xl border border-border-soft bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 transition">
            Export Excel
          </button>
          {canEdit && (
            <button onClick={openCreate}
              className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition">
              + Add New Client
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          type="text" placeholder="Search clients…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50 w-64"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-border-soft">
        <table className="w-full text-sm text-slate-300">
          <thead className="border-b border-border-soft text-xs uppercase tracking-widest text-slate-500">
            <tr>
              {['Name','Type','TIN','Contact Person','Phone','Status','Credit Limit',''].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No clients found.</td></tr>
            ) : paginated.map(c => (
              <tr key={c.id} className="border-b border-border-soft hover:bg-white/5 transition">
                <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                <td className="px-4 py-3">{normalizeClientType(c.client_type)}</td>
                <td className="px-4 py-3">{c.tin ?? '—'}</td>
                <td className="px-4 py-3">{c.contact_person ?? '—'}</td>
                <td className="px-4 py-3">{c.contact_phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? ''}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(c.credit_limit ?? 0)}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  {onViewClient ? (
                    <button type="button" onClick={() => onViewClient(c.id)}
                      className="rounded-lg border border-border-soft bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition">
                      View
                    </button>
                  ) : (
                    <Link to={`/clients/${c.id}`}
                      className="rounded-lg border border-border-soft bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition">
                      View
                    </Link>
                  )}
                  {canEdit && (
                    <button onClick={() => openEdit(c)}
                      className="rounded-lg border border-border-soft bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition">
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
            className="rounded-lg border border-border-soft px-3 py-1 disabled:opacity-40 hover:bg-white/5 transition">Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-lg border border-border-soft px-3 py-1 disabled:opacity-40 hover:bg-white/5 transition">Next</button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border-soft bg-slate-900 p-6 space-y-4 overflow-y-auto max-h-[90vh]">
            <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Client' : 'New Client'}</h2>
            {formError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{formError}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Client Name *', key: 'name', type: 'text' },
                { label: 'Contact Person', key: 'contact_person', type: 'text' },
                { label: 'Contact Phone', key: 'contact_phone', type: 'text' },
                { label: 'Contact Email', key: 'contact_email', type: 'email' },
                { label: 'TIN', key: 'tin', type: 'text' },
                { label: 'VAT Number', key: 'vat_number', type: 'text' },
                { label: 'Credit Limit (GHS)', key: 'credit_limit', type: 'number' },
                { label: 'Payment Terms (days)', key: 'payment_terms', type: 'number' },
                { label: 'Address', key: 'address', type: 'text' },
                { label: 'Region', key: 'region', type: 'text' },
                { label: 'Country', key: 'country', type: 'text' },
              ].map(({ label, key, type }) => (
                <label key={key} className="space-y-1 text-xs text-slate-400">
                  <span className="uppercase tracking-widest">{label}</span>
                  <input type={type} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
                  />
                </label>
              ))}

              <label className="space-y-1 text-xs text-slate-400">
                <span className="uppercase tracking-widest">Client Type</span>
                <select value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))}
                  className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50">
                  {CLIENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-slate-400">
                <span className="uppercase tracking-widest">Currency</span>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50">
                  {CURRENCY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              <label className="space-y-1 text-xs text-slate-400">
                <span className="uppercase tracking-widest">Status</span>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50">
                  {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer col-span-2">
                <input type="checkbox" checked={form.vat_registered}
                  onChange={e => setForm(f => ({ ...f, vat_registered: e.target.checked }))}
                  className="rounded" />
                VAT Registered
              </label>
            </div>

            <label className="block space-y-1 text-xs text-slate-400">
              <span className="uppercase tracking-widest">Notes</span>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                className="w-full rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50" />
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModalOpen(false)}
                className="rounded-xl border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 transition">
                {saving ? 'Saving…' : 'Save Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
