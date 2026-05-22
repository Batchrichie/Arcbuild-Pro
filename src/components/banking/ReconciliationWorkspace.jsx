import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatGhs } from '../../lib/formatGhs'

export default function ReconciliationWorkspace({ onCreateJournal }) {
  const { user } = useAuth()
  const [bankAccounts, setBankAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [bankTransactions, setBankTransactions] = useState([])
  const [glEntries, setGlEntries] = useState([])
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10))
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10))
  const [statementClosingBalance, setStatementClosingBalance] = useState('0')
  const [glClosingBalance, setGlClosingBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedBankTx, setSelectedBankTx] = useState(null)
  const [selectedGlEntry, setSelectedGlEntry] = useState(null)

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    if (!selectedAccountId) return
    loadReconciliationData()
  }, [selectedAccountId])

  async function loadAccounts() {
    const { data, error } = await supabase.from('bank_accounts').select('*').order('account_name')
    if (error) {
      console.error('Failed to load bank accounts', error)
      return
    }
    setBankAccounts(data || [])
    if (data?.length) setSelectedAccountId((prev) => prev || data[0].id)
  }

  async function loadReconciliationData() {
    setLoading(true)
    try {
      const account = bankAccounts.find((item) => item.id === selectedAccountId)
      const [transactionsRes, glRes, balanceRes] = await Promise.all([
        supabase.from('bank_transactions').select('*').eq('bank_account_id', selectedAccountId).order('transaction_date', { ascending: true }),
        account?.gl_account_code
          ? supabase.from('ledger_entries').select('id,journal_entry_id,account_code,debit,credit,description').eq('account_code', account.gl_account_code).order('created_at', { ascending: false }).limit(200)
          : Promise.resolve({ data: [] }),
        account?.gl_account_code
          ? supabase.from('account_running_balance').select('account_code,running_balance,entry_date').eq('account_code', account.gl_account_code).order('entry_date', { ascending: false }).limit(1)
          : Promise.resolve({ data: [] }),
      ])

      setBankTransactions(transactionsRes.data || [])
      setGlEntries(glRes.data || [])
      setGlClosingBalance(balanceRes.data?.[0]?.running_balance ?? 0)
    } catch (err) {
      console.error('Failed to load reconciliation data', err)
    } finally {
      setLoading(false)
    }
  }

  const selectedAccount = bankAccounts.find((account) => account.id === selectedAccountId)
  const matchedMap = useMemo(() => {
    const map = new Map()
    bankTransactions.forEach((tx) => {
      if (tx.matched_ledger_entry_id) {
        map.set(tx.matched_ledger_entry_id, tx)
      }
    })
    return map
  }, [bankTransactions])

  const matchedPairs = useMemo(() => {
    return bankTransactions
      .filter((tx) => tx.matched_ledger_entry_id)
      .map((tx) => ({
        bank: tx,
        gl: glEntries.find((gl) => gl.id === tx.matched_ledger_entry_id),
      }))
      .filter((pair) => pair.gl)
  }, [bankTransactions, glEntries])

  const unmatchedBank = bankTransactions.filter((tx) => !tx.matched_ledger_entry_id && tx.match_status !== 'excluded')
  const unmatchedGl = glEntries.filter((gl) => !matchedMap.has(gl.id))

  const balanceDifference = Number(statementClosingBalance || 0) - Number(glClosingBalance || 0)
  const completionReady = Math.abs(balanceDifference) < 0.01

  const handleManualMatch = async () => {
    if (!selectedBankTx || !selectedGlEntry || !user?.id) return
    setLoading(true)
    setStatusMessage('Saving manual match…')
    try {
      const { error } = await supabase.from('bank_transactions').update({
        match_status: 'manual_match',
        matched_ledger_entry_id: selectedGlEntry.id,
        matched_journal_entry_id: selectedGlEntry.journal_entry_id,
        matched_by: user.id,
        matched_at: new Date().toISOString(),
      }).eq('id', selectedBankTx.id)
      if (error) throw error
      setSelectedBankTx(null)
      setSelectedGlEntry(null)
      await loadReconciliationData()
      setStatusMessage('Manual match saved.')
    } catch (err) {
      console.error('Manual match failed', err)
      setStatusMessage('Failed to save manual match.')
    } finally {
      setLoading(false)
    }
  }

  const handleUnmatch = async (transactionId) => {
    setLoading(true)
    setStatusMessage('Unmatching transaction…')
    try {
      const { error } = await supabase.from('bank_transactions').update({
        match_status: 'unmatched',
        matched_ledger_entry_id: null,
        matched_journal_entry_id: null,
        matched_by: null,
        matched_at: null,
      }).eq('id', transactionId)
      if (error) throw error
      await loadReconciliationData()
      setStatusMessage('Transaction unmatched.')
    } catch (err) {
      console.error('Unmatch failed', err)
      setStatusMessage('Failed to unmatch transaction.')
    } finally {
      setLoading(false)
    }
  }

  const handleExclude = async (transactionId) => {
    setLoading(true)
    setStatusMessage('Excluding transaction…')
    try {
      const { error } = await supabase.from('bank_transactions').update({
        match_status: 'excluded',
      }).eq('id', transactionId)
      if (error) throw error
      await loadReconciliationData()
      setStatusMessage('Transaction excluded.')
    } catch (err) {
      console.error('Exclude failed', err)
      setStatusMessage('Failed to exclude transaction.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    if (!selectedAccountId || !user?.id) return
    setLoading(true)
    setStatusMessage('Finalizing reconciliation…')
    try {
      const { error } = await supabase.from('bank_reconciliations').insert([{
        bank_account_id: selectedAccountId,
        period_start: periodStart,
        period_end: periodEnd,
        statement_closing_balance: Number(statementClosingBalance) || 0,
        gl_closing_balance: Number(glClosingBalance) || 0,
        unmatched_count: unmatchedBank.length + unmatchedGl.length,
        status: 'completed',
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      }])
      if (error) throw error
      setStatusMessage('Reconciliation completed.')
    } catch (err) {
      console.error('Complete reconciliation failed', err)
      setStatusMessage('Failed to complete reconciliation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Bank reconciliation</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Reconciliation workspace</h2>
          </div>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200">
            {bankAccounts.length} bank accounts
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <label className="block text-sm text-slate-300">
            <span className="mb-2 block text-slate-400">Bank account</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="">Select account</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name} — {account.bank_name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block text-slate-400">Period start</span>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block text-slate-400">Period end</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-border-soft bg-slate-950 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Statement close</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatGhs(Number(statementClosingBalance) || 0)}</p>
            <input
              type="number"
              step="0.01"
              value={statementClosingBalance}
              onChange={(e) => setStatementClosingBalance(e.target.value)}
              className="mt-4 w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
              placeholder="Closing balance"
            />
          </div>
          <div className="rounded-3xl border border-border-soft bg-slate-950 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">GL closing</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatGhs(glClosingBalance)}</p>
          </div>
          <div className="rounded-3xl border border-border-soft bg-slate-950 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Difference</p>
            <p className={`mt-3 text-3xl font-semibold ${completionReady ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatGhs(balanceDifference)}
            </p>
            <button
              type="button"
              onClick={handleComplete}
              disabled={!completionReady || !selectedAccountId || loading}
              className="mt-4 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              Complete Reconciliation
            </button>
          </div>
        </div>

        {statusMessage && <p className="mt-4 text-sm text-slate-300">{statusMessage}</p>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
          <h3 className="text-lg font-semibold text-white">Matched transactions</h3>
          <div className="mt-4 space-y-4">
            {matchedPairs.length === 0 ? (
              <p className="text-slate-400">No matched transactions yet.</p>
            ) : (
              matchedPairs.map((pair) => (
                <div key={pair.bank.id} className="rounded-3xl border border-border-soft bg-slate-950 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Bank</p>
                      <p className="text-sm text-slate-300">{pair.bank.transaction_date} · {pair.bank.description}</p>
                      <p className="mt-2 text-sm text-slate-200">{pair.bank.debit_amount ? formatGhs(pair.bank.debit_amount) : formatGhs(pair.bank.credit_amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">GL</p>
                      <p className="text-sm text-slate-300">{pair.gl.account_code} · {pair.gl.description}</p>
                      <p className="mt-2 text-sm text-slate-200">{pair.gl.debit ? formatGhs(pair.gl.debit) : formatGhs(pair.gl.credit)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnmatch(pair.bank.id)}
                    className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200"
                  >
                    Unmatch
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
          <h3 className="text-lg font-semibold text-white">Unmatched items</h3>
          <div className="mt-4 grid gap-6">
            <div className="rounded-3xl border border-border-soft bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Bank statements</p>
              {unmatchedBank.length === 0 ? (
                <p className="mt-4 text-slate-400">No unmatched bank transactions.</p>
              ) : (
                <div className="space-y-3">
                  {unmatchedBank.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => setSelectedBankTx(tx)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedBankTx?.id === tx.id ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-border-soft bg-slate-900 hover:border-emerald-400/20'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{tx.transaction_date}</span>
                        <span>{tx.debit_amount ? formatGhs(tx.debit_amount) : formatGhs(tx.credit_amount)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{tx.description}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedBankTx && (
                <div className="mt-4 space-y-3 rounded-3xl border border-border-soft bg-slate-900 p-4">
                  <p className="text-sm font-semibold text-white">Selected transaction</p>
                  <p className="text-slate-300">{selectedBankTx.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleExclude(selectedBankTx.id)}
                      className="rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-200"
                    >
                      Exclude
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBankTx(null)}
                      className="rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border-soft bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">GL entries</p>
              {unmatchedGl.length === 0 ? (
                <p className="mt-4 text-slate-400">No unmatched GL entries.</p>
              ) : (
                <div className="space-y-3">
                  {unmatchedGl.map((gl) => (
                    <button
                      key={gl.id}
                      type="button"
                      onClick={() => setSelectedGlEntry(gl)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedGlEntry?.id === gl.id ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-border-soft bg-slate-900 hover:border-emerald-400/20'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{gl.account_code}</span>
                        <span>{gl.debit ? formatGhs(gl.debit) : formatGhs(gl.credit)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{gl.description || 'No description'}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedGlEntry && (
                <div className="mt-4 space-y-3 rounded-3xl border border-border-soft bg-slate-900 p-4">
                  <p className="text-sm font-semibold text-white">Selected GL entry</p>
                  <p className="text-slate-300">{selectedGlEntry.description || 'No description'}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleManualMatch}
                      disabled={!selectedBankTx}
                      className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 disabled:opacity-50"
                    >
                      Match to transaction
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreateJournal?.({
                        description: `Journal for unmatched GL ${selectedGlEntry.account_code}`,
                        journalDate: new Date().toISOString().slice(0, 10),
                        reference: `Match ${selectedGlEntry.id.slice(0, 8)}`,
                        lines: [
                          {
                            id: `${Date.now()}-1`,
                            account_code: selectedGlEntry.account_code,
                            account_name: '',
                            debit_amount: selectedGlEntry.debit ? selectedGlEntry.debit : '',
                            credit_amount: selectedGlEntry.credit ? selectedGlEntry.credit : '',
                            line_description: selectedGlEntry.description || '',
                          },
                          {
                            id: `${Date.now()}-2`,
                            account_code: selectedAccount?.gl_account_code || '',
                            account_name: '',
                            debit_amount: selectedGlEntry.credit ? selectedGlEntry.credit : '',
                            credit_amount: selectedGlEntry.debit ? selectedGlEntry.debit : '',
                            line_description: 'Bank reconciliation adjustment',
                          },
                        ],
                      })}
                      className="rounded-full border border-slate-500/30 bg-white/5 px-4 py-2 text-sm text-slate-300"
                    >
                      Create Journal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
