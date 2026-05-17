import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const EMPTY_ASSET_FORM = {
  asset_code: '',
  asset_name: '',
  category: '',
  cost: '',
  acquisition_date: new Date().toISOString().split('T')[0],
  useful_life_years: '5',
  project_id: '',
  division_id: '',
};

const STATUS_STYLES = {
  New: 'bg-blue-500/20 text-blue-300',
  Active: 'bg-emerald-500/20 text-emerald-300',
  'Fully Depreciated': 'bg-slate-500/20 text-slate-400',
  Disposed: 'bg-red-500/20 text-red-300',
};

function formatGhs(value) {
  return Number(value || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildNbvSeries(asset) {
  if (!asset?.cost || !asset?.acquisition_date || !asset?.useful_life_years) return [];

  const cost = Number(asset.cost);
  const monthlyDep = cost / (Number(asset.useful_life_years) * 12);
  const totalMonths = Number(asset.useful_life_years) * 12;
  const start = new Date(asset.acquisition_date);
  const points = [];

  for (let m = 0; m <= totalMonths; m += 1) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const accum = Math.min(monthlyDep * m, cost);
    const nbv = Math.max(cost - accum, 0);
    points.push({
      month: d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' }),
      nbv: Math.round(nbv * 100) / 100,
    });
    if (nbv <= 0) break;
  }

  return points;
}

export default function AssetRegister({ readOnly = false, userRole, userId }) {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterCategory, setFilterCategory] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_ASSET_FORM);
  const [saving, setSaving] = useState(false);

  const [showDepreciationModal, setShowDepreciationModal] = useState(false);
  const [depreciationMonth, setDepreciationMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [depreciationRunning, setDepreciationRunning] = useState(false);
  const [depreciationResult, setDepreciationResult] = useState(null);

  const [nbvAsset, setNbvAsset] = useState(null);
  const [nbvSeries, setNbvSeries] = useState([]);

  const [assetToDispose, setAssetToDispose] = useState(null);
  const [disposeForm, setDisposeForm] = useState({
    disposal_date: new Date().toISOString().split('T')[0],
    disposal_proceeds: '',
  });
  const [disposing, setDisposing] = useState(false);

  useEffect(() => {
    loadSupportData();
    loadAssets();
  }, [userRole, userId]);

  const loadSupportData = async () => {
    try {
      const [projRes, divRes] = await Promise.all([
        supabase.from('projects').select('id, name, division_id').order('name'),
        supabase.from('divisions').select('id, name').order('name'),
      ]);

      if (projRes.error) throw projRes.error;
      setProjects(projRes.data || []);
      setDivisions(divRes.data || []);

      if (userRole === 'project_manager' && userId) {
        const { data: assignments } = await supabase
          .from('project_assignments')
          .select('project_id')
          .eq('profile_id', userId);
        setAssignedProjectIds((assignments || []).map((a) => a.project_id));
      }
    } catch (err) {
      console.warn('Support data load failed', err);
    }
  };

  const loadAssets = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('asset_register')
        .select('*')
        .order('asset_code');

      if (err) throw err;
      setAssets(data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load assets: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(assets.map((a) => a.category).filter(Boolean));
    return [...set].sort();
  }, [assets]);

  const divisionOptions = useMemo(() => {
    const names = new Set(assets.map((a) => a.division_name).filter(Boolean));
    return [...names].sort();
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (userRole === 'project_manager' && assignedProjectIds) {
        if (a.project_id && !assignedProjectIds.includes(a.project_id)) return false;
      }
      if (filterCategory && a.category !== filterCategory) return false;
      if (filterDivision && a.division_name !== filterDivision) return false;
      if (filterStatus && a.asset_status !== filterStatus) return false;
      return true;
    });
  }, [assets, filterCategory, filterDivision, filterStatus, userRole, assignedProjectIds]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'project_id') {
        const proj = projects.find((p) => p.id === value);
        if (proj?.division_id) next.division_id = proj.division_id;
      }
      return next;
    });
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (readOnly) return;

    try {
      setSaving(true);
      const cost = parseFloat(formData.cost);
      if (!cost || cost <= 0) throw new Error('Cost must be greater than zero');

      const { error: err } = await supabase.from('assets').insert([
        {
          asset_code: formData.asset_code.trim(),
          asset_name: formData.asset_name.trim(),
          category: formData.category.trim(),
          cost,
          acquisition_date: formData.acquisition_date,
          useful_life_years: parseInt(formData.useful_life_years, 10) || 1,
          depreciation_method: 'straight_line',
          accumulated_depreciation: 0,
          net_book_value: cost,
          project_id: formData.project_id || null,
          division_id: formData.division_id || null,
          is_disposed: false,
        },
      ]);

      if (err) throw err;

      setFormData(EMPTY_ASSET_FORM);
      setShowAddForm(false);
      await loadAssets();
    } catch (err) {
      setError('Failed to add asset: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const runDepreciation = async () => {
    try {
      setDepreciationRunning(true);
      setDepreciationResult(null);
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error: err } = await supabase.rpc('post_depreciation_journal', {
        depreciation_month_start: `${depreciationMonth}-01`,
        actor_uuid: user.id,
      });

      if (err) throw err;
      if (!data.success) throw new Error(data.error);

      setDepreciationResult(data);
      await loadAssets();
    } catch (err) {
      setError('Depreciation run failed: ' + err.message);
    } finally {
      setDepreciationRunning(false);
    }
  };

  const openNbvHistory = async (asset) => {
    const series = buildNbvSeries(asset);

    try {
      const { data } = await supabase.rpc('compute_asset_depreciation', {
        asset_id_param: asset.id,
        depreciation_date_param: new Date().toISOString().split('T')[0],
      });
      if (data?.success && series.length > 0) {
        series[series.length - 1].nbv = Number(data.net_book_value);
      }
    } catch {
      // use projected series
    }

    setNbvAsset(asset);
    setNbvSeries(series);
  };

  const handleDispose = async (e) => {
    e.preventDefault();
    if (!assetToDispose || readOnly) return;

    try {
      setDisposing(true);
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error: err } = await supabase.rpc('dispose_asset', {
        asset_id_param: assetToDispose.id,
        disposal_date_param: disposeForm.disposal_date,
        disposal_proceeds_param: parseFloat(disposeForm.disposal_proceeds) || 0,
        actor_uuid: user.id,
      });

      if (err) throw err;
      if (!data.success) throw new Error(data.error);

      setAssetToDispose(null);
      setDisposeForm({
        disposal_date: new Date().toISOString().split('T')[0],
        disposal_proceeds: '',
      });
      await loadAssets();
    } catch (err) {
      setError('Disposal failed: ' + err.message);
    } finally {
      setDisposing(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
          <button type="button" onClick={() => setError(null)} className="mt-2 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white text-sm"
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Division</label>
            <select
              value={filterDivision}
              onChange={(e) => setFilterDivision(e.target.value)}
              className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white text-sm"
            >
              <option value="">All</option>
              {divisionOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white text-sm"
            >
              <option value="">All</option>
              <option value="New">New</option>
              <option value="Active">Active</option>
              <option value="Fully Depreciated">Fully Depreciated</option>
              <option value="Disposed">Disposed</option>
            </select>
          </div>
        </div>

        {!readOnly && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="rounded-full border border-teal-400/40 bg-teal-500/20 px-4 py-2 text-sm font-semibold text-teal-200"
            >
              {showAddForm ? 'Cancel' : 'Add Asset'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDepreciationModal(true);
                setDepreciationResult(null);
              }}
              className="rounded-full border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-200"
            >
              Run Depreciation
            </button>
          </div>
        )}
      </div>

      {showAddForm && !readOnly && (
        <form
          onSubmit={handleAddAsset}
          className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">Register New Asset</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Asset Code *</label>
              <input
                name="asset_code"
                value={formData.asset_code}
                onChange={handleFormChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Asset Name *</label>
              <input
                name="asset_name"
                value={formData.asset_name}
                onChange={handleFormChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Category *</label>
              <input
                name="category"
                value={formData.category}
                onChange={handleFormChange}
                required
                placeholder="Vehicle, Plant, Computer"
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Cost (GHS) *</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleFormChange}
                required
                step="0.01"
                min="0"
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Acquisition Date *</label>
              <input
                type="date"
                name="acquisition_date"
                value={formData.acquisition_date}
                onChange={handleFormChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Useful Life (years) *</label>
              <input
                type="number"
                name="useful_life_years"
                value={formData.useful_life_years}
                onChange={handleFormChange}
                required
                min="1"
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Project</label>
              <select
                name="project_id"
                value={formData.project_id}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Division</label>
              <select
                name="division_id"
                value={formData.division_id}
                onChange={handleFormChange}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              >
                <option value="">None</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-teal-500 px-6 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Asset'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-3xl border border-white/10">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Code</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Name</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Category</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">Cost</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Acquired</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-400">Life</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">Monthly Dep</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">Accum Dep</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">NBV</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-400">Dep %</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-400">Status</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Project</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Division</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="14" className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan="14" className="px-4 py-8 text-center text-slate-400">
                  No assets match filters
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => (
                <tr key={asset.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 text-sm font-mono text-slate-300">{asset.asset_code}</td>
                  <td className="px-3 py-2 text-sm text-white">{asset.asset_name}</td>
                  <td className="px-3 py-2 text-sm text-slate-300">{asset.category}</td>
                  <td className="px-3 py-2 text-sm text-right text-slate-200">{formatGhs(asset.cost)}</td>
                  <td className="px-3 py-2 text-sm text-slate-300">
                    {asset.acquisition_date
                      ? new Date(asset.acquisition_date).toLocaleDateString('en-GH')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-center text-slate-300">{asset.useful_life_years}y</td>
                  <td className="px-3 py-2 text-sm text-right text-slate-300">
                    {formatGhs(asset.monthly_depreciation_charge)}
                  </td>
                  <td className="px-3 py-2 text-sm text-right text-slate-300">
                    {formatGhs(asset.accumulated_depreciation)}
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-medium text-teal-300">
                    {formatGhs(asset.net_book_value)}
                  </td>
                  <td className="px-3 py-2 text-sm text-center text-slate-400">{asset.depreciation_pct ?? 0}%</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        STATUS_STYLES[asset.asset_status] || STATUS_STYLES.Active
                      }`}
                    >
                      {asset.asset_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-400">{asset.project_name || '—'}</td>
                  <td className="px-3 py-2 text-sm text-slate-400">{asset.division_name || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openNbvHistory(asset)}
                      className="text-xs font-medium text-teal-300 hover:text-teal-200 mr-2"
                    >
                      NBV History
                    </button>
                    {!readOnly && asset.asset_status !== 'Disposed' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAssetToDispose(asset);
                          setDisposeForm({
                            disposal_date: new Date().toISOString().split('T')[0],
                            disposal_proceeds: String(asset.net_book_value || 0),
                          });
                        }}
                        className="text-xs font-medium text-red-300 hover:text-red-200"
                      >
                        Dispose
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showDepreciationModal && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Run Monthly Depreciation</h3>
            <p className="mt-1 text-sm text-slate-400">
              Posts depreciation for all active assets for the selected month.
            </p>
            <div className="mt-4">
              <label className="block text-sm text-slate-400 mb-1">Depreciation month</label>
              <input
                type="month"
                value={depreciationMonth}
                onChange={(e) => setDepreciationMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
              />
            </div>
            {depreciationResult?.success && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
                <p>
                  <strong>{depreciationResult.period}</strong> posted successfully.
                </p>
                <p className="mt-1">Assets depreciated: {depreciationResult.assets_depreciated}</p>
                <p>Total charge: GHS {formatGhs(depreciationResult.total_depreciation_posted)}</p>
              </div>
            )}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDepreciationModal(false)}
                className="px-4 py-2 text-sm text-slate-400"
              >
                Close
              </button>
              <button
                type="button"
                onClick={runDepreciation}
                disabled={depreciationRunning}
                className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {depreciationRunning ? 'Posting…' : 'Post Depreciation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {nbvAsset && (
        <div className="rounded-3xl border border-teal-400/30 bg-[rgba(20,184,166,0.08)] p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">NBV History — {nbvAsset.asset_name}</h3>
              <p className="text-sm text-slate-400">
                Straight-line projection from acquisition to full depreciation
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNbvAsset(null)}
              className="text-sm text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nbvSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                  }}
                  formatter={(v) => [`GHS ${formatGhs(v)}`, 'NBV']}
                />
                <Line type="monotone" dataKey="nbv" stroke="#2dd4bf" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {assetToDispose && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleDispose}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-white">Dispose Asset</h3>
            <p className="mt-1 text-sm text-slate-400">
              {assetToDispose.asset_code} — {assetToDispose.asset_name}
            </p>
            <p className="mt-2 text-sm text-teal-300">
              Current NBV: GHS {formatGhs(assetToDispose.net_book_value)}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Disposal date</label>
                <input
                  type="date"
                  value={disposeForm.disposal_date}
                  onChange={(e) =>
                    setDisposeForm((p) => ({ ...p, disposal_date: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Disposal proceeds (GHS)</label>
                <input
                  type="number"
                  value={disposeForm.disposal_proceeds}
                  onChange={(e) =>
                    setDisposeForm((p) => ({ ...p, disposal_proceeds: e.target.value }))
                  }
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setAssetToDispose(null)}
                className="px-4 py-2 text-sm text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disposing}
                className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {disposing ? 'Processing…' : 'Confirm Disposal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
