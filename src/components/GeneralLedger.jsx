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
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">General Ledger</h2>
        <div className="flex gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} className="btn">Prev</button>
          <button onClick={() => setPage(page + 1)} className="btn">Next</button>
          <button onClick={exportCsv} disabled={isReadOnly} className="btn ml-2">Export CSV</button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="text-left text-slate-600">
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
            {loading && (<tr><td colSpan={7} className="p-4">Loading...</td></tr>)}
            {!loading && rows.map(r => (
              <tr key={r.ledger_id} className="border-t hover:bg-slate-50">
                <td className="p-2">{r.entry_date?.split('T')[0]}</td>
                <td className="p-2">
                  <button disabled={isReadOnly} onClick={() => expandJournal(r.journal_entry_id)} className="text-indigo-600 underline">
                    {r.entry_number}
                  </button>
                </td>
                <td className="p-2">
                  <button onClick={() => setShowAccount(r.account_code)} className="text-slate-700 underline">
                    {r.account_code}
                  </button>
                  <div className="text-slate-500">{r.account_name}</div>
                </td>
                <td className="p-2">{r.description}</td>
                <td className="p-2 text-right">{r.debit_amount ?? ''}</td>
                <td className="p-2 text-right">{r.credit_amount ?? ''}</td>
                <td className="p-2 text-right">{r.amount ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedJournal && selectedJournal.lines && (
        <div className="mt-4 rounded border bg-white p-4 shadow-sm">
          <h3 className="font-semibold">Journal {selectedJournal.journalId}</h3>
          <table className="w-full text-sm mt-2">
            <thead><tr className="text-left text-slate-600"><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th>Description</th></tr></thead>
            <tbody>
              {selectedJournal.lines.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">{l.account_code} — {l.account_name}</td>
                  <td className="p-2 text-right">{l.debit_amount}</td>
                  <td className="p-2 text-right">{l.credit_amount}</td>
                  <td className="p-2">{l.description}</td>
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
