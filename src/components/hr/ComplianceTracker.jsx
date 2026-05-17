import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { downloadCsv } from '../../lib/hr-config'

function Tick({ ok }) {
  return ok ? (
    <span className="text-emerald-400" aria-label="Yes">✓</span>
  ) : (
    <span className="text-red-400" aria-label="No">✗</span>
  )
}

export default function ComplianceTracker() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('id, employee_number, tin, ssnit_number, bank_account, termination_date, contract_type, profiles:profile_id(full_name)')
      .order('employee_number')
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = () => {
    const header = ['Employee', 'Number', 'TIN', 'SSNIT', 'Bank', 'Contract end']
    const body = rows.map((r) => [
      r.profiles?.full_name ?? '',
      r.employee_number,
      r.tin ? 'Yes' : 'No',
      r.ssnit_number ? 'Yes' : 'No',
      r.bank_account ? 'Yes' : 'No',
      r.termination_date || (r.contract_type === 'permanent' ? 'Permanent' : '—'),
    ])
    downloadCsv([header, ...body], 'hr-compliance.csv')
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={exportCsv} className="rounded-full border border-violet-400/30 bg-violet-500/15 px-5 py-2.5 text-sm font-semibold text-violet-100">
        Export CSV
      </button>
      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 text-center">TIN</th>
                <th className="px-4 py-3 text-center">SSNIT</th>
                <th className="px-4 py-3 text-center">Bank</th>
                <th className="px-4 py-3">Contract end</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">{r.profiles?.full_name ?? r.employee_number}</td>
                  <td className="px-4 py-3 text-center"><Tick ok={!!r.tin} /></td>
                  <td className="px-4 py-3 text-center"><Tick ok={!!r.ssnit_number} /></td>
                  <td className="px-4 py-3 text-center"><Tick ok={!!r.bank_account} /></td>
                  <td className="px-4 py-3 text-slate-400">{r.termination_date || (r.contract_type === 'permanent' ? 'Permanent' : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
