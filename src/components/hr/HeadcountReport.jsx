import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function HeadcountReport() {
  const [byDept, setByDept] = useState([])
  const [byDiv, setByDiv] = useState([])
  const [byContract, setByContract] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('department, contract_type, division:division_id(name)')
      .eq('is_active', true)

    const rows = data ?? []
    setTotal(rows.length)

    const group = (keyFn) => {
      const m = {}
      rows.forEach((r) => {
        const k = keyFn(r) || 'Unassigned'
        m[k] = (m[k] || 0) + 1
      })
      return Object.entries(m).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    }

    setByDept(group((r) => r.department))
    setByDiv(group((r) => r.division?.name))
    setByContract(group((r) => r.contract_type))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const Block = ({ title, items }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h4 className="mb-3 font-semibold text-white">{title}</h4>
      <ul className="space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex justify-between text-slate-300">
            <span className="capitalize">{i.label}</span>
            <span className="font-semibold text-violet-200">{i.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <>
          <p className="text-2xl font-semibold text-white">Active headcount: {total}</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Block title="By department" items={byDept} />
            <Block title="By division" items={byDiv} />
            <Block title="By contract type" items={byContract} />
          </div>
        </>
      )}
    </div>
  )
}
