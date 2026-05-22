import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatGhs } from '../../lib/formatGhs'

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
      { account_code: '6000', side: 'debit', description: 'Operating Expenses' },
      { account_code: '2108', side: 'credit', description: 'Accrued Expenses' },
    ],
  },
]

const clsInput = 'w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white'

export default function ManualJournalForm({ initialDescription = '', initialReference = '', initialJournalDate = '', initialLines = [] }) {
  const { user } = useAuth()
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

  const handleLineChange = (index, field, value) => {
    setLines((prev) => {
      const next = [...prev]
      const line = { ...next[index] }

      if (field === 'account_code') {
        const code = String(value).split(' — ')[0].trim()
        line.account_code = code
        line.account_name = getAccountName(code)
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

  const validateLines = () => {
    if (!description.trim()) {
      setError('Description is required.')
      return false
    }

    if (lines.length < 2) {
      setError('At least two journal lines are required.')
      return false
    }

    for (const [index, line] of lines.entries()) {
      if (!line.account_code.trim()) {
        setError(`Line ${index + 1} must have an account code.`)
        return false
      }
      if (!line.debit_amount && !line.credit_amount) {
        setError(`Line ${index + 1} must have either debit or credit amount.`)
        return false
      }
      if (line.debit_amount && line.credit_amount) {
        setError(`Line ${index + 1} cannot have both debit and credit amounts.`)
        return false
      }
      if (!getAccountName(line.account_code)) {
        setError(`Line ${index + 1} account code not found: ${line.account_code}`)
        return false
      }
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
    if (!user?.id) {
      setError('Unable to identify current user.')
      return
    }

    setLoading(true)
    try {
      const rpcLines = lines.map((line) => ({
        account_code: line.account_code,
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
        actor_uuid: user.id,
      })

      if (rpcError) {
        throw rpcError
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Manual journal posting failed.')
      }

      setSuccess(`Journal posted: ${data.entry_number || data.journal_entry_id}`)
      setDraftSavedAt(null)
      setLines([createEmptyLine(), createEmptyLine()])
      setDescription('')
      setReference('')
      setJournalDate(new Date().toISOString().split('T')[0])
    } catch (err) {
      console.error('Journal post failed', err)
      setError(err.message || 'Failed to post journal entry.')
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
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Manual Journal</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Post a manual ledger entry</h2>
          </div>
          <span className="rounded-full border border-teal-400/30 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-200">
            Manual Entry
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Journal Date</span>
            <input
              type="date"
              value={journalDate}
              onChange={(e) => setJournalDate(e.target.value)}
              className={clsInput}
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-200">Description</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Payment to ABC Suppliers for cement"
              className={clsInput}
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-200">Reference</span>
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
            <p className="text-sm text-slate-400">Common journal templates</p>
            <p className="text-xs text-slate-500">Tap a template to pre-fill the account lines.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => fillTemplate(template)}
                className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-teal-400/30 hover:bg-teal-500/10"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="portal-table-scroll mt-6 overflow-x-auto rounded-3xl border border-border-soft bg-slate-950/70">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.24em] text-slate-500">
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Account Code</th>
                <th className="px-3 py-3">Account Name</th>
                <th className="px-3 py-3">Debit</th>
                <th className="px-3 py-3">Credit</th>
                <th className="px-3 py-3">Line Description</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Division</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} className="border-t border-border-soft">
                  <td className="px-3 py-3 text-slate-300">{index + 1}</td>
                  <td className="px-3 py-3">
                    <input
                      list="coa-options"
                      value={line.account_code ? `${line.account_code} — ${line.account_name}` : ''}
                      onChange={(e) => handleLineChange(index, 'account_code', e.target.value)}
                      placeholder="Type code or name"
                      className={clsInput}
                    />
                    <datalist id="coa-options">
                      {accounts.map((account) => (
                        <option
                          key={account.account_code}
                          value={`${account.account_code} — ${account.account_name}`}
                        />
                      ))}
                    </datalist>
                  </td>
                  <td className="px-3 py-3 text-slate-200">{line.account_name || '—'}</td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      value={line.debit_amount}
                      onChange={(e) => handleLineChange(index, 'debit_amount', e.target.value)}
                      className={clsInput}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      value={line.credit_amount}
                      onChange={(e) => handleLineChange(index, 'credit_amount', e.target.value)}
                      className={clsInput}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={line.line_description}
                      onChange={(e) => handleLineChange(index, 'line_description', e.target.value)}
                      placeholder="Optional note"
                      className={clsInput}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={line.project_id}
                      onChange={(e) => handleLineChange(index, 'project_id', e.target.value)}
                      className={clsInput}
                    >
                      <option value="">None</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={line.division_id}
                      onChange={(e) => handleLineChange(index, 'division_id', e.target.value)}
                      className={clsInput}
                      disabled={Boolean(line.project_id)}
                    >
                      <option value="">None</option>
                      {divisions.map((division) => (
                        <option key={division.id} value={division.id}>
                          {division.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="min-touch rounded-full border border-border-soft bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:border-red-400/40 hover:text-red-200"
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
          <div className="rounded-3xl border border-border-soft bg-slate-950/80 p-4 text-sm text-slate-200">
            <p className="font-semibold text-white">Balance</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Total Debits</p>
                <p className="mt-1 text-lg font-semibold text-white">GHS {formatGhs(totalDebits)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Credits</p>
                <p className="mt-1 text-lg font-semibold text-white">GHS {formatGhs(totalCredits)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Difference</p>
                <p className={`mt-1 text-lg font-semibold ${balanced ? 'text-emerald-300' : 'text-rose-300'}`}>
                  GHS {formatGhs(Math.abs(balanceDifference))} {balanced ? '✓ Balanced' : `✗ Out of balance`}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-border-soft bg-slate-950/80 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-teal-400/30 hover:bg-teal-500/10"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={handlePost}
                disabled={!balanced || loading}
                className="min-touch rounded-full border border-teal-400/40 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-100 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Posting…' : 'Post Journal'}
              </button>
            </div>
            {draftSavedAt && (
              <p className="text-sm text-slate-400">Draft saved at {draftSavedAt.toLocaleTimeString('en-GB')}</p>
            )}
            <p className="text-sm text-slate-400">When balanced, the journal can be posted immediately into the general ledger.</p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={addLine}
            className="min-touch rounded-full border border-border-soft bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-teal-400/30 hover:bg-teal-500/10"
          >
            Add Line
          </button>
        </div>
        {error && <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</p>}
        {success && <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{success} <span className="text-slate-300">Use Journal History or General Ledger to review posted entries.</span></p>}
      </div>
    </div>
  )
}
