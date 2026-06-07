import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhsCompact } from '../../lib/formatGhs'
import { budgetTrackStatus } from '../../lib/status-classes'
import { usePmProject } from '../../context/PmProjectContext'
import ProjectSwitcher from './ProjectSwitcher'

const COST_CATEGORIES = ['Materials', 'Labour', 'Subcontractors', 'Equipment Hire', 'Other']

function milestoneStatusStyle(status, dueDate) {
  const overdue =
    dueDate &&
    !['completed', 'invoiced'].includes(status) &&
    new Date(dueDate) < new Date(new Date().toDateString())
  if (overdue) return 'border-red-400/50 bg-red-500/10 text-red-200'
  if (status === 'completed' || status === 'invoiced') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
  if (status === 'in_progress') return 'border-amber-400/40 bg-amber-500/10 text-amber-200'
  return 'border-border-soft bg-white/5 text-slate-300'
}

export default function PmDashboard({ onLogCost, onMarkMilestone, onPaymentCert, onOpenCostLedger }) {
  const { selectedProjectId } = usePmProject()
  const [finance, setFinance] = useState(null)
  const [contractEnd, setContractEnd] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [pendingCostApprovals, setPendingCostApprovals] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const [{ data: fin }, { data: contract }, { data: ms }, pendingCostRes] = await Promise.all([
        supabase.from('project_finance_summary').select('*').eq('project_id', selectedProjectId).maybeSingle(),
        supabase.from('contracts').select('end_date').eq('project_id', selectedProjectId).maybeSingle(),
        supabase.from('milestones').select('*').eq('project_id', selectedProjectId).order('due_date', { ascending: true }),
        supabase.from('project_costs').select('id', { count: 'exact', head: true }).eq('project_id', selectedProjectId).eq('status', 'pending_approval'),
      ])
      setFinance(fin)
      setContractEnd(contract?.end_date || null)
      setMilestones(ms ?? [])
      setPendingCostApprovals(pendingCostRes.count ?? 0)
    } catch (err) {
      console.warn('PM dashboard load failed', err)
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => {
    load()
  }, [load])

  const budgetRows = COST_CATEGORIES.map((category) => {
    const budgetVal =
      category === 'Materials'
        ? finance?.materials_budget_ghs
        : category === 'Labour'
          ? finance?.labour_budget_ghs
          : category === 'Subcontractors'
            ? finance?.subcontractor_budget_ghs
            : category === 'Equipment Hire'
              ? finance?.equipment_budget_ghs
              : finance?.other_budget_ghs
    const spentVal =
      category === 'Materials'
        ? finance?.materials_cost_ghs
        : category === 'Labour'
          ? finance?.labour_cost_ghs
          : category === 'Subcontractors'
            ? finance?.subcontractor_cost_ghs
            : category === 'Equipment Hire'
              ? finance?.equipment_cost_ghs
              : finance?.other_cost_ghs
    const b = Number(budgetVal) || 0
    const s = Number(spentVal) || 0
    return { category, budget: b, spent: s, remaining: b - s, status: budgetTrackStatus(s, b) }
  })

  const remaining = Number(finance?.budget_remaining_ghs) || 0
  const completion = Number(finance?.financial_completion_pct) || 0
  const contractValue = Number(finance?.contract_value_ghs) || 0
  const budgetOverrunPct = remaining < 0 ? (Math.abs(remaining) / Math.max(1, contractValue)) * 100 : 0
  const budgetRiskClass = budgetOverrunPct >= 10 ? 'bg-red-500/10 text-red-300' : budgetOverrunPct >= 3 ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
  const budgetRiskLabel = budgetOverrunPct >= 10 ? 'Critical' : budgetOverrunPct >= 3 ? 'Warning' : 'On track'

  const lateMilestones = milestones.filter((m) => {
    const dueDate = m.due_date ? new Date(m.due_date) : null
    return (
      dueDate &&
      !['completed', 'invoiced'].includes(m.status) &&
      dueDate < new Date(new Date().toDateString())
    )
  })
  const lateMilestoneNames = lateMilestones.map((m) => m.title).filter(Boolean).slice(0, 3)
  const lateMilestoneCount = lateMilestones.length
  const lateMilestonesClass = lateMilestoneCount > 2 ? 'bg-red-500/10 text-red-300' : lateMilestoneCount > 0 ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
  const lateMilestonesLabel = lateMilestoneCount > 0 ? `${lateMilestoneCount} late` : 'On track'

  const pendingApprovalsClass = pendingCostApprovals > 5 ? 'bg-red-500/10 text-red-300' : pendingCostApprovals > 0 ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
  const pendingApprovalsLabel = pendingCostApprovals > 0 ? `${pendingCostApprovals} pending` : 'None'

  let daysLabel = '—'
  let daysClass = 'text-slate-300'
  let contractStatusLabel = 'On track'
  let contractStatusClass = 'bg-emerald-500/10 text-emerald-300'

  if (contractEnd) {
    const end = new Date(contractEnd)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
    daysLabel = days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`
    if (days < 0) {
      daysClass = 'text-red-400'
      contractStatusLabel = 'Critical'
      contractStatusClass = 'bg-red-500/10 text-red-300'
    } else if (days <= 30) {
      daysClass = 'text-amber-300'
      contractStatusLabel = 'Warning'
      contractStatusClass = 'bg-amber-500/10 text-amber-300'
    } else {
      daysClass = 'text-emerald-300'
      contractStatusLabel = 'On track'
      contractStatusClass = 'bg-emerald-500/10 text-emerald-300'
    }
  }
  if (contractEnd) {
    const end = new Date(contractEnd)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
    daysLabel = days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`
    if (days < 0) daysClass = 'text-red-400'
    else if (days <= 30) daysClass = 'text-amber-300'
    else daysClass = 'text-emerald-300'
  }

  return (
    <div className="space-y-6 pb-28 lg:pb-6">
      <ProjectSwitcher />

      {!selectedProjectId ? null : loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="portal-section-eyebrow uppercase tracking-[0.24em] text-slate-500">Risk indicators</p>
                <h3 className="text-lg font-semibold text-white">Project risk dashboard</h3>
              </div>
              <p className="text-sm text-slate-400">Click to drill into the project finance workflow.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <RiskCard
                label="Budget overrun risk"
                value={budgetOverrunPct > 0 ? `${budgetOverrunPct.toFixed(1)}%` : '0%'}
                detail={budgetOverrunPct > 0 ? 'Over budget' : 'Within budget'}
                statusLabel={budgetRiskLabel}
                statusClass={budgetRiskClass}
                onClick={() => onOpenCostLedger?.('Budget Overrun')}
              />
              <RiskCard
                label="Late milestones"
                value={String(lateMilestoneCount)}
                detail={lateMilestoneNames.length > 0 ? lateMilestoneNames.join(', ') : 'No late milestones'}
                statusLabel={lateMilestonesLabel}
                statusClass={lateMilestonesClass}
                onClick={onMarkMilestone}
              />
              <RiskCard
                label="Pending cost approvals"
                value={String(pendingCostApprovals)}
                detail={pendingApprovalsLabel}
                statusLabel={pendingApprovalsLabel}
                statusClass={pendingApprovalsClass}
                onClick={() => onOpenCostLedger?.('Pending Approvals')}
              />
              <RiskCard
                label="Contract days remaining"
                value={daysLabel}
                detail="Contract timeline"
                statusLabel={contractStatusLabel}
                statusClass={contractStatusClass}
                onClick={() => onOpenCostLedger?.('Contract')}
              />
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Contract Value" value={formatGhsCompact(finance?.contract_value)} />
            <SummaryCard label="Financial Completion" progress={completion} />
            <SummaryCard
              label="Budget Remaining"
              value={formatGhsCompact(remaining)}
              valueClass={remaining < 0 ? 'text-red-400' : 'text-emerald-300'}
            />
            <SummaryCard label="Days to Contract End" value={daysLabel} valueClass={daysClass} raw />
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Milestone timeline</h3>
            <div className="pm-milestone-scroll flex gap-3 overflow-x-auto pb-2">
              {milestones.length === 0 ? (
                <p className="text-sm text-slate-500">No milestones for this project.</p>
              ) : (
                milestones.map((m) => (
                  <div
                    key={m.id}
                    className={`min-w-[10.5rem] shrink-0 rounded-2xl border px-3 py-3 ${milestoneStatusStyle(m.status, m.due_date)}`}
                  >
                    <p className="text-sm font-semibold line-clamp-2">{m.title}</p>
                    <p className="mt-2 text-xs uppercase tracking-wide opacity-80">{m.status?.replace('_', ' ')}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {m.due_date ? new Date(m.due_date).toLocaleDateString('en-GH') : 'No due date'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Budget vs actual</h3>
            <div className="portal-table-scroll rounded-2xl border border-border-soft">
              <table className="dark-table min-w-[520px] w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-400">Category</th>
                    <th className="px-3 py-2 text-right text-slate-400">Budget</th>
                    <th className="px-3 py-2 text-right text-slate-400">Spent</th>
                    <th className="px-3 py-2 text-right text-slate-400">Remaining</th>
                    <th className="px-3 py-2 text-left text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((row) => (
                    <tr
                      key={row.category}
                      className="cursor-pointer hover:bg-white/5"
                      onClick={() => onOpenCostLedger?.(row.category)}
                    >
                      <td className="px-3 py-2 text-white">{row.category}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{formatGhsCompact(row.budget)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{formatGhsCompact(row.spent)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{formatGhsCompact(row.remaining)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status.className}`}>
                          {row.status.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="hidden gap-3 lg:grid lg:grid-cols-3">
            <QuickAction label="Log a Cost" onClick={onLogCost} />
            <QuickAction label="Mark Milestone Complete" onClick={onMarkMilestone} />
            <QuickAction label="Issue Payment Certificate" onClick={onPaymentCert} />
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, valueClass = 'text-white', progress, raw }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      {progress != null ? (
        <>
          <p className="mt-2 text-xl font-bold text-cyan-200">{progress.toFixed(0)}%</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </>
      ) : (
        <p className={`mt-2 text-lg font-bold ${valueClass}`}>{raw ? value : value}</p>
      )}
    </div>
  )
}

function RiskCard({ label, value, detail, statusLabel, statusClass, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-left transition hover:border-emerald-400/30 hover:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
      </div>
      <p className="mt-4 text-sm text-slate-400">{detail}</p>
    </button>
  )
}

function QuickAction({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-touch rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
    >
      {label}
    </button>
  )
}
