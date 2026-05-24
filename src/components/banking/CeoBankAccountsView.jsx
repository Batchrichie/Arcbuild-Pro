import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'

function maskAccountNumber(value) {
  if (!value) return '—'
  const trimmed = String(value).trim()
  if (trimmed.length <= 4) return trimmed
  return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`
}

export default function CeoBankAccountsView() {
  const [accounts, setAccounts] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadAccounts() {
    setLoading(true)
    try {
      const { data: accountData, error: accountError } = await supabase.from('bank_accounts').select('*').order('account_name')
      if (accountError) throw accountError
      setAccounts(accountData || [])

      const codes = [...new Set(accountData?.map((account) => account.gl_account_code).filter(Boolean))]
      if (codes.length) {
        const { data: balanceData, error: balanceError } = await supabase
          .from('account_running_balance')
          .select('account_code,running_balance,entry_date')
          .in('account_code', codes)
          .order('entry_date', { ascending: false })

        if (balanceError) throw balanceError
        const grouped = {};
        (balanceData || []).forEach((row) => {
          if (!grouped[row.account_code]) grouped[row.account_code] = row.running_balance
        })
        setBalances(grouped)
      }
    } catch (err) {
      console.error('Failed to load CEO bank account view', err)
      setError('Unable to load bank account balances.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const rows = useMemo(() => accounts.map((account) => ({
    ...account,
    gl_balance: account.gl_account_code ? balances[account.gl_account_code] ?? 0 : null,
  })), [accounts, balances])

  return (
    <div className="rounded-4xl border border-border-soft bg-surface-overlay p-6 shadow-xl shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="portal-section-eyebrow">Bank overview</p>
          <h2 className="portal-h2 mt-2">Bank account balances</h2>
        </div>
        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200">
          {accounts.length} accounts
        </span>
      </div>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm text-text-muted-strong">
          <thead className="text-text-muted">
            <tr>
              <th className="px-3 py-3 text-left">Account</th>
              <th className="px-3 py-3 text-left">Bank</th>
              <th className="px-3 py-3 text-left">Account #</th>
              <th className="px-3 py-3 text-left">Currency</th>
              <th className="px-3 py-3 text-left">GL code</th>
              <th className="px-3 py-3 text-right">GL balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-4 text-center text-slate-400">Loading bank accounts…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="p-4 text-center text-slate-400">No bank accounts registered.</td></tr>
            ) : (
              rows.map((account) => (
                <tr key={account.id} className="border-t border-border-soft">
                  <td className="px-3 py-3 text-slate-200">{account.account_name}</td>
                  <td className="px-3 py-3 text-slate-200">{account.bank_name}</td>
                  <td className="px-3 py-3 text-slate-200">{maskAccountNumber(account.account_number)}</td>
                  <td className="px-3 py-3 text-slate-200">{account.currency}</td>
                  <td className="px-3 py-3 text-slate-200">{account.gl_account_code || '—'}</td>
                  <td className="px-3 py-3 text-right text-slate-200">{account.gl_balance != null ? formatGhs(account.gl_balance) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
