import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { parseDbError } from '../../lib/dbErrorMessage'
import {
  approveRequest,
  getPendingApprovalForJournal,
  rejectRequest,
  submitJournalForApproval,
} from '../../services/approvalService'
import JournalDrillDown from '../accountant/JournalDrillDown'
import SlideOver from '../ui/SlideOver'
import { inputCls as clsInput } from '../../lib/portal-classes'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending approval' },
  { value: 'active', label: 'Posted' },
  { value: 'reversed', label: 'Reversed' },
]

function statusLabel(status) {
  if (status === 'DRAFT') return 'Draft'
  if (status === 'PENDING_APPROVAL') return 'Pending approval'
  if (status === 'REVERSED') return 'Reversed'
  return 'Posted'
}

function statusClass(status) {
  if (status === 'DRAFT') return 'bg-portal-overlay text-portal-muted'
  if (status === 'PENDING_APPROVAL') return 'bg-portal-warning text-portal-warning'
  if (status === 'REVERSED') return 'bg-portal-danger text-portal-danger'
  return 'bg-portal-success text-portal-success'
}

export default function ManualJournalList({ readOnly = false }) {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [approvalMap, setApprovalMap] = useState(new Map())
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
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const offset = useMemo(() => (page - 1) * limit, [page, limit])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setActionMessage('')
    setActionError('')
    try {
      let query = supabase
        .from('journal_entries')
        .select('id,entry_number,entry_date,description,reference,posted_by,status,source_type,profiles!posted_by(full_name)', { count: 'exact' })
        .eq('source_type', 'manual')

      if (filters.from) query = query.gte('entry_date', filters.from)
      if (filters.to) query = query.lte('entry_date', filters.to)
      if (filters.status === 'draft') query = query.eq('status', 'DRAFT')
      if (filters.status === 'pending') query = query.eq('status', 'PENDING_APPROVAL')
      if (filters.status === 'active') query = query.in('status', ['POSTED', 'ACTIVE'])
      if (filters.status === 'reversed') query = query.eq('status', 'REVERSED')
      if (filters.postedBy) query = query.eq('posted_by', filters.postedBy)
      if (filters.search) {
        const escaped = filters.search.replace(/'/g, "''")
        query = query.or(`description.ilike.%${escaped}%,reference.ilike.%${escaped}%`)
      }

      const { data, error, count } = await query.order('entry_date', { ascending: false }).range(offset, offset + limit - 1)
      if (error) throw error

      const rows = data || []
      setEntries(rows)
      setTotalCount(count || 0)

      const pendingIds = rows
        .filter((entry) => entry.status === 'DRAFT' || entry.status === 'PENDING_APPROVAL')
        .map((entry) => entry.id)

      if (pendingIds.length) {
        const { data: approvals, error: approvalError } = await supabase
          .from('approval_requests')
          .select('id, entity_id, status, assigned_to, submitted_by, rejection_reason')
          .eq('entity_type', 'journal')
          .eq('status', 'pending')
          .in('entity_id', pendingIds)

        if (approvalError) throw approvalError
        const map = new Map((approvals || []).map((row) => [row.entity_id, row]))
        setApprovalMap(map)
      } else {
        setApprovalMap(new Map())
      }
    } catch (err) {
      console.error('Failed to load manual journals', err)
      setActionError(parseDbError(err))
    } finally {
      setLoading(false)
    }
  }, [filters, offset])

  useEffect(() => {
    loadEntries()
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
    if (!profile?.id) {
      setReverseError('Unable to identify your profile. Please sign in again.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('reverse_journal_entry', {
        journal_id_param: reverseTarget.id,
        reversal_date_param: reverseDate,
        reason_param: reverseReason.trim(),
        actor_uuid: profile.id,
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reverse journal entry.')
      }

      setActionMessage('Journal reversed successfully.')
      setReverseTarget(null)
      loadEntries()
    } catch (err) {
      console.error('Journal reversal failed', err)
      setReverseError(parseDbError(err, err?.data))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitForApproval = async (entry) => {
    if (!profile?.id) return
    setLoading(true)
    setActionError('')
    try {
      await submitJournalForApproval(entry.id, profile.id)
      setActionMessage(`Journal ${entry.entry_number} submitted for approval.`)
      loadEntries()
    } catch (err) {
      setActionError(parseDbError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (entry) => {
    const approval = approvalMap.get(entry.id) || (await getPendingApprovalForJournal(entry.id))
    if (!approval?.id) {
      setActionError('No pending approval request found for this journal.')
      return
    }
    setLoading(true)
    setActionError('')
    try {
      await approveRequest(approval.id, profile.id)
      setActionMessage(`Journal ${entry.entry_number} approved and posted.`)
      loadEntries()
    } catch (err) {
      setActionError(parseDbError(err))
    } finally {
      setLoading(false)
    }
  }

  const openRejectModal = (entry) => {
    setRejectTarget(entry)
    setRejectReason('')
    setRejectError('')
  }

  const confirmReject = async () => {
    if (!rejectTarget) return
    if (rejectReason.trim().length < 10) {
      setRejectError('Rejection reason must be at least 10 characters.')
      return
    }
    const approval = approvalMap.get(rejectTarget.id)
    if (!approval?.id) {
      setRejectError('No pending approval request found.')
      return
    }
    setLoading(true)
    try {
      await rejectRequest(approval.id, profile.id, rejectReason.trim())
      setActionMessage(`Journal ${rejectTarget.entry_number} rejected and returned to draft.`)
      setRejectTarget(null)
      loadEntries()
    } catch (err) {
      setRejectError(parseDbError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const renderActions = (entry) => {
    const approval = approvalMap.get(entry.id)
    const isSubmitter = approval?.submitted_by === profile?.id || entry.posted_by === profile?.id
    const isAssignee = approval?.assigned_to === profile?.id

    if (!readOnly && entry.status === 'DRAFT' && isSubmitter) {
      return (
        <button
          type="button"
          onClick={() => handleSubmitForApproval(entry)}
          className="min-touch rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-xs font-semibold text-portal-muted transition hover:border-portal-info hover:bg-portal-info"
        >
          Submit for approval
        </button>
      )
    }

    if (!readOnly && entry.status === 'PENDING_APPROVAL' && isAssignee && !isSubmitter) {
      return (
        <>
          <button
            type="button"
            onClick={() => handleApprove(entry)}
            className="min-touch rounded-full border border-border-soft bg-portal-success px-3 py-2 text-xs font-semibold text-portal-success transition hover:bg-portal-success"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => openRejectModal(entry)}
            className="min-touch rounded-full border border-border-soft bg-portal-danger px-3 py-2 text-xs font-semibold text-portal-danger transition hover:bg-portal-danger"
          >
            Reject
          </button>
        </>
      )
    }

    if (!readOnly && !['DRAFT', 'PENDING_APPROVAL', 'REVERSED'].includes(entry.status)) {
      return (
        <button
          type="button"
          onClick={() => openReverseModal(entry)}
          className="min-touch rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-xs text-portal-muted transition hover:border-portal-danger hover:text-portal-danger"
        >
          Reverse
        </button>
      )
    }

    return null
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-portal-muted">Journal History</p>
            <h2 className="mt-2 text-2xl font-semibold text-portal-primary">Manual journal entries</h2>
          </div>
          {readOnly && (
            <span className="rounded-full border border-border-soft bg-portal-input px-4 py-2 text-sm text-portal-muted">
              Read-only
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">From</span>
            <input type="date" value={filters.from} onChange={(e) => handleFilterChange('from', e.target.value)} className={clsInput} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">To</span>
            <input type="date" value={filters.to} onChange={(e) => handleFilterChange('to', e.target.value)} className={clsInput} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Posted by</span>
            <select value={filters.postedBy} onChange={(e) => handleFilterChange('postedBy', e.target.value)} className={clsInput}>
              <option value="">All</option>
              {postedByOptions.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Status</span>
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className={clsInput}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className="text-xs uppercase tracking-[0.2em] text-portal-muted">Search</span>
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
        <div className="portal-table-scroll overflow-x-auto rounded-3xl border border-border-soft bg-portal-input">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-xs uppercase tracking-[0.24em] text-portal-muted">
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
                <tr><td colSpan={7} className="p-4 text-portal-muted">Loading journal entries...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-portal-muted">No manual journal entries found.</td></tr>
              ) : (
                entries.map((entry) => {
                  const postedByName = entry.profiles?.full_name || 'Unknown'
                  const isReversed = entry.status === 'REVERSED'
                  return (
                    <tr
                      key={entry.id}
                      className={`border-t border-border-soft ${isReversed ? 'opacity-70 line-through text-portal-muted' : 'hover:bg-portal-overlay'}`}
                    >
                      <td className="px-3 py-3 text-portal-primary">{entry.entry_number}</td>
                      <td className="px-3 py-3 text-portal-primary">{entry.entry_date}</td>
                      <td className="px-3 py-3 text-portal-primary">{entry.description}</td>
                      <td className="px-3 py-3 text-portal-primary">{entry.reference || '—'}</td>
                      <td className="px-3 py-3 text-portal-primary">{postedByName}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(entry.status)}`}>
                          {statusLabel(entry.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedJournal(entry.id)}
                          className="min-touch rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-xs text-portal-muted transition hover:border-portal-info hover:bg-portal-overlay"
                        >
                          View
                        </button>
                        {renderActions(entry)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-portal-muted">Showing {entries.length} of {totalCount || entries.length} entries</p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))} className="min-touch rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted disabled:cursor-not-allowed disabled:opacity-40">Prev</button>
            <button type="button" disabled={entries.length < limit} onClick={() => setPage((prev) => prev + 1)} className="min-touch rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>

        {actionMessage && (
          <div className="mt-4 rounded-2xl border border-portal-success bg-portal-success p-4 text-sm text-portal-success">{actionMessage}</div>
        )}
        {actionError && (
          <div className="mt-4 rounded-2xl border border-portal-danger bg-portal-danger p-4 text-sm text-portal-danger">{actionError}</div>
        )}
      </div>

      <SlideOver open={Boolean(reverseTarget)} onClose={() => setReverseTarget(null)} title={reverseTarget ? `Reverse journal ${reverseTarget.entry_number}` : 'Reverse journal'} width="lg" footer={
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={confirmReverse} className="min-touch rounded-full border border-border-soft bg-portal-danger px-4 py-2 text-sm font-semibold text-portal-danger">Confirm reversal</button>
          <button type="button" onClick={() => setReverseTarget(null)} className="min-touch rounded-full border border-border-soft bg-portal-input px-4 py-2 text-sm text-portal-muted-strong">Cancel</button>
        </div>
      }>
        {reverseTarget && (
          <>
            <p className="text-sm text-portal-muted">Provide a reversal date and reason.</p>
            <label className="portal-label block space-y-2">
              <span>Reversal date</span>
              <input type="date" value={reverseDate} onChange={(e) => setReverseDate(e.target.value)} className={clsInput} />
            </label>
            <label className="portal-label block space-y-2">
              <span>Reason</span>
              <textarea rows={4} value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} className={clsInput} placeholder="Enter at least 20 characters to explain why this journal is being reversed." />
            </label>
            {reverseError && <p className="text-sm text-portal-danger">{reverseError}</p>}
          </>
        )}
      </SlideOver>

      <SlideOver open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title={rejectTarget ? `Reject journal ${rejectTarget.entry_number}` : 'Reject journal'} width="lg" footer={
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={confirmReject} className="min-touch rounded-full border border-border-soft bg-portal-danger px-4 py-2 text-sm font-semibold text-portal-danger">Confirm rejection</button>
          <button type="button" onClick={() => setRejectTarget(null)} className="min-touch rounded-full border border-border-soft bg-portal-input px-4 py-2 text-sm text-portal-muted-strong">Cancel</button>
        </div>
      }>
        {rejectTarget && (
          <>
            <p className="text-sm text-portal-muted">Rejection reason is required before returning this journal to draft.</p>
            <label className="portal-label block space-y-2">
              <span>Reason</span>
              <textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={clsInput} placeholder="Enter at least 10 characters." />
            </label>
            {rejectError && <p className="text-sm text-portal-danger">{rejectError}</p>}
          </>
        )}
      </SlideOver>

      {selectedJournal && (
        <JournalDrillDown journalId={selectedJournal} onClose={() => setSelectedJournal(null)} />
      )}
    </div>
  )
}
