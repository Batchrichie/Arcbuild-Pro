import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'
import SlideOver from '../ui/SlideOver'

export default function JournalDrillDown({ journalId, onClose }) {
  const [header, setHeader] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!journalId) return
    async function load() {
      setLoading(true)
      try {
        const [{ data: entry }, { data: ledgerLines }] = await Promise.all([
          supabase.from('journal_entries').select('id,entry_number,entry_date,description').eq('id', journalId).single(),
          supabase
            .from('ledger_entries')
            .select('id,account_code,account_name,debit_amount,credit_amount,description')
            .eq('journal_entry_id', journalId)
            .order('created_at', { ascending: true })
            .limit(50),
        ])
        setHeader(entry)
        setLines(ledgerLines ?? [])
      } catch (err) {
        console.warn('Journal drill-down failed', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [journalId])

  if (!journalId) return null

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0)

  return (
    <SlideOver
      open
      onClose={onClose}
      title={`Journal ${header?.entry_number || journalId.slice(0, 8)}`}
      width="lg"
    >
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-panel" />
      ) : (
        <>
          <p className="text-sm text-text-muted">
            {header?.entry_date} — {header?.description}
          </p>
          <p className="mt-1 text-sm font-semibold text-teal">Total: GHS {formatGhs(totalDebit)}</p>
          <div className="portal-table-scroll portal-table-wrap mt-4 rounded-2xl border border-border-soft">
            <table className="dark-table min-w-[480px] text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-sm text-text-muted">Account</th>
                  <th className="px-3 py-2 text-right text-sm text-text-muted">Debit</th>
                  <th className="px-3 py-2 text-right text-sm text-text-muted">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-text-muted-strong">
                      {l.account_code} {l.account_name}
                    </td>
                    <td className="px-3 py-2 text-right text-text-muted-strong">{l.debit_amount || '—'}</td>
                    <td className="px-3 py-2 text-right text-text-muted-strong">{l.credit_amount || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SlideOver>
  )
}
