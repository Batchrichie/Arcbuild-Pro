import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getAccountsByCategory,
  getAccountCategories,
  createAccount,
  updateAccount,
} from '../../services/chartOfAccountsService'

const STATUS_BADGE = {
  Active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Inactive: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
}

const STATUS_TOGGLES = [
  { value: 'all', label: 'All Accounts' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
]

const CATEGORY_OPTIONS = getAccountCategories()

const SUB_ELEMENT_OPTIONS = {
  Asset: ['Current Asset', 'Non-Current Asset'],
  Liability: ['Current Liability', 'Non-Current Liability'],
  Equity: ['Contributed Capital', 'Retained Earnings', 'Other Comprehensive Income'],
  Revenue: ['Operating Revenue', 'Other Income'],
  Expense: ['Cost of Sales', 'Operating Expense', 'Finance Cost', 'Tax Expense', 'Other Expense'],
}

const ACCOUNT_TYPE_CODE_RANGES = {
  asset: { min: 1000, max: 1999 },
  liability: { min: 2000, max: 2999 },
  equity: { min: 3000, max: 3999 },
  revenue: { min: 4000, max: 4999 },
  expense: { min: 5000, max: 5999 },
}

const EMPTY_FORM = {
  account_code: '',
  account_name: '',
  account_type: '',
  description: '',
  parent_code: '',
  opening_balance: '0',
  status: 'Active',
  financial_statement: '',
  element: '',
  sub_element: '',
  nature: '',
  is_contra: false,
  is_payment_account: false,
  payment_method_type: '',
  is_system: false,
}

export default function ChartOfAccounts() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAccountant = profile?.role === 'accountant'
  const isCeo = profile?.role === 'ceo'

  const [accountsByCategory, setAccountsByCategory] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (profile && !isAccountant && !isCeo) {
      navigate('/unauthorized', { replace: true })
    }
  }, [profile, isAccountant, isCeo, navigate])

  useEffect(() => {
    loadAccounts()
  }, [search, categoryFilter, statusFilter])

  async function loadAccounts() {
    setLoading(true)
    setError(null)
    try {
      const grouped = await getAccountsByCategory()
      setAccountsByCategory(grouped)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getNextCodeForType(type) {
    const range = ACCOUNT_TYPE_CODE_RANGES[type]
    if (!range) return ''

    const maxCode = Object.values(accountsByCategory)
      .flat()
      .filter((account) => account.account_type === type)
      .map((account) => Number(account.account_code))
      .filter((code) => Number.isInteger(code) && code >= range.min && code <= range.max)
      .reduce((max, code) => Math.max(max, code), range.min - 1)

    const nextCode = Math.min(maxCode + 1, range.max)
    return String(nextCode)
  }

  function handleAccountTypeChange(account_type) {
    setForm((prev) => ({
      ...prev,
      account_type,
      account_code: editingAccount ? prev.account_code : getNextCodeForType(account_type),
    }))
  }

  const activeAccounts = useMemo(() => {
    return Object.values(accountsByCategory)
      .flat()
      .filter((account) => account.status === 'Active')
      .sort((a, b) => a.account_code.localeCompare(b.account_code, undefined, { numeric: true }))
  }, [accountsByCategory])

  const filteredGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const groups = {}

    Object.entries(accountsByCategory).forEach(([category, accounts]) => {
      if (categoryFilter && category !== categoryFilter) return
      const filtered = accounts
        .filter((account) => {
          if (statusFilter === 'active' && account.status !== 'Active') return false
          if (statusFilter === 'inactive' && account.status !== 'Inactive') return false
          if (!normalizedSearch) return true
          return (
            String(account.account_code).toLowerCase().includes(normalizedSearch) ||
            String(account.account_name).toLowerCase().includes(normalizedSearch)
          )
        })
        .sort((a, b) => a.account_code.localeCompare(b.account_code, undefined, { numeric: true }))

      if (filtered.length) {
        groups[category] = filtered
      }
    })

    return groups
  }, [accountsByCategory, categoryFilter, statusFilter, search])

  function openCreate() {
    setEditingAccount(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(account) {
    setEditingAccount(account)
    setForm({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      description: account.description ?? '',
      parent_code: account.parent_code ?? '',
      opening_balance: account.opening_balance != null ? String(account.opening_balance) : '0',
      status: account.status || 'Active',
      financial_statement: account.financial_statement ?? '',
      element: account.element ?? '',
      sub_element: account.sub_element ?? '',
      nature: account.nature ?? '',
      is_contra: account.is_contra ?? false,
      is_payment_account: account.is_payment_account ?? false,
      payment_method_type: account.payment_method_type ?? '',
      is_system: account.is_system ?? false,
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    setSuccessMessage('')

    if (!form.account_code?.trim()) {
      setFormError('Account code is required.')
      return
    }
    if (!form.account_name?.trim()) {
      setFormError('Account name is required.')
      return
    }
    if (!form.account_type?.trim()) {
      setFormError('Account type is required.')
      return
    }
    if (!form.financial_statement?.trim()) {
      setFormError('Financial Statement classification is required.')
      return
    }
    if (form.is_payment_account && !form.payment_method_type) {
      setFormError('Payment Method Type is required for payment accounts.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        account_name: form.account_name,
        account_type: form.account_type,
        description: form.description,
        parent_code: form.parent_code || null,
        opening_balance: Number(form.opening_balance) || 0,
        status: form.status,
        financial_statement: form.financial_statement || null,
        element: form.element || null,
        sub_element: form.sub_element || null,
        nature: form.nature || null,
        is_contra: form.is_contra,
        is_payment_account: form.is_payment_account,
        payment_method_type: form.is_payment_account ? form.payment_method_type || null : null,
      }

      if (editingAccount) {
        await updateAccount(editingAccount.account_code, payload, profile.id)
      } else {
        await createAccount({
          account_code: form.account_code,
          ...payload,
        }, profile.id)
      }

      setModalOpen(false)
      setSuccessMessage(editingAccount ? 'Account updated successfully.' : 'Account created successfully.')
      await loadAccounts()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-slate-400">Browse and manage the general ledger account structure.</p>
        </div>
        {isAccountant && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            + Add New Account
          </button>
        )}
      </div>

      {successMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{successMessage}</div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search code or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-60 rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
        >
          <option value="">All Account Types</option>
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {STATUS_TOGGLES.map((toggle) => (
            <button
              key={toggle.value}
              type="button"
              onClick={() => setStatusFilter(toggle.value)}
              className={
                statusFilter === toggle.value
                  ? 'rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100'
                  : 'rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-white/5'
              }
            >
              {toggle.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      <div className="space-y-8">
        {loading ? (
          <div className="rounded-2xl border border-border-soft bg-surface-overlay p-8 text-center text-slate-500">Loading accounts…</div>
        ) : Object.keys(filteredGroups).length === 0 ? (
          <div className="rounded-2xl border border-border-soft bg-surface-overlay p-8 text-center text-slate-500">No accounts found.</div>
        ) : (
          Object.entries(filteredGroups).map(([category, accounts]) => (
            <section key={category} className="rounded-2xl border border-border-soft bg-surface-overlay p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{category}</h2>
                  <p className="text-sm text-slate-400">{accounts.length} account{accounts.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-300">
                  <thead className="border-b border-border-soft text-xs uppercase tracking-widest text-slate-500">
                    <tr>
                              <th className="px-4 py-3 text-left">Code</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left hidden lg:table-cell">Sub-Element</th>
                      <th className="px-4 py-3 text-left hidden lg:table-cell">Nature</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.account_code} className="border-b border-border-soft hover:bg-white/5 transition">
                        <td className="px-4 py-3 font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span>{account.account_code}</span>
                            {account.is_system && (
                              <span title="System account — code is permanently locked" className="text-slate-400">🔒</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">{account.account_name}</td>
                        <td className="px-4 py-3">{account.account_type}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">{account.sub_element || '-'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">{account.nature || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[account.status] ?? ''}`}>
                            {account.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isAccountant ? (
                            <button
                              type="button"
                              onClick={() => openEdit(account)}
                              className="rounded-lg border border-border-soft bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition"
                            >
                              Edit
                            </button>
                          ) : (
                            <span className="text-slate-500">Read only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border-soft bg-slate-900 p-6 overflow-y-auto max-h-[90vh] space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {editingAccount ? 'Edit Account' : 'New Account'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {editingAccount
                    ? 'Update account details. Account code cannot be changed.'
                    : 'Create a new ledger account.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-border-soft bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{formError}</div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Account Code</span>
                <div className="relative">
                  <input
                    type="text"
                    value={form.account_code}
                    placeholder="Select account type to auto-fill code"
                    disabled
                    className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                  />
                  <span
                    title="Account codes are permanently locked once saved."
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    🔒
                  </span>
                </div>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Account Name</span>
                <input
                  type="text"
                  value={form.account_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, account_name: e.target.value }))}
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Account Type</span>
                <select
                  value={form.account_type}
                  onChange={(e) => handleAccountTypeChange(e.target.value)}
                  disabled={form.is_system}
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  <option value="">Select account type</option>
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full rounded-2xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>Parent Account</span>
                <select
                  value={form.parent_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, parent_code: e.target.value }))}
                  disabled={form.is_system}
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  <option value="">None</option>
                  {activeAccounts.map((account) => (
                    <option key={account.account_code} value={account.account_code}>
                      {account.account_code} — {account.account_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Opening Balance</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.opening_balance}
                  onChange={(e) => setForm((prev) => ({ ...prev, opening_balance: e.target.value }))}
                  disabled={form.is_system}
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                />
                <p className="text-xs text-slate-500">Opening balances are posted to the ledger and offset to Opening Balances Equity.</p>
              </label>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Financial Statement</span>
                <select
                  value={form.financial_statement}
                  onChange={(e) => setForm((prev) => ({ ...prev, financial_statement: e.target.value }))}
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  <option value="">Select financial statement</option>
                  <option value="Balance Sheet">Balance Sheet</option>
                  <option value="Income Statement">Income Statement</option>
                  <option value="Memo">Memo</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Element (IFRS)</span>
                <select
                  value={form.element}
                  onChange={(e) => setForm((prev) => ({ ...prev, element: e.target.value, sub_element: '' }))}
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                >
                  <option value="">Select element</option>
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Equity">Equity</option>
                  <option value="Revenue">Revenue</option>
                  <option value="Expense">Expense</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Sub-Element</span>
                <select
                  value={form.sub_element}
                  onChange={(e) => setForm((prev) => ({ ...prev, sub_element: e.target.value }))}
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                  disabled={!form.element}
                >
                  <option value="">Select sub-element</option>
                  {(SUB_ELEMENT_OPTIONS[form.element] || []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Nature</span>
                <input
                  type="text"
                  value={form.nature}
                  onChange={(e) => setForm((prev) => ({ ...prev, nature: e.target.value }))}
                  placeholder="e.g. Cash and Cash Equivalents, Trade Receivables"
                  className="w-full rounded-xl border border-border-soft bg-slate-800 px-3 py-2 text-white outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex items-start gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_contra}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_contra: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-800 text-emerald-400 focus:ring-emerald-400"
                />
                <span>
                  <span className="block font-medium">Contra Account</span>
                  <span className="text-xs text-slate-500">Tick if this account reduces a related account (e.g. Accumulated Depreciation reduces PPE)</span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_payment_account}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_payment_account: e.target.checked, payment_method_type: e.target.checked ? prev.payment_method_type : '' }))}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-800 text-emerald-400 focus:ring-emerald-400"
                />
                <span>
                  <span className="block font-medium">Payment Account</span>
                  <span className="text-xs text-slate-500">Tick if money can be received into this account (cash, bank, mobile money)</span>
                </span>
              </label>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="font-medium">Payment Method Type</div>
                {form.is_payment_account ? (
                  <div className="flex flex-wrap gap-3">
                    {['Cash', 'Bank', 'Mobile Money'].map((option) => (
                      <label key={option} className="inline-flex items-center gap-2 rounded-xl border border-border-soft bg-slate-800 px-3 py-2">
                        <input
                          type="radio"
                          name="payment_method_type"
                          value={option}
                          checked={form.payment_method_type === option}
                          onChange={(e) => setForm((prev) => ({ ...prev, payment_method_type: e.target.value }))}
                          className="h-4 w-4 text-emerald-400"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">Select Payment Account to choose method type.</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingAccount ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
