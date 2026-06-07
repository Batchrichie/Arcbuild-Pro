import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Banknote, Clock3, DollarSign, FileCheck, Layers, ShieldAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { liabilityBalance } from '../../lib/formatGhs'
import ActionQueue from '../ui/ActionQueue'
import ReceivablesAgeing from './ReceivablesAgeing'
import TaxLiabilitiesPanel from './TaxLiabilitiesPanel'
import RecentJournalEntries from './RecentJournalEntries'

export default function AccountantDashboard({ onNavigate, onJournalSelect }) {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({
    pendingApproval: 0,
    milestoneQueue: 0,
    overdue: 0,
    payrollDraft: 0,
    unreconciledBank: 0,
    taxLiabilities: 0,
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
        bankRes,
        taxRes,
        journalRes,
      ] = await Promise.all([
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('milestone_invoice_queue').select('milestone_id', { count: 'exact', head: true }),
        supabase.from('invoices').select('expected_receipt_ghs, due_date, created_at').eq('status', 'sent'),
        supabase.from('payroll_runs').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase
          .from('bank_transactions')
          .select('id', { count: 'exact', head: true })
          .is('matched_ledger_entry_id', null)
          .neq('match_status', 'excluded'),
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

      const taxLiabilityCount = (taxRes.data ?? []).filter((row) => Number(row.balance) > 0).length

      setCounts({
        pendingApproval: pendingRes.count ?? 0,
        milestoneQueue: milestoneRes.count ?? 0,
        overdue,
        payrollDraft: draftPayrollRes.count ?? 0,
        unreconciledBank: bankRes.count ?? 0,
        taxLiabilities: taxLiabilityCount,
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Action dashboard</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            id: 'pending-approval',
            title: 'Invoices Pending Approval',
            value: counts.pendingApproval,
            icon: FileCheck,
            actionLabel: 'Review',
            onClick: () => onNavigate('invoice-list'),
            accent: 'border-l-4 border-l-blue-500',
          },
          {
            id: 'milestone-queue',
            title: 'Milestone Invoice Queue',
            value: counts.milestoneQueue,
            icon: Layers,
            actionLabel: 'Process',
            onClick: () => onNavigate('milestone-queue'),
            accent: 'border-l-4 border-l-yellow-500',
          },
          {
            id: 'overdue-invoices',
            title: 'Overdue Invoices',
            value: counts.overdue,
            icon: AlertTriangle,
            actionLabel: 'View',
            onClick: () => onNavigate('invoice-list'),
            accent: 'border-l-4 border-l-red-500',
          },
          {
            id: 'payroll-draft',
            title: 'Payroll Draft',
            value: counts.payrollDraft,
            icon: DollarSign,
            actionLabel: 'Process',
            onClick: () => onNavigate('payroll-runs'),
            accent: 'border-l-4 border-l-green-500',
          },
        ].map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              disabled={loading}
              className={`group flex h-[72px] items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 text-left transition hover:border-slate-500/70 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/20 disabled:cursor-wait disabled:opacity-80 ${card.accent}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-gray-50 dark:bg-slate-800 text-amber-300">
                  {loading ? (
                    <div className="h-5 w-5 rounded-full bg-gray-200/40 dark:bg-slate-700/40 animate-pulse" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-gray-500 dark:text-gray-400">{card.title}</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">{loading ? '—' : card.value}</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 rounded-full bg-white/5 dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300 transition group-hover:bg-white/10">
                {card.actionLabel}
              </span>
            </button>
          )
        })}
      </div>

      <ActionQueue
        title="Priority work queue"
        subtitle="High-priority items that need accountant attention"
        loading={loading}
        items={[
          {
            id: 'pending-approval',
            label: 'Pending approvals',
            value: counts.pendingApproval,
            detail: 'Invoices waiting review',
            icon: FileCheck,
            actionLabel: 'Review',
            onClick: () => onNavigate('invoice-list'),
          },
          {
            id: 'overdue-invoices',
            label: 'Overdue invoices',
            value: counts.overdue,
            detail: 'Sent invoices past due date',
            icon: Clock3,
            actionLabel: 'View',
            onClick: () => onNavigate('invoice-list'),
          },
          {
            id: 'draft-payroll',
            label: 'Draft payroll',
            value: counts.payrollDraft,
            detail: 'Payroll runs awaiting processing',
            icon: DollarSign,
            actionLabel: 'Process',
            onClick: () => onNavigate('payroll-runs'),
          },
          {
            id: 'unreconciled-bank',
            label: 'Unreconciled bank items',
            value: counts.unreconciledBank,
            detail: 'Bank transactions needing reconciliation',
            icon: Banknote,
            actionLabel: 'Reconcile',
            onClick: () => onNavigate('reconciliation'),
          },
          {
            id: 'tax-liabilities',
            label: 'Tax liabilities',
            value: counts.taxLiabilities,
            detail: 'Tax accounts with outstanding balances',
            icon: ShieldAlert,
            actionLabel: 'Review',
            onClick: () => onNavigate('chart-of-accounts'),
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <ReceivablesAgeing data={ageing} loading={loading} />
        <TaxLiabilitiesPanel balances={taxBalances} loading={loading} />
        <RecentJournalEntries entries={journalEntries} loading={loading} onSelect={onJournalSelect} />
      </div>
    </div>
  )
}
