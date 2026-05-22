import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const EMPTY_FORM = {
  name: '',
  tin: '',
  contact_person: '',
  phone: '',
  email: '',
  trade_type: '',
  bank_name: '',
  bank_account: '',
  applies_wht: false,
  wht_rate: '0.05',
};

function formatGhs(value) {
  return Number(value || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function WhtBadge({ appliesWht, whtRate }) {
  if (appliesWht) {
    const pct = Math.round(Number(whtRate || 0.05) * 100);
    return (
      <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-300">
        WHT {pct}%
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-500/20 px-2.5 py-1 text-xs font-semibold text-slate-400">
      No WHT
    </span>
  );
}

export default function SubcontractorRegistry({ readOnly = false }) {
  const [subcontractors, setSubcontractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [historySub, setHistorySub] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadSubcontractors();
  }, []);

  const loadSubcontractors = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('subcontractors')
        .select(
          'id, name, tin, contact_person, phone, email, trade_type, applies_wht, wht_rate, total_paid_ghs, total_wht_deducted_ghs'
        )
        .order('name');

      if (err) throw err;
      setSubcontractors(data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load subcontractors: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;

    try {
      setSaving(true);
      const payload = {
        name: formData.name.trim(),
        tin: formData.tin.trim() || null,
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        trade_type: formData.trade_type.trim() || null,
        bank_name: formData.bank_name.trim() || null,
        bank_account: formData.bank_account.trim() || null,
        applies_wht: formData.applies_wht,
        wht_rate: formData.applies_wht ? parseFloat(formData.wht_rate) || 0.05 : 0.05,
      };

      const { error: err } = await supabase.from('subcontractors').insert([payload]);
      if (err) throw err;

      setFormData(EMPTY_FORM);
      setShowAddForm(false);
      await loadSubcontractors();
    } catch (err) {
      setError('Failed to add subcontractor: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (sub) => {
    setHistorySub(sub);
    setHistoryRows([]);
    setHistoryLoading(true);

    try {
      const { data, error: err } = await supabase
        .from('subcontractor_payment_history')
        .select(
          'cost_id, project_name, description, gross_amount, currency, gross_amount_ghs, fx_rate, payment_date, entry_number'
        )
        .eq('subcontractor_id', sub.id)
        .not('cost_id', 'is', null)
        .order('payment_date', { ascending: false });

      if (err) throw err;
      setHistoryRows(data || []);
    } catch (err) {
      setError('Failed to load payment history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistorySub(null);
    setHistoryRows([]);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-full border border-teal-400/40 bg-teal-500/20 px-5 py-2 text-sm font-semibold text-teal-200 transition hover:bg-teal-500/30"
          >
            {showAddForm ? 'Cancel' : 'Add Subcontractor'}
          </button>
        </div>
      )}

      {showAddForm && !readOnly && (
        <form
          onSubmit={handleAddSubmit}
          className="rounded-3xl panel-surface p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">New Subcontractor</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name *</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">TIN</label>
              <input
                name="tin"
                value={formData.tin}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Contact Person</label>
              <input
                name="contact_person"
                value={formData.contact_person}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Phone</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Trade Type</label>
              <input
                name="trade_type"
                value={formData.trade_type}
                onChange={handleFormChange}
                placeholder="e.g. Electrical, Plumbing"
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bank Name</label>
              <input
                name="bank_name"
                value={formData.bank_name}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bank Account</label>
              <input
                name="bank_account"
                value={formData.bank_account}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              name="applies_wht"
              checked={formData.applies_wht}
              onChange={handleFormChange}
              className="rounded"
            />
            Withholding tax (WHT) applies
          </label>

          {formData.applies_wht && (
            <div className="max-w-xs">
              <label className="block text-sm text-slate-400 mb-1">WHT Rate</label>
              <input
                type="number"
                name="wht_rate"
                value={formData.wht_rate}
                onChange={handleFormChange}
                step="0.0001"
                min="0"
                max="1"
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
              <p className="mt-1 text-xs text-slate-500">Default 0.05 = 5%</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-teal-500 px-6 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Subcontractor'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-3xl border border-border-soft">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-soft bg-white/5">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">TIN</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Trade</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">WHT</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Total Paid</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Total WHT</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : subcontractors.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                  No subcontractors registered
                </td>
              </tr>
            ) : (
              subcontractors.map((sub) => (
                <tr key={sub.id} className="border-b border-border-soft hover:bg-white/5">
                  <td className="px-4 py-3 text-sm font-medium text-white">{sub.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{sub.tin || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{sub.trade_type || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    <div>{sub.contact_person || '—'}</div>
                    <div className="text-xs text-slate-500">{sub.phone || sub.email || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <WhtBadge appliesWht={sub.applies_wht} whtRate={sub.wht_rate} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-200">
                    GHS {formatGhs(sub.total_paid_ghs)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-200">
                    GHS {formatGhs(sub.total_wht_deducted_ghs)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openHistory(sub)}
                      className="text-sm font-medium text-teal-300 hover:text-teal-200"
                    >
                      View History
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {historySub && (
        <div className="rounded-3xl border border-teal-400/30 bg-success-bg p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Payment History — {historySub.name}</h3>
              <p className="text-sm text-slate-400">All payment certificates across projects</p>
            </div>
            <button
              type="button"
              onClick={closeHistory}
              className="text-sm text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          {historyLoading ? (
            <p className="text-slate-400 text-sm">Loading history…</p>
          ) : historyRows.length === 0 ? (
            <p className="text-slate-400 text-sm">No payment certificates on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-soft">
                    <th className="px-3 py-2 text-left text-xs uppercase text-slate-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs uppercase text-slate-500">Project</th>
                    <th className="px-3 py-2 text-left text-xs uppercase text-slate-500">Description</th>
                    <th className="px-3 py-2 text-right text-xs uppercase text-slate-500">Gross (GHS)</th>
                    <th className="px-3 py-2 text-left text-xs uppercase text-slate-500">Journal</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.cost_id} className="border-b border-border-soft">
                      <td className="px-3 py-2 text-slate-300">
                        {row.payment_date
                          ? new Date(row.payment_date).toLocaleDateString('en-GH')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-white">{row.project_name}</td>
                      <td className="px-3 py-2 text-slate-300 max-w-xs truncate">{row.description}</td>
                      <td className="px-3 py-2 text-right text-slate-200">
                        {row.currency !== 'GHS' ? (
                          <span title={`${row.gross_amount} ${row.currency}`}>
                            {formatGhs(row.gross_amount_ghs)}
                          </span>
                        ) : (
                          formatGhs(row.gross_amount_ghs)
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{row.entry_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
