import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatGhsCompact } from '../../lib/formatGhs'

const DIVISIONS = [
  { name: 'Construction', icon: '🏗️', color: 'var(--color-amber)' },
  { name: 'Architecture', icon: '📐', color: 'var(--color-info)' },
  { name: 'Real Estate', icon: '🏢', color: 'var(--color-success)' },
  { name: 'Logistics', icon: '🚚', color: 'var(--color-teal)' },
]

export default function DivisionPerformanceCards({ divisionData, loading }) {
  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {DIVISIONS.map((d) => (
          <div key={d.name} className="h-64 animate-pulse rounded-3xl border border-border-soft bg-panel" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {DIVISIONS.map((div) => {
        const stats = divisionData[div.name] || {
          revenueMonth: 0,
          revenueYtd: 0,
          activeProjects: 0,
          chartData: [],
        }
        return (
          <div
            key={div.name}
            className="rounded-3xl panel-surface p-5 shadow-lg shadow-black/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-overlay text-xl" aria-hidden>
                  {div.icon}
                </span>
                <div>
                  <h3 className="portal-h3">{div.name}</h3>
                  <p className="text-sm text-text-muted">{stats.activeProjects} active projects</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-text-muted">Revenue this month</p>
                <p className="mt-1 text-lg font-semibold text-amber-200">{formatGhsCompact(stats.revenueMonth)}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">Revenue YTD</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">{formatGhsCompact(stats.revenueYtd)}</p>
              </div>
            </div>

            <div className="mt-4 h-28 w-full min-w-0">
              {stats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid var(--color-border-soft)',
                        borderRadius: '0.75rem',
                        fontSize: '0.875rem',
                      }}
                      formatter={(v) => [formatGhsCompact(v), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill={div.color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">No revenue data yet</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
