import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import JournalDrillDown from '../accountant/JournalDrillDown'
import SlideOver from '../ui/SlideOver'
import { inputCls as clsInput } from '../../lib/portal-classes'

export default function ManualJournalList({ readOnly = false }) {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 25
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    postedBy: '',
    status: 'all',
    search: '',
  })
  const [selectedJournal, setSelectedJournal] = useState(null)
  const [reverseTarget, setReverseTarget] = useState(null)
  const [reverseDate, setReverseDate] = useState(new Date().toISOString().split('T')[0])
  const [reverseReason, setReverseReason] = useState('')
  const [reverseError, setReverseError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const offset = useMemo(() => (page - 1) * limit, [page, limit])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setActionMessage('')
    try {
      let query = supabase
        .from('journal_entries')
        .select('id,entry_number,entry_date,description,reference,posted_by,is_reversed,source_type,profiles!posted_by(full_name)', { count: 'exact' })
        .eq('source_type', 'manual')

      if (filters.from) query = query.gte('entry_date', filters.from)
      if (filters.to) query = query.lte('entry_date', filters.to)
      if (filters.status === 'active') query = query.is('is_reversed', false)
      if (filters.status === 'reversed') query = query.is('is_reversed', true)
      if (filters.postedBy) query = query.eq('posted_by', filters.postedBy)
      if (filters.search) {
        const escaped = filters.search.replace(/'/g, "''")
        query = query.or(`description.ilike.%${escaped}%,reference.ilike.%${escaped}%`)
      }

      const { data, error, count } = await query.order('entry_date', { ascending: false }).range(offset, offset + limit - 1)
      if (error) throw error
      setEntries(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Failed to load manual journals', err)
    } finally {
      setLoading(false)
    }
  }, [filters, offset])

  useEffect(() => {
    const fetchEntries = async () => {
      await loadEntries()
    }

    fetchEntries()
  }, [loadEntries])

  const postedByOptions = useMemo(() => {
    const map = new Map()
    entries.forEach((entry) => {
      if (entry.posted_by) {
        map.set(entry.posted_by, entry.profiles?.full_name || 'Unknown')
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [entries])

  const openReverseModal = (entry) => {
    setReverseTarget(entry)
    setReverseDate(new Date().toISOString().split('T')[0])
    setReverseReason('')
    setReverseError('')
  }

  const confirmReverse = async () => {
    if (!reverseTarget) return
    if (reverseReason.trim().length < 20) {
      setReverseError('Reason must be at least 20 characters.')
      return
    }
    if (!user?.id) {
      setReverseError('Unable to identify current user.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('reverse_journal_entry', {
        journal_id_param: reverseTarget.id,
        reversal_date_param: reverseDate,
        reason_param: reverseReason.trim(),
        actor_uuid: user.id,
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reverse journal entry.')
      }

      setActionMessage(`Journal reversed successfully.`)
      setReverseTarget(null)
      loadEntries()
    } catch (err) {
      console.error('Journal reversal failed', err)
      setReverseError(err.message || 'Unable to reverse journal entry.')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Journal History</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Manual journal entries</h2>
          </div>
          {readOnly && (
            <span className="rounded-full border border-slate-500/30 bg-slate-700/20 px-4 py-2 text-sm text-slate-300">
              Read-only
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
              className={clsInput}
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
              className={clsInput}
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Posted by</span>
            <select
              value={filters.postedBy}
              onChange={(e) => handleFilterChange('postedBy', e.target.value)}
              className={clsInput}
            >
              <option value="">All</option>
              {postedByOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</span>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className={clsInput}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="reversed">Reversed</option>
            </select>
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Search</span>
            <input
              type="search"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by description or reference"
              className={clsInput}
            />
          </label>
        </div>
      </div>

      <div className="rounded-4xl panel-surface p-4 shadow-xl shadow-black/10">
        <div className="portal-table-scroll overflow-x-auto rounded-3xl border border-border-soft bg-slate-950/80">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                <th className="px-3 py-3">JE</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Reference</th>
                <th className="px-3 py-3">Posted By</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-slate-400">
                    Loading journal entries...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-slate-400">
                    No manual journal entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const postedByName = entry.profiles?.full_name || 'Unknown'
                  const isReversed = entry.is_reversed
                  return (
                    <tr
                      key={entry.id}
                      className={`border-t border-border-soft ${isReversed ? 'opacity-70 line-through text-slate-500' : 'hover:bg-white/5'}`}
                    >
                      <td className="px-3 py-3 text-slate-100">{entry.entry_number}</td>
                      <td className="px-3 py-3 text-slate-200">{entry.entry_date}</td>
                      <td className="px-3 py-3 text-slate-200">{entry.description}</td>
                      <td className="px-3 py-3 text-slate-200">{entry.reference || '—'}</td>
                      <td className="px-3 py-3 text-slate-200">{postedByName}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isReversed ? 'bg-rose-500/15 text-rose-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                          {isReversed ? 'Reversed' : 'Active'}
                        </span>
                      </td>
                      <td className="px-3 py-3 space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedJournal(entry.id)}
                          className="min-touch rounded-full border border-border-soft bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:border-teal-400/30"
                        >
                          View
                        </button>
                        {!readOnly && !isReversed && (
                          <button
                            type="button"
                            onClick={() => openReverseModal(entry)}
                            className="min-touch rounded-full border border-border-soft bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:border-rose-400/30 hover:text-rose-200"
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Showing {entries.length} of {totalCount || entries.length} entries</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={entries.length < limit}
              onClick={() => setPage((prev) => prev + 1)}
              className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {actionMessage}
          </div>
        )}
      </div>

      <SlideOver
        open={Boolean(reverseTarget)}
        onClose={() => setReverseTarget(null)}
        title={reverseTarget ? `Reverse journal ${reverseTarget.entry_number}` : 'Reverse journal'}
        width="lg"
        footer={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmReverse}
              className="min-touch rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100"
            >
              Confirm reversal
            </button>
            <button
              type="button"
              onClick={() => setReverseTarget(null)}
              className="min-touch rounded-full border border-border-soft bg-panel px-4 py-2 text-sm text-text-muted-strong"
            >
              Cancel
            </button>
          </div>
        }
      >
        {reverseTarget && (
          <>
            <p className="text-sm text-text-muted">Provide a reversal date and reason.</p>
            <label className="portal-label block space-y-2">
              <span>Reversal date</span>
              <input type="date" value={reverseDate} onChange={(e) => setReverseDate(e.target.value)} className={clsInput} />
            </label>
            <label className="portal-label block space-y-2">
              <span>Reason</span>
              <textarea
                rows={4}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                className={clsInput}
                placeholder="Enter at least 20 characters to explain why this journal is being reversed."
              />
            </label>
            {reverseError && <p className="text-sm text-rose-300">{reverseError}</p>}
          </>
        )}
      </SlideOver>

      {selectedJournal && (
        <JournalDrillDown journalId={selectedJournal} onClose={() => setSelectedJournal(null)} />
      )}
    </div>
  )
}
