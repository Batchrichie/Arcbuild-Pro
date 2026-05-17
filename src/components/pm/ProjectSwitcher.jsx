import { usePmProject } from '../../context/PmProjectContext'

export default function ProjectSwitcher({ className = '' }) {
  const { projects, selectedProjectId, selectProject, loading } = usePmProject()

  if (loading) {
    return <div className={`h-12 animate-pulse rounded-2xl bg-white/10 ${className}`} />
  }

  if (!projects.length) {
    return (
      <p className={`rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ${className}`}>
        No projects assigned to you yet.
      </p>
    )
  }

  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-slate-400">Active project</label>
      <select
        value={selectedProjectId}
        onChange={(e) => selectProject(e.target.value)}
        className="min-touch w-full rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-base font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id} className="bg-slate-900">
            {p.name}
          </option>
        ))}
      </select>
    </div>
  )
}
