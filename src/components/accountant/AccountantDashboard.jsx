import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { liabilityBalance } from '../../lib/formatGhs'
import ReceivablesAgeing from './ReceivablesAgeing'
import TaxLiabilitiesPanel from './TaxLiabilitiesPanel'
import RecentJournalEntries from './RecentJournalEntries'

function ActionCard({ title, count, actionLabel, onAction, accent }) {
  return (
    <div className="rounded-3xl panel-surface p-5 shadow-lg shadow-black/10">
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{count}</p>
      <button
        type="button"
        onClick={onAction}
        className="min-touch mt-4 w-full rounded-full border border-teal-400/30 bg-teal-500/15 px-4 py-2.5 text-sm font-semibold text-teal-200 transition hover:bg-teal-500/25"
      >
        {actionLabel}
      </button>
    </div>
  )
}

export default function AccountantDashboard({ onNavigate, onJournalSelect }) {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({
    pendingApproval: 0,
    milestoneQueue: 0,
    overdue: 0,
    payrollDraft: 0,
  })
  const [ageing, setAgeing] = useState(null)
  const [taxBalances, setTaxBalances] = useState({})
  const [journalEntries, setJournalEntries] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date()

      const [
        pendingRes,
        milestoneRes,
        sentRes,
        draftPayrollRes,
        taxRes,
        journalRes,
      ] = await Promise.all([
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('milestone_invoice_queue').select('milestone_id', { count: 'exact', head: true }),
        supabase.from('invoices').select('expected_receipt_ghs, due_date, created_at').eq('status', 'sent'),
        supabase.from('payroll_runs').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase
          .from('balance_sheet')
          .select('account_code, balance')
          .in('account_code', ['2102', '2103', '2104', '2105', '2106']),
        supabase
          .from('journal_entries')
          .select('id, entry_number, entry_date, description, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const sent = sentRes.data ?? []
      let overdue = 0
      const brackets = {
        current: { count: 0, total: 0 },
        d31_60: { count: 0, total: 0 },
        d61_90: { count: 0, total: 0 },
        d90plus: { count: 0, total: 0 },
      }

      sent.forEach((inv) => {
        const amount = Number(inv.expected_receipt_ghs || 0)
        const refDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.created_at)
        const daysPastDue = Math.floor((today - refDate) / (1000 * 60 * 60 * 24))

        if (daysPastDue > 30) overdue += 1

        if (daysPastDue <= 30) {
          brackets.current.count += 1
          brackets.current.total += amount
        } else if (daysPastDue <= 60) {
          brackets.d31_60.count += 1
          brackets.d31_60.total += amount
        } else if (daysPastDue <= 90) {
          brackets.d61_90.count += 1
          brackets.d61_90.total += amount
        } else {
          brackets.d90plus.count += 1
          brackets.d90plus.total += amount
        }
      })

      const taxMap = {}
      ;(taxRes.data ?? []).forEach((r) => {
        taxMap[r.account_code] = liabilityBalance(r.balance)
      })

      const journals = journalRes.data ?? []
      const journalIds = journals.map((j) => j.id)
      const totalsMap = new Map()

      if (journalIds.length > 0) {
        const { data: lines } = await supabase
          .from('ledger_entries')
          .select('journal_entry_id, debit_amount, credit_amount')
          .in('journal_entry_id', journalIds)

        ;(lines ?? []).forEach((line) => {
          const prev = totalsMap.get(line.journal_entry_id) || 0
          totalsMap.set(
            line.journal_entry_id,
            prev + Math.max(Number(line.debit_amount || 0), Number(line.credit_amount || 0))
          )
        })
      }

      setCounts({
        pendingApproval: pendingRes.count ?? 0,
        milestoneQueue: milestoneRes.count ?? 0,
        overdue,
        payrollDraft: draftPayrollRes.count ?? 0,
      })
      setAgeing(brackets)
      setTaxBalances(taxMap)
      setJournalEntries(
        journals.map((j) => ({
          ...j,
          totalAmount: totalsMap.get(j.id) || 0,
        }))
      )
    } catch (err) {
      console.warn('Accountant dashboard load failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-8">
      <div>
        <p className="portal-section-eyebrow uppercase tracking-[0.24em]">Today&apos;s work</p>
        <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Action dashboard</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <ActionCard
          title="Invoices Pending Approval"
          count={loading ? '—' : counts.pendingApproval}
          actionLabel="Review"
          accent="text-amber-300"
          onAction={() => onNavigate('invoice-list')}
        />
        <ActionCard
          title="Milestone Invoice Queue"
          count={loading ? '—' : counts.milestoneQueue}
          actionLabel="Process"
          accent="text-rose-300"
          onAction={() => onNavigate('milestone-queue')}
        />
        <ActionCard
          title="Overdue Invoices"
          count={loading ? '—' : counts.overdue}
          actionLabel="View"
          accent="text-red-300"
          onAction={() => onNavigate('invoice-list')}
        />
        <ActionCard
          title="Payroll Draft"
          count={loading ? '—' : counts.payrollDraft}
          actionLabel="Process"
          accent="text-indigo-300"
          onAction={() => onNavigate('payroll-runs')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReceivablesAgeing data={ageing} loading={loading} />
        <TaxLiabilitiesPanel balances={taxBalances} loading={loading} />
        <RecentJournalEntries entries={journalEntries} loading={loading} onSelect={onJournalSelect} />
      </div>
    </div>
  )
}
