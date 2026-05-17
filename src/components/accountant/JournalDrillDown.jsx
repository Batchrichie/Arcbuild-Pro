import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'

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
          supabase.from('journal_entries').select('*').eq('id', journalId).single(),
          supabase
            .from('ledger_entries')
            .select('*')
            .eq('journal_entry_id', journalId)
            .order('created_at', { ascending: true }),
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
    <>
      <button type="button" className="portal-slide-over-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="portal-slide-over-panel p-4 sm:p-6" role="dialog" aria-modal="true">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">
            Journal {header?.entry_number || journalId.slice(0, 8)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-touch rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300"
          >
            Close
          </button>
        </div>
        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-white/5" />
        ) : (
          <>
            <p className="text-sm text-slate-400">{header?.entry_date} — {header?.description}</p>
            <p className="mt-1 text-sm font-semibold text-teal-200">Total: GHS {formatGhs(totalDebit)}</p>
            <div className="portal-table-scroll mt-4 rounded-2xl border border-white/10">
              <table className="dark-table min-w-[480px] text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-sm text-slate-400">Account</th>
                    <th className="px-3 py-2 text-right text-sm text-slate-400">Debit</th>
                    <th className="px-3 py-2 text-right text-sm text-slate-400">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 text-slate-200">
                        {l.account_code} {l.account_name}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{l.debit_amount || '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{l.credit_amount || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
