import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatGhs } from '../../lib/formatGhs'

const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR']
const CASH_ACCOUNTS = ['1101', '1102', '1103', '1104']

function maskAccountNumber(value) {
  if (!value) return '—'
  const trimmed = String(value).trim()
  if (trimmed.length <= 4) return trimmed
  return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`
}

export default function BankAccountRegistry() {
  const { user, profile } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [cashAccounts, setCashAccounts] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    account_name: '',
    bank_name: '',
    account_number: '',
    currency: 'GHS',
    gl_account_code: '',
    opening_balance: '0',
  })

  useEffect(() => {
    loadLookups()
  }, [])

  async function loadLookups() {
    setLoading(true)
    try {
      const [{ data: accountsData }, { data: cashData }] = await Promise.all([
        supabase.from('bank_accounts').select('id,account_name,bank_name,account_number,currency,gl_account_code,is_active,created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('chart_of_accounts').select('account_code,account_name').in('account_code', CASH_ACCOUNTS).order('account_code'),
      ])

      if (!accountsData) {
        throw new Error('Failed to load bank accounts.')
      }

      setAccounts(accountsData || [])
      setCashAccounts(cashData || [])

      const codes = accountsData?.map((item) => item.gl_account_code).filter(Boolean)
      if (codes?.length) {
        const { data: balanceRows } = await supabase
          .from('account_running_balance')
          .select('account_code,running_balance,entry_date')
          .in('account_code', [...new Set(codes)])
          .order('entry_date', { ascending: false })

        const grouped = {};
        (balanceRows || []).forEach((row) => {
          if (!grouped[row.account_code]) grouped[row.account_code] = row.running_balance
        })
        setBalances(grouped)
      } else {
        setBalances({})
      }
    } catch (err) {
      console.error('Bank account registry lookup failed', err)
      setError('Unable to load bank accounts or chart of accounts.')
    } finally {
      setLoading(false)
    }
  }

  const accountRows = useMemo(() => {
    return accounts.map((account) => ({
      ...account,
      current_gl_balance: account.gl_account_code ? balances[account.gl_account_code] ?? 0 : null,
    }))
  }, [accounts, balances])

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!user?.id) {
      setError('Unable to identify current user.')
      return
    }

    if (!form.account_name.trim() || !form.bank_name.trim() || !form.account_number.trim() || !form.gl_account_code) {
      setError('Please complete account name, bank name, account number, and GL account code.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        account_name: form.account_name.trim(),
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        currency: form.currency,
        gl_account_code: form.gl_account_code,
        opening_balance: Number(form.opening_balance) || 0,
        created_by: profile?.id || user.id,
      }
      const { error: insertError } = await supabase.from('bank_accounts').insert([payload])
      if (insertError) throw insertError

      setSuccess('Bank account registered successfully.')
      setForm({ account_name: '', bank_name: '', account_number: '', currency: 'GHS', gl_account_code: '', opening_balance: '0' })
      await loadLookups()
    } catch (err) {
      console.error('Create bank account failed', err)
      setError(err.message || 'Failed to register the bank account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Bank account registry</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Bank accounts</h2>
          </div>
          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200">
            {accounts.length} accounts
          </span>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-400">{success}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-border-soft bg-slate-950 pb-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-3 py-3 text-left">Account</th>
                      <th className="px-3 py-3 text-left">Bank</th>
                      <th className="px-3 py-3 text-left">Account #</th>
                      <th className="px-3 py-3 text-left">Currency</th>
                      <th className="px-3 py-3 text-left">GL Code</th>
                      <th className="px-3 py-3 text-right">GL Balance</th>
                      <th className="px-3 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !accounts.length ? (
                      <tr><td colSpan="7" className="p-4 text-center text-slate-400">Loading bank accounts…</td></tr>
                    ) : accountRows.length === 0 ? (
                      <tr><td colSpan="7" className="p-4 text-center text-slate-400">No bank accounts registered yet.</td></tr>
                    ) : (
                      accountRows.map((account) => (
                        <tr key={account.id} className="border-t border-border-soft">
                          <td className="px-3 py-3 text-slate-200">{account.account_name}</td>
                          <td className="px-3 py-3 text-slate-200">{account.bank_name}</td>
                          <td className="px-3 py-3 text-slate-200">{maskAccountNumber(account.account_number)}</td>
                          <td className="px-3 py-3 text-slate-200">{account.currency}</td>
                          <td className="px-3 py-3 text-slate-200">{account.gl_account_code || '—'}</td>
                          <td className="px-3 py-3 text-right text-slate-200">{account.current_gl_balance != null ? formatGhs(account.current_gl_balance) : '—'}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${account.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700/80 text-slate-300'}`}>
                              {account.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border-soft bg-slate-950 p-6">
            <h3 className="text-lg font-semibold text-white">Add Bank Account</h3>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-slate-400">Account name</span>
                <input
                  type="text"
                  value={form.account_name}
                  onChange={(e) => handleChange('account_name', e.target.value)}
                  className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-slate-400">Bank name</span>
                <input
                  type="text"
                  value={form.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-slate-400">Account number</span>
                <input
                  type="text"
                  value={form.account_number}
                  onChange={(e) => handleChange('account_number', e.target.value)}
                  className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block text-slate-400">Currency</span>
                  <select
                    value={form.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block text-slate-400">GL account code</span>
                  <select
                    value={form.gl_account_code}
                    onChange={(e) => handleChange('gl_account_code', e.target.value)}
                    className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select cash account</option>
                    {cashAccounts.map((account) => (
                      <option key={account.account_code} value={account.account_code}>
                        {account.account_code} — {account.account_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-slate-400">Opening balance</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={(e) => handleChange('opening_balance', e.target.value)}
                  className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                disabled={loading}
              >
                {loading ? 'Saving account…' : 'Add Bank Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
