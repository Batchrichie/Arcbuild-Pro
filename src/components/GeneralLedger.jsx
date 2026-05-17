import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AccountStatement from './AccountStatement'

export default function GeneralLedger({ readOnly = false }) {
  const { profile } = useAuth()
  const isReadOnly = readOnly || profile?.role === 'ceo'

  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [limit] = useState(50)
  const [selectedJournal, setSelectedJournal] = useState(null)
  const [showAccount, setShowAccount] = useState(null)
  const [totalCount, setTotalCount] = useState(0)

  const offset = useMemo(() => (page - 1) * limit, [page, limit])

  useEffect(() => {
    fetchPage()
  }, [page])

  async function fetchPage() {
    setLoading(true)
    const { data, error, count } = await supabase
      .from('general_ledger')
      .select('*', { count: 'exact' })
      .order('entry_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('GL fetch error', error)
    } else {
      setRows(data || [])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  async function expandJournal(journalId) {
    if (isReadOnly) return
    setSelectedJournal({ loading: true })
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('journal_entry_id', journalId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('journal expand error', error)
      setSelectedJournal(null)
    } else {
      setSelectedJournal({ journalId, lines: data || [] })
    }
  }

  function exportCsv() {
    if (isReadOnly) return
    const cols = ['entry_date','entry_number','account_code','account_name','description','debit_amount','credit_amount','amount']
    const csv = [cols.join(',')]
    for (const r of rows) {
      csv.push(cols.map(c => (r[c] ?? '')).join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'general_ledger_page_' + page + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-6 rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold text-white">General Ledger</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} className="btn">Prev</button>
          <button onClick={() => setPage(page + 1)} className="btn">Next</button>
          <button onClick={exportCsv} disabled={isReadOnly} className="btn ml-2">Export CSV</button>
        </div>
      </div>

      <div className="portal-table-scroll mt-4 rounded-3xl border border-white/10 bg-slate-950/70">
        <table className="w-full table-auto text-sm dark-table text-slate-200">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="p-2">Date</th>
              <th className="p-2">JE</th>
              <th className="p-2">Account</th>
              <th className="p-2">Description</th>
              <th className="p-2 text-right">Debit</th>
              <th className="p-2 text-right">Credit</th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={7} className="p-4 text-slate-400">Loading...</td></tr>)}
            {!loading && rows.map(r => (
              <tr key={r.ledger_id} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2 text-slate-100">{r.entry_date?.split('T')[0]}</td>
                <td className="p-2">
                  <button disabled={isReadOnly} onClick={() => expandJournal(r.journal_entry_id)} className="text-amber-300 underline disabled:text-slate-500">
                    {r.entry_number}
                  </button>
                </td>
                <td className="p-2">
                  <button onClick={() => setShowAccount(r.account_code)} className="text-slate-100 underline">
                    {r.account_code}
                  </button>
                  <div className="text-slate-400">{r.account_name}</div>
                </td>
                <td className="p-2 text-slate-100">{r.description}</td>
                <td className="p-2 text-right text-slate-100">{r.debit_amount ?? ''}</td>
                <td className="p-2 text-right text-slate-100">{r.credit_amount ?? ''}</td>
                <td className="p-2 text-right text-slate-100">{r.amount ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedJournal && selectedJournal.lines && (
        <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-[rgba(15,23,42,0.95)] p-4 shadow-sm">
          <h3 className="font-semibold text-white">Journal {selectedJournal.journalId}</h3>
          <table className="w-full text-sm mt-2 dark-table text-slate-200">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="p-2">Account</th>
                <th className="p-2 text-right">Debit</th>
                <th className="p-2 text-right">Credit</th>
                <th className="p-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {selectedJournal.lines.map(l => (
                <tr key={l.id} className="border-t border-white/10">
                  <td className="p-2 text-slate-100">{l.account_code} — {l.account_name}</td>
                  <td className="p-2 text-right text-slate-100">{l.debit_amount}</td>
                  <td className="p-2 text-right text-slate-100">{l.credit_amount}</td>
                  <td className="p-2 text-slate-100">{l.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAccount && (
        <AccountStatement accountCode={showAccount} onClose={() => setShowAccount(null)} readOnly={isReadOnly} />
      )}
    </div>
  )
}
