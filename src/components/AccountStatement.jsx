import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AccountStatement({ accountCode, onClose, readOnly = false }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accountCode) return
    fetchStatement()
  }, [accountCode])

  async function fetchStatement() {
    setLoading(true)
    const { data, error } = await supabase
      .from('account_running_balance')
      .select('*')
      .eq('account_code', accountCode)
      .order('entry_date', { ascending: true })
      .limit(1000)

    if (error) {
      console.error('account statement fetch', error)
      setRows([])
    } else setRows(data || [])
    setLoading(false)
  }

  const opening = rows.length ? (rows[0].running_balance - (rows[0].amount || 0)) : 0
  const closing = rows.length ? rows[rows.length - 1].running_balance : 0

  const sparkData = rows.map(r => Number(r.running_balance || 0))

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="ml-auto w-full max-w-2xl bg-white shadow-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Account Statement — {accountCode}</h3>
            <div className="text-sm text-slate-600">Opening: {opening} · Closing: {closing}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn">Close</button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <svg width="100%" height="48">
              {sparkData.length > 1 && (() => {
                const min = Math.min(...sparkData)
                const max = Math.max(...sparkData)
                const range = max - min || 1
                const stepX = 100 / (sparkData.length - 1)
                return sparkData.map((v, i) => {
                  const x = i * stepX
                  const y = 40 - ((v - min) / range) * 36
                  return <circle key={i} cx={`${x}%`} cy={y} r="1.5" fill="#0f172a" />
                })
              })()}
            </svg>
          </div>

          {loading && <div>Loading...</div>}

          <div className="overflow-y-auto max-h-96 border rounded">
            <table className="w-full text-sm">
              <thead className="text-slate-600"><tr><th className="p-2">Date</th><th className="p-2">JE</th><th className="p-2">Desc</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2 text-right">Running</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ledger_id} className="border-t"><td className="p-2">{r.entry_date?.split('T')[0]}</td><td className="p-2">{r.entry_number}</td><td className="p-2">{r.description}</td><td className="p-2 text-right">{r.debit_amount}</td><td className="p-2 text-right">{r.credit_amount}</td><td className="p-2 text-right">{r.running_balance}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="flex-1" onClick={onClose} />
    </div>
  )
}
