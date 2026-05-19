import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COST_CATEGORIES = ['Materials', 'Labour', 'Subcontractors', 'Equipment Hire', 'Other']

export default function ProjectFinanceDashboard({
  userRole = 'accountant',
  currentUserProfileId = null,
  initialProjectId = null,
  hideProjectSelector = false,
}) {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [finance, setFinance] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [releaseLoading, setReleaseLoading] = useState(false)

  // Fetch all projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        let data, err

        if (userRole === 'project_manager' && currentUserProfileId) {
          // Filter projects by current PM's assignments
          const result = await supabase
            .from('project_assignments')
            .select('project_id, projects(*)')
            .eq('profile_id', currentUserProfileId)

          data = result.data?.map(pa => pa.projects) || []
          err = result.error
        } else {
          // Load all active projects for other roles
          const result = await supabase
            .from('projects')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })

          data = result.data
          err = result.error
        }

        if (err) throw err
        setProjects(data || [])

        if (data && data.length > 0) {
          const preferred = initialProjectId && data.some((p) => p.id === initialProjectId)
            ? initialProjectId
            : data[0].id
          setSelectedProject(preferred)
        }
      } catch (err) {
        setError('Failed to load projects')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [userRole, currentUserProfileId, initialProjectId])

  // Fetch finance data when project changes
  useEffect(() => {
    if (!selectedProject) return

    const fetchFinanceData = async () => {
      try {
        setLoading(true)
        const { data, error: err } = await supabase
          .from('project_finance_summary')
          .select('*')
          .eq('project_id', selectedProject)
          .single()

        if (err && err.code !== 'PGRST116') throw err
        setFinance(data || null)
      } catch (err) {
        console.error('Error fetching finance data:', err)
        setFinance(null)
      } finally {
        setLoading(false)
      }
    }

    fetchFinanceData()
  }, [selectedProject])

  // Fetch milestones when project changes
  useEffect(() => {
    if (!selectedProject) return

    const fetchMilestones = async () => {
      try {
        const { data, error: err } = await supabase
          .from('milestones')
          .select('*')
          .eq('project_id', selectedProject)
          .order('due_date', { ascending: true })

        if (err) throw err
        setMilestones(data || [])
      } catch (err) {
        console.error('Error fetching milestones:', err)
      }
    }

    fetchMilestones()
  }, [selectedProject])

  // Handle retention release
  const handleReleaseRetention = async () => {
    if (!finance?.contract_id) return

    try {
      setReleaseLoading(true)

      // Update contract
      const { error: contractErr } = await supabase
        .from('contracts')
        .update({
          retention_released: true,
          retention_released_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', finance.contract_id)

      if (contractErr) throw contractErr

      // Create ledger entry
      const { error: ledgerErr } = await supabase
        .from('retention_ledger')
        .insert({
          contract_id: finance.contract_id,
          project_id: selectedProject,
          retention_amount: finance.total_retention_held,
          transaction_type: 'released',
          transaction_date: new Date().toISOString().split('T')[0],
        })

      if (ledgerErr) throw ledgerErr

      // Refresh finance data
      const { data } = await supabase
        .from('project_finance_summary')
        .select('*')
        .eq('project_id', selectedProject)
        .single()

      setFinance(data)
    } catch (err) {
      setError('Failed to release retention')
      console.error(err)
    } finally {
      setReleaseLoading(false)
    }
  }

  if (loading && !finance) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border border-teal-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading project finance data...</p>
        </div>
      </div>
    )
  }

  const currentProject = projects.find(p => p.id === selectedProject)

  // Budget vs actual data
  const budgetData = COST_CATEGORIES.map(category => ({
    category,
    budget: finance?.[`${category.toLowerCase().replace(/ /g, '_')}_budget_ghs`] || 0,
    actual: finance?.[`${category.toLowerCase().replace(/ /g, '_')}_cost_ghs`] || 0,
  })).map(item => ({
    ...item,
    variance: item.budget - item.actual,
    variancePct: item.budget > 0 ? ((item.budget - item.actual) / item.budget * 100).toFixed(1) : 0,
    status: item.actual === 0 ? 'On Track' : item.actual > item.budget ? 'Over Budget' : item.actual > (item.budget * 0.9) ? 'At Risk' : 'On Track',
  }))

  const canReleaseRetention = ['accountant', 'ceo'].includes(userRole)

  const formatCurrency = (val) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GHS', minimumFractionDigits: 0 }).format(val || 0)
  const formatPct = (val) => `${(val || 0).toFixed(1)}%`

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.1)] p-4 backdrop-blur-sm">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {!hideProjectSelector && (
        <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
          <label className="text-sm uppercase tracking-[0.16em] text-slate-400 block mb-3">Select Project</label>
          <select
            value={selectedProject || ''}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full min-touch px-4 py-3 rounded-2xl border border-white/20 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — {projects.find(x => x.id === p.id)?.division_name || 'N/A'}
              </option>
            ))}
          </select>
        </div>
      )}

      {finance && (
        <>
          {/* Metric Strip — Row 1 */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Contract Value */}
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Contract Value</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(finance.contract_value)}</p>
              <p className="text-xs text-slate-500 mt-2">{currentProject?.name}</p>
            </div>

            {/* Total Invoiced */}
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Total Invoiced</p>
              <p className="text-2xl font-bold text-teal-200">{formatCurrency(finance.total_invoiced_ghs)}</p>
              <p className="text-xs text-slate-400 mt-2">
                {formatPct((finance.total_invoiced_ghs / (finance.contract_value || 1)) * 100)} of contract
              </p>
            </div>

            {/* Total Received */}
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Total Received</p>
              <p className="text-2xl font-bold text-emerald-300">{formatCurrency(finance.total_received_ghs)}</p>
              <p className="text-xs text-emerald-400 mt-2">Payments received</p>
            </div>

            {/* Outstanding */}
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Outstanding</p>
              <p className="text-2xl font-bold text-amber-300">{formatCurrency(finance.total_outstanding_ghs)}</p>
              <p className="text-xs text-amber-400 mt-2">Awaiting payment</p>
            </div>
          </div>

          {/* Metric Strip — Row 2 */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {/* Total Costs */}
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Total Costs</p>
              <p className="text-2xl font-bold text-red-300">{formatCurrency(finance.total_costs_ghs)}</p>
              <p className="text-xs text-red-400 mt-2">All categories</p>
            </div>

            {/* Gross Profit */}
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Gross Profit</p>
              <p className={`text-2xl font-bold ${finance.gross_profit_ghs >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {formatCurrency(finance.gross_profit_ghs)}
              </p>
              <p className={`text-xs mt-2 ${finance.gross_profit_ghs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {finance.gross_profit_ghs >= 0 ? 'Profit' : 'Loss'}
              </p>
            </div>

            {/* Gross Margin */}
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Gross Margin</p>
              <p className="text-2xl font-bold text-blue-300">{formatPct(finance.gross_margin_pct)}</p>
              <p className="text-xs text-blue-400 mt-2">
                <div className="w-full h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${Math.min(finance.gross_margin_pct, 100)}%` }}
                  ></div>
                </div>
              </p>
            </div>

            {/* Financial Completion */}
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm lg:col-span-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Financial Completion</p>
              <p className="text-xl font-bold text-purple-300 mb-3">{formatPct(finance.financial_completion_pct)}</p>
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-purple-400 rounded-full"
                  style={{ width: `${Math.min(finance.financial_completion_pct, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Budget vs Actual Table */}
          <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
            <div className="portal-table-scroll overflow-x-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Budget vs Actual</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Category</th>
                  <th className="text-right py-3 px-4 text-slate-300 font-semibold">Budget (GHS)</th>
                  <th className="text-right py-3 px-4 text-slate-300 font-semibold">Actual (GHS)</th>
                  <th className="text-right py-3 px-4 text-slate-300 font-semibold">Variance (GHS)</th>
                  <th className="text-center py-3 px-4 text-slate-300 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {budgetData.map((row, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="py-3 px-4 text-slate-200">{row.category}</td>
                    <td className="text-right py-3 px-4 text-slate-300">{formatCurrency(row.budget)}</td>
                    <td className="text-right py-3 px-4 text-slate-300">{formatCurrency(row.actual)}</td>
                    <td className={`text-right py-3 px-4 font-semibold ${row.variance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {row.variance >= 0 ? formatCurrency(row.variance) : `(${formatCurrency(Math.abs(row.variance))})`}
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        row.status === 'On Track' ? 'bg-emerald-400/20 text-emerald-300' :
                        row.status === 'At Risk' ? 'bg-amber-400/20 text-amber-300' :
                        'bg-red-400/20 text-red-300'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-white/5 border-t-2 border-white/10">
                  <td className="py-3 px-4 font-bold text-white">TOTAL</td>
                  <td className="text-right py-3 px-4 font-bold text-white">{formatCurrency(finance.total_budget_ghs)}</td>
                  <td className="text-right py-3 px-4 font-bold text-white">{formatCurrency(finance.total_costs_ghs)}</td>
                  <td className={`text-right py-3 px-4 font-bold ${finance.budget_remaining_ghs >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {finance.budget_remaining_ghs >= 0 ? formatCurrency(finance.budget_remaining_ghs) : `(${formatCurrency(Math.abs(finance.budget_remaining_ghs))})`}
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      finance.budget_remaining_ghs >= 0 ? 'bg-emerald-400/20 text-emerald-300' :
                      'bg-red-400/20 text-red-300'
                    }`}>
                      {finance.budget_remaining_ghs >= 0 ? 'On Track' : 'Over Budget'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          {/* Budget vs Actual Chart */}
          <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={budgetData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="category" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                  }}
                  formatter={(val) => formatCurrency(val)}
                  labelStyle={{ color: '#ffffff' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="budget" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="actual" fill="#f87171" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Retention Section */}
          {finance.contract_id && (
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Client Retention</h3>
                  <p className="text-xs text-slate-400 mt-1">Retention percentage & release management</p>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Retention %</p>
                  <p className="text-2xl font-bold text-white">{finance.retention_percentage}%</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Total Held</p>
                  <p className="text-2xl font-bold text-amber-300">{formatCurrency(finance.total_retention_held)}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Status</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      finance.retention_released
                        ? 'bg-emerald-400/20 text-emerald-300'
                        : 'bg-amber-400/20 text-amber-300'
                    }`}>
                      {finance.retention_released ? '✓ Released' : '⊘ Held'}
                    </span>
                  </div>
                </div>
              </div>

              {canReleaseRetention && !finance.retention_released && (
                <button
                  onClick={handleReleaseRetention}
                  disabled={releaseLoading}
                  className="mt-4 rounded-2xl border border-emerald-400/40 bg-[rgba(16,185,129,0.15)] px-6 py-3 text-sm font-medium text-emerald-200 transition hover:border-emerald-400/60 hover:bg-[rgba(16,185,129,0.25)] disabled:opacity-50"
                >
                  {releaseLoading ? 'Processing...' : 'Release Retention'}
                </button>
              )}
            </div>
          )}

          {/* Milestone Timeline */}
          {milestones.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Project Milestones</h3>
              <div className="space-y-3">
                {milestones.map((milestone, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-white">{milestone.title}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Due: {new Date(milestone.due_date).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-300">{milestone.completion_percentage || 0}%</p>
                        <div className="w-24 h-2 rounded-full bg-white/10 mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              milestone.status === 'completed' ? 'bg-emerald-400' :
                              milestone.status === 'in_progress' ? 'bg-amber-400' :
                              'bg-slate-400'
                            }`}
                            style={{ width: `${milestone.completion_percentage || 0}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        milestone.status === 'completed' ? 'bg-emerald-400/20 text-emerald-300' :
                        milestone.status === 'in_progress' ? 'bg-amber-400/20 text-amber-300' :
                        'bg-slate-400/20 text-slate-300'
                      }`}>
                        {milestone.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
