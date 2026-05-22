import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getCompanyRecognitionSummary, calculatePctCompleteByCost, calculatePctCompleteByMilestone, runRevenueRecognition } from '../../services/revenueRecognitionService'
import Modal from '../../components/ui/Modal'

export default function RevenueRecognitionDashboard() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeProject, setActiveProject] = useState(null)
  const [percent, setPercent] = useState(0)
  const [periodLabel, setPeriodLabel] = useState(new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' }))
  const [running, setRunning] = useState(false)
  const canAccess = ['ceo','accountant'].includes(profile?.role)

  useEffect(() => {
    if (!canAccess) return
    load()
  }, [canAccess])

  async function load() {
    setLoading(true)
    try {
      const rows = await getCompanyRecognitionSummary()
      setProjects(rows)
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  if (!canAccess) return <div className="p-6 text-red-300">Unauthorized</div>

  const openRecognition = async (project) => {
    setActiveProject(project)
    // precompute by cost
    try {
      if (project.completion_method === 'cost') {
        const pct = await calculatePctCompleteByCost(project.project_id)
        setPercent(pct)
      } else if (project.completion_method === 'milestone') {
        const pct = await calculatePctCompleteByMilestone(project.project_id)
        setPercent(pct)
      } else {
        setPercent(project.pct_complete || 0)
      }
    } catch { setPercent(project.pct_complete || 0) }
    setModalOpen(true)
  }

  const confirmRecognition = async () => {
    if (!activeProject) return
    setRunning(true)
    try {
      await runRevenueRecognition({
        projectId: activeProject.project_id,
        pctComplete: percent,
        contractValue: activeProject.contract_value,
        priorRecognised: activeProject.revenue_recognised || 0,
        costToDate: activeProject.actual_cost_to_date || 0,
        periodLabel,
        recognisedBy: profile?.id,
      })
      setModalOpen(false)
      await load()
      alert('Recognition posted')
    } catch (err) {
      console.error(err)
      alert(err.message || 'Recognition failed')
    } finally { setRunning(false) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Revenue Recognition</h1>
        <div className="flex gap-2">
          <button className="rounded-lg border border-border-soft px-3 py-2 text-sm" onClick={() => { if (confirm('Run recognition for all active projects?')) { /* noop for now */ } }}>Run All</button>
          <button className="rounded-lg border border-border-soft px-3 py-2 text-sm">Export PDF</button>
          <button className="rounded-lg border border-border-soft px-3 py-2 text-sm">Export Excel</button>
        </div>
      </div>

      <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
        <table className="w-full text-sm text-slate-300">
          <thead className="text-xs text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="px-4 py-2 text-left">Project</th>
              <th className="px-4 py-2">Contract Value</th>
              <th className="px-4 py-2">% Complete</th>
              <th className="px-4 py-2">Revenue Recognised</th>
              <th className="px-4 py-2">Invoiced</th>
              <th className="px-4 py-2">Billing Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-slate-400">Loading…</td></tr>
            ) : projects.map(p => (
              <tr key={p.project_id} className="border-t border-border-soft">
                <td className="px-4 py-3">{p.project_name}</td>
                <td className="px-4 py-3">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(p.contract_value)}</td>
                <td className="px-4 py-3">{(p.pct_complete || 0).toFixed(2)}%</td>
                <td className="px-4 py-3">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(p.revenue_recognised)}</td>
                <td className="px-4 py-3">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(p.invoiced)}</td>
                <td className="px-4 py-3">{p.billing_status}</td>
                <td className="px-4 py-3">
                  <button onClick={() => openRecognition(p)} className="rounded-lg border border-border-soft px-3 py-1 text-xs">Run Recognition</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={activeProject?.project_name || 'Recognition'}>
        <div className="space-y-3">
          <div>Contract Value: {activeProject?.contract_value}</div>
          <div>Prior Recognised: {activeProject?.revenue_recognised}</div>
          <div>
            <label className="block mb-1">% Complete</label>
            <input type="number" value={percent} onChange={e => setPercent(Number(e.target.value))} className="w-full rounded-lg px-3 py-2 bg-white/5" />
          </div>
          <div>
            <label className="block mb-1">Period Label</label>
            <input type="text" value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} className="w-full rounded-lg px-3 py-2 bg-white/5" />
          </div>
          <div className="flex gap-2">
            <button onClick={confirmRecognition} disabled={running} className="rounded-lg bg-emerald-500 px-4 py-2 text-white">{running ? 'Running...' : 'Confirm'}</button>
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-border-soft px-4 py-2">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
