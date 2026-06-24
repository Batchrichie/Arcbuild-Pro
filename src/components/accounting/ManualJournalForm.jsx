import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatGhs } from '../../lib/formatGhs'
import { inputCls as clsInput, amountInputCls } from '../../lib/portal-classes'
import ScrollableSelect from '../ui/ScrollableSelect'
import { parseDbError } from '../../lib/dbErrorMessage'

function AmountInput({ value, onChange, placeholder = '0.00', className = '' }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`${amountInputCls} ${className}`}
    />
  )
}

const createEmptyLine = () => ({
  id: `${Date.now()}-${Math.random()}`,
  account_code: '',
  account_name: '',
  debit_amount: '',
  credit_amount: '',
  line_description: '',
  project_id: '',
  division_id: '',
})

const TEMPLATES = [
  {
    label: 'Supplier Payment',
    lines: [
      { account_code: '2101', side: 'debit', description: 'Accounts Payable' },
      { account_code: '1101', side: 'credit', description: 'Cash' },
    ],
  },
  {
    label: 'Bank Receipt',
    lines: [
      { account_code: '1101', side: 'debit', description: 'Cash' },
      { account_code: '1110', side: 'credit', description: 'Accounts Receivable' },
    ],
  },
  {
    label: 'Salary Advance',
    lines: [
      { account_code: '1130', side: 'debit', description: 'Staff Advances' },
      { account_code: '1101', side: 'credit', description: 'Cash' },
    ],
  },
  {
    label: 'Loan Drawdown',
    lines: [
      { account_code: '1101', side: 'debit', description: 'Cash' },
      { account_code: '2201', side: 'credit', description: 'Long-term Loans' },
    ],
  },
  {
    label: 'Expense Accrual',
    lines: [
      { account_code: '6202', side: 'debit', description: 'Utilities expense' },
      { account_code: '1101', side: 'credit', description: 'Cash' },
    ],
  },
]

export default function ManualJournalForm({ initialDescription = '', initialReference = '', initialJournalDate = '', initialLines = [] }) {
  const { profile } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [projects, setProjects] = useState([])
  const [divisions, setDivisions] = useState([])
  const [journalDate, setJournalDate] = useState(initialJournalDate || new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState(initialDescription)
  const [reference, setReference] = useState(initialReference)
  const [lines, setLines] = useState(initialLines.length ? initialLines.map((line) => ({ ...createEmptyLine(), ...line })) : [createEmptyLine(), createEmptyLine()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState(null)

  useEffect(() => {
    const loadLookups = async () => {
      setLoading(true)
      try {
        const [{ data: coa }, { data: projectData }, { data: divisionData }] = await Promise.all([
          supabase.from('chart_of_accounts').select('account_code,account_name').eq('is_active', true).order('account_code'),
          supabase.from('projects').select('id,name,division_id,divisions(id,name)').eq('status', 'active').order('name'),
          supabase.from('divisions').select('id,name').order('name'),
        ])

        setAccounts(coa || [])
        setProjects(projectData || [])
        setDivisions(divisionData || [])
      } catch (err) {
        console.error('Failed to load journal form lookups', err)
        setError('Failed to load chart of accounts, projects, or divisions.')
      } finally {
        setLoading(false)
      }
    }

    loadLookups()
  }, [])

  useEffect(() => {
    if (initialLines.length) {
      setLines(initialLines.map((line) => ({ ...createEmptyLine(), ...line })))
    }
    if (initialDescription) setDescription(initialDescription)
    if (initialReference) setReference(initialReference)
    if (initialJournalDate) setJournalDate(initialJournalDate)
  }, [initialDescription, initialJournalDate, initialLines, initialReference])

  const getAccountName = (code) => accounts.find((a) => a.account_code === code)?.account_name || ''
  const getProjectDivisionId = (projectId) => projects.find((p) => p.id === projectId)?.divisions?.id || ''

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.account_code,
        label: `${account.account_code} — ${account.account_name}`,
      })),
    [accounts]
  )

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects]
  )

  const divisionOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...divisions.map((division) => ({ value: division.id, label: division.name })),
    ],
    [divisions]
  )

  const handleLineChange = (index, field, value) => {
    setLines((prev) => {
      const next = [...prev]
      const line = { ...next[index] }

      if (field === 'account_code') {
        const raw = String(value).trim()
        const code = raw.includes(' — ') ? raw.split(' — ')[0].trim() : raw
        line.account_code = code
        line.account_name = code ? getAccountName(code) : ''
      } else if (field === 'project_id') {
        line.project_id = value
        line.division_id = value ? getProjectDivisionId(value) : ''
      } else if (field === 'debit_amount') {
        line.debit_amount = value
        if (value && Number(value) > 0) {
          line.credit_amount = ''
        }
      } else if (field === 'credit_amount') {
        line.credit_amount = value
        if (value && Number(value) > 0) {
          line.debit_amount = ''
        }
      } else {
        line[field] = value
      }

      next[index] = line
      return next
    })
  }

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()])
  }

  const removeLine = (index) => {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== index)))
  }

  const fillTemplate = (template) => {
    const nextLines = template.lines.map((item) => ({
      ...createEmptyLine(),
      account_code: item.account_code,
      account_name: getAccountName(item.account_code),
      debit_amount: item.side === 'debit' ? '' : '',
      credit_amount: item.side === 'credit' ? '' : '',
      line_description: item.description,
    }))
    setLines(nextLines.length >= 2 ? nextLines : [createEmptyLine(), createEmptyLine()])
  }

  const totalDebits = useMemo(
    () => lines.reduce((sum, line) => sum + (parseFloat(line.debit_amount) || 0), 0),
    [lines]
  )

  const totalCredits = useMemo(
    () => lines.reduce((sum, line) => sum + (parseFloat(line.credit_amount) || 0), 0),
    [lines]
  )

  const balanceDifference = useMemo(() => totalDebits - totalCredits, [totalDebits, totalCredits])
  const balanced = Math.abs(balanceDifference) < 0.01 && totalDebits > 0

  const getActiveLines = () =>
    lines.filter((line) => {
      const debit = parseFloat(line.debit_amount) || 0
      const credit = parseFloat(line.credit_amount) || 0
      return line.account_code.trim() && (debit > 0 || credit > 0)
    })

  const validateLines = () => {
    if (!description.trim()) {
      setError('Description is required.')
      return false
    }

    for (const [index, line] of lines.entries()) {
      const hasAccount = Boolean(line.account_code.trim())
      const debit = parseFloat(line.debit_amount) || 0
      const credit = parseFloat(line.credit_amount) || 0
      const hasAmount = debit > 0 || credit > 0
      const isBlank = !hasAccount && !hasAmount

      if (isBlank) continue

      if (!hasAccount) {
        setError(`Line ${index + 1} must have an account when an amount is entered.`)
        return false
      }
      if (!hasAmount) {
        setError(`Line ${index + 1} must have either a debit or credit amount.`)
        return false
      }
      if (debit > 0 && credit > 0) {
        setError(`Line ${index + 1} cannot have both debit and credit amounts.`)
        return false
      }
      if (!getAccountName(line.account_code)) {
        setError(`Line ${index + 1} account code not found: ${line.account_code}`)
        return false
      }
    }

    const activeLines = getActiveLines()
    if (activeLines.length < 2) {
      setError('Enter at least two lines with accounts and amounts (one debit and one credit). Extra blank rows are ignored.')
      return false
    }

    const hasDebit = activeLines.some((line) => (parseFloat(line.debit_amount) || 0) > 0)
    const hasCredit = activeLines.some((line) => (parseFloat(line.credit_amount) || 0) > 0)
    if (!hasDebit || !hasCredit) {
      setError('Journal must include at least one debit line and one credit line.')
      return false
    }

    if (!balanced) {
      setError('Journal is not balanced. Please fix debit and credit totals.')
      return false
    }

    return true
  }

  const handlePost = async () => {
    setError('')
    setSuccess('')

    if (!validateLines()) {
      return
    }
    if (!profile?.id) {
      setError('Unable to identify your profile. Please sign in again.')
      return
    }

    setLoading(true)
    try {
      const rpcLines = getActiveLines().map((line) => ({
        account_code: line.account_code.trim(),
        debit_amount: parseFloat(line.debit_amount) || 0,
        credit_amount: parseFloat(line.credit_amount) || 0,
        line_description: line.line_description || description,
        project_id: line.project_id || null,
        division_id: line.division_id || null,
      }))

      const { data, error: rpcError } = await supabase.rpc('post_manual_journal', {
        description_param: description.trim(),
        entry_date_param: journalDate,
        reference_param: reference.trim() || null,
        lines_param: rpcLines,
        actor_uuid: profile.id,
      })

      if (rpcError) {
        throw new Error(parseDbError(rpcError))
      }

      if (!data?.success) {
        throw new Error(parseDbError(null, data))
      }

      setSuccess(`Journal posted: ${data.entry_number || data.journal_entry_id}`)
      setDraftSavedAt(null)
      setLines([createEmptyLine(), createEmptyLine()])
      setDescription('')
      setReference('')
      setJournalDate(new Date().toISOString().split('T')[0])
    } catch (err) {
      console.error('Journal post failed', err)
      setError(parseDbError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDraft = () => {
    setDraftSavedAt(new Date())
    setSuccess('Draft saved locally.')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-portal-muted">Manual Journal</p>
            <h2 className="mt-2 text-2xl font-semibold text-portal-primary">Post a manual ledger entry</h2>
          </div>
          <span className="badge-portal badge-portal-info">
            Manual Entry
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-portal-muted-strong">Journal Date</span>
            <input
              type="date"
              value={journalDate}
              onChange={(e) => setJournalDate(e.target.value)}
              className={clsInput}
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-portal-muted-strong">Description</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Payment to ABC Suppliers for cement"
              className={clsInput}
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-portal-muted-strong">Reference</span>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque #1234 or bank transfer ref"
              className={clsInput}
            />
          </label>
        </div>
      </div>

      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-portal-muted">Common journal templates</p>
            <p className="text-xs text-portal-muted">Tap a template to pre-fill the account lines.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => fillTemplate(template)}
                className="min-touch rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted transition hover:border-portal-info hover:bg-portal-info"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="portal-table-scroll mt-6 overflow-x-auto rounded-3xl border border-border-soft bg-portal-input">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.24em] text-portal-muted">
                <th className="min-w-[2rem] px-3 py-3">#</th>
                <th className="min-w-[12rem] px-3 py-3">Account Code</th>
                <th className="min-w-[10rem] px-3 py-3">Account Name</th>
                <th className="min-w-[10rem] px-3 py-3">Debit</th>
                <th className="min-w-[10rem] px-3 py-3">Credit</th>
                <th className="min-w-[10rem] px-3 py-3">Line Description</th>
                <th className="min-w-[10rem] px-3 py-3">Project</th>
                <th className="min-w-[10rem] px-3 py-3">Division</th>
                <th className="min-w-[5rem] px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} className="border-t border-border-soft">
                  <td className="px-3 py-3 text-portal-muted">{index + 1}</td>
                  <td className="px-3 py-3">
                    <ScrollableSelect
                      searchable
                      optionLayout="account"
                      showValueWhenClosed
                      value={line.account_code}
                      onChange={(code) => handleLineChange(index, 'account_code', code)}
                      options={accountOptions}
                      placeholder="Select account"
                      searchPlaceholder="Search code or name…"
                      className="min-w-[11rem]"
                    />
                  </td>
                  <td className="px-3 py-3 text-portal-primary">{line.account_name || '—'}</td>
                  <td className="px-3 py-3">
                    <AmountInput
                      value={line.debit_amount}
                      onChange={(e) => handleLineChange(index, 'debit_amount', e.target.value)}
                      className="!min-w-[9.5rem]"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <AmountInput
                      value={line.credit_amount}
                      onChange={(e) => handleLineChange(index, 'credit_amount', e.target.value)}
                      className="!min-w-[9.5rem]"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={line.line_description}
                      onChange={(e) => handleLineChange(index, 'line_description', e.target.value)}
                      placeholder="Optional note"
                      className={`${clsInput} min-w-[9rem]`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <ScrollableSelect
                      value={line.project_id}
                      onChange={(v) => handleLineChange(index, 'project_id', v)}
                      options={projectOptions}
                      placeholder="None"
                      className="min-w-[9rem]"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <ScrollableSelect
                      value={line.division_id}
                      onChange={(v) => handleLineChange(index, 'division_id', v)}
                      options={divisionOptions}
                      placeholder="None"
                      disabled={Boolean(line.project_id)}
                      className="min-w-[9rem]"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="min-touch rounded-full border border-border-soft bg-portal-overlay px-3 py-2 text-xs text-portal-muted transition hover:border-portal-danger hover:text-portal-danger"
                      disabled={lines.length <= 2}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-border-soft bg-portal-input p-4 text-sm text-portal-primary">
            <p className="font-semibold text-portal-primary">Balance</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-xs text-portal-muted">Total Debits</p>
                <p className="mt-1 text-lg font-semibold text-portal-primary">GHS {formatGhs(totalDebits)}</p>
              </div>
              <div>
                <p className="text-xs text-portal-muted">Total Credits</p>
                <p className="mt-1 text-lg font-semibold text-portal-primary">GHS {formatGhs(totalCredits)}</p>
              </div>
              <div>
                <p className="text-xs text-portal-muted">Difference</p>
                <p className={`mt-1 text-lg font-semibold ${balanced ? 'text-portal-success' : 'text-portal-danger'}`}>
                  GHS {formatGhs(Math.abs(balanceDifference))} {balanced ? '✓ Balanced' : `✗ Out of balance`}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-border-soft bg-portal-input p-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="min-touch rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted transition hover:border-portal-info hover:bg-portal-info"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={handlePost}
                disabled={!balanced || loading}
                className="min-touch rounded-full border border-border-soft bg-portal-action px-4 py-2 text-sm font-semibold text-portal-action-text transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Posting…' : 'Post Journal'}
              </button>
            </div>
            {draftSavedAt && (
              <p className="text-sm text-portal-muted">Draft saved at {draftSavedAt.toLocaleTimeString('en-GB')}</p>
            )}
            <p className="text-sm text-portal-muted">
              Minimum two lines (debit + credit). Use &quot;Add Line&quot; only when a third account is involved — blank extra rows are ignored.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={addLine}
            className="min-touch rounded-full border border-border-soft bg-portal-overlay px-4 py-2 text-sm text-portal-muted transition hover:border-portal-info hover:bg-portal-info"
          >
            Add Line (optional)
          </button>
        </div>
        {error && <p className="mt-4 rounded-2xl border border-portal-danger bg-portal-danger p-4 text-sm text-portal-danger">{error}</p>}
        {success && <p className="mt-4 rounded-2xl border border-portal-success bg-portal-success p-4 text-sm text-portal-success">{success} <span className="text-portal-muted">Use Journal History or General Ledger to review posted entries.</span></p>}
      </div>
    </div>
  )
}
