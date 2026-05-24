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
  const [, setTotalCount] = useState(0)

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
    <div className="mt-6 rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold text-text-primary">General Ledger</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPage(Math.max(1, page - 1))} className="btn">Prev</button>
          <button type="button" onClick={() => setPage(page + 1)} className="btn">Next</button>
          <button type="button" onClick={exportCsv} disabled={isReadOnly} className="btn ml-2">Export CSV</button>
        </div>
      </div>

      <div className="portal-table-scroll mt-4 overflow-x-auto rounded-3xl border border-border-soft bg-surface-2">
        <table className="w-full min-w-[800px] table-auto text-sm dark-table">
          <thead>
            <tr className="text-left text-text-muted">
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
            {loading && (<tr><td colSpan={7} className="p-4 text-text-muted">Loading...</td></tr>)}
            {!loading && rows.map(r => (
              <tr key={r.ledger_id} className="border-t border-border-soft hover:bg-surface-overlay/50">
                <td className="p-2 text-text-primary">{r.entry_date?.split('T')[0]}</td>
                <td className="p-2">
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => expandJournal(r.journal_entry_id)}
                    className="font-medium text-amber-700 underline decoration-amber-700/50 hover:text-amber-800 disabled:text-text-muted disabled:no-underline dark:text-amber-300 dark:decoration-amber-300/50"
                  >
                    {r.entry_number}
                  </button>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => setShowAccount(r.account_code)}
                    className="font-medium text-text-primary underline decoration-border-soft hover:text-teal-700 dark:hover:text-teal-300"
                  >
                    {r.account_code}
                  </button>
                  <div className="text-text-muted">{r.account_name}</div>
                </td>
                <td className="p-2 text-text-primary">{r.description}</td>
                <td className="p-2 text-right text-text-primary">{r.debit_amount ?? ''}</td>
                <td className="p-2 text-right text-text-primary">{r.credit_amount ?? ''}</td>
                <td className="p-2 text-right font-medium text-text-primary">{r.amount ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedJournal && selectedJournal.lines && (
        <div className="mt-4 rounded-[1.75rem] border border-border-soft bg-surface-2 p-4 shadow-sm">
          <h3 className="font-semibold text-text-primary">Journal {selectedJournal.journalId}</h3>
          <table className="mt-2 w-full text-sm dark-table">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="p-2">Account</th>
                <th className="p-2 text-right">Debit</th>
                <th className="p-2 text-right">Credit</th>
                <th className="p-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {selectedJournal.lines.map(l => (
                <tr key={l.id} className="border-t border-border-soft">
                  <td className="p-2 text-text-primary">{l.account_code} — {l.account_name}</td>
                  <td className="p-2 text-right text-text-primary">{l.debit_amount}</td>
                  <td className="p-2 text-right text-text-primary">{l.credit_amount}</td>
                  <td className="p-2 text-text-primary">{l.description}</td>
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
