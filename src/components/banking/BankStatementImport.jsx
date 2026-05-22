import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatGhs } from '../../lib/formatGhs'

const MAPPING_FIELDS = [
  { key: 'transaction_date', label: 'Transaction Date' },
  { key: 'description', label: 'Description' },
  { key: 'reference', label: 'Reference' },
  { key: 'debit_amount', label: 'Debit Amount' },
  { key: 'credit_amount', label: 'Credit Amount' },
  { key: 'balance', label: 'Balance' },
]

function parseCsv(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (rows.length < 2) return { headers: [], rows: [] }

  const headers = rows[0].split(',').map((column) => column.trim())
  const dataRows = rows.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim())
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    return row
  })

  return { headers, rows: dataRows }
}

export default function BankStatementImport() {
  const { user } = useAuth()
  const [bankAccounts, setBankAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [previewRows, setPreviewRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadBankAccounts()
  }, [])

  async function loadBankAccounts() {
    const { data, error: err } = await supabase.from('bank_accounts').select('*').order('account_name')
    if (err) {
      console.error('Failed to load bank accounts', err)
      setError('Unable to load bank accounts.')
      return
    }
    setBankAccounts(data || [])
  }

  useEffect(() => {
    if (csvRows.length > 0 && Object.keys(mapping).length > 0) {
      setPreviewRows(csvRows.slice(0, 5).map(convertRow))
    } else {
      setPreviewRows([])
    }
  }, [csvRows, mapping])

  const convertedRows = useMemo(() => csvRows.map(convertRow).filter(Boolean), [csvRows, mapping])

  function convertRow(row) {
    if (!Object.values(mapping).every(Boolean)) return null
    const result = {}
    for (const field of MAPPING_FIELDS) {
      const source = mapping[field.key]
      result[field.key] = source ? row[source] : ''
    }
    return {
      transaction_date: result.transaction_date,
      description: result.description,
      reference: result.reference,
      debit_amount: Number(result.debit_amount || 0) || 0,
      credit_amount: Number(result.credit_amount || 0) || 0,
      balance: result.balance ? Number(result.balance) || null : null,
    }
  }

  const transactionCount = previewRows.length

  const handleFileChange = async (event) => {
    setError('')
    setSuccess('')
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file.')
      return
    }

    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    setCsvHeaders(headers)
    setCsvRows(rows)
    setMapping({})
    setPreviewRows([])
    setSummary(null)
  }

  const handleImport = async () => {
    setError('')
    setSuccess('')
    setSummary(null)

    if (!selectedAccountId) {
      setError('Please select a bank account.')
      return
    }

    if (csvRows.length === 0 || Object.keys(mapping).length < MAPPING_FIELDS.length) {
      setError('Please upload a CSV and complete the column mapping.')
      return
    }

    if (!user?.id) {
      setError('Unable to identify current user.')
      return
    }

    const account = bankAccounts.find((item) => item.id === selectedAccountId)
    if (!account) {
      setError('Selected bank account was not found.')
      return
    }

    setLoading(true)
    try {
      const { data: existing, error: existingError } = await supabase
        .from('bank_transactions')
        .select('transaction_date,debit_amount,credit_amount,description')
        .eq('bank_account_id', selectedAccountId)

      if (existingError) throw existingError

      const existingKeys = new Set(
        (existing || []).map((row) => `${row.transaction_date}|${row.debit_amount}|${row.credit_amount}|${String(row.description || '').trim().toLowerCase()}`)
      )

      const dedupedRows = convertedRows.filter((row) => {
        if (!row) return false
        const key = `${row.transaction_date}|${row.debit_amount}|${row.credit_amount}|${String(row.description || '').trim().toLowerCase()}`
        return !existingKeys.has(key)
      })

      const skippedCount = convertedRows.length - dedupedRows.length
      const insertionPayload = dedupedRows.map((row) => ({
        bank_account_id: selectedAccountId,
        transaction_date: row.transaction_date,
        value_date: row.transaction_date,
        description: row.description,
        reference: row.reference,
        debit_amount: row.debit_amount,
        credit_amount: row.credit_amount,
        balance: row.balance,
      }))

      const { error: insertError } = await supabase.from('bank_transactions').insert(insertionPayload)
      if (insertError) throw insertError

      let autoMatchResult = null
      try {
        const { data: autoData, error: autoError } = await supabase.rpc('auto_match_bank_transactions', {
          bank_account_id_param: selectedAccountId,
          tolerance_ghs: 0.5,
        })
        if (autoError) throw autoError
        autoMatchResult = autoData
      } catch (autoErr) {
        console.warn('Auto-match RPC failed', autoErr)
      }

      setSummary({ imported: dedupedRows.length, skipped: skippedCount, autoMatchResult })
      setSuccess(`Imported ${dedupedRows.length} rows${skippedCount ? `, skipped ${skippedCount} duplicates` : ''}.`)
      setCsvRows([])
      setCsvHeaders([])
      setMapping({})
      setPreviewRows([])
    } catch (err) {
      console.error('Bank statement import failed', err)
      setError(err.message || 'Failed to import bank statement.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-4xl panel-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Bank statement import</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Import bank statements</h2>
          </div>
          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200">
            {bankAccounts.length} accounts available
          </span>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-400">{success}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_0.7fr]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
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
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-slate-400">CSV file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            {csvHeaders.length > 0 && (
              <div className="rounded-3xl border border-border-soft bg-slate-950 p-4">
                <p className="text-sm font-semibold text-white mb-3">Column mapping</p>
                <div className="grid gap-4">
                  {MAPPING_FIELDS.map((field) => (
                    <label key={field.key} className="block text-sm text-slate-300">
                      <span className="mb-2 block text-slate-400">{field.label}</span>
                      <select
                        value={mapping[field.key] || ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full rounded-lg border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        <option value="">Map column</option>
                        {csvHeaders.map((column) => (
                          <option key={column} value={column}>{column}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {previewRows.length > 0 && (
              <div className="rounded-3xl border border-border-soft bg-slate-950 p-4">
                <p className="text-sm font-semibold text-white mb-3">Preview</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-slate-200">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Debit</th>
                        <th className="px-3 py-2 text-right">Credit</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr key={index} className="border-t border-border-soft">
                          <td className="px-3 py-2">{row.transaction_date}</td>
                          <td className="px-3 py-2">{row.description}</td>
                          <td className="px-3 py-2 text-right">{row.debit_amount ? formatGhs(row.debit_amount) : '—'}</td>
                          <td className="px-3 py-2 text-right">{row.credit_amount ? formatGhs(row.credit_amount) : '—'}</td>
                          <td className="px-3 py-2 text-right">{row.balance != null ? formatGhs(row.balance) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border-soft bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Import summary</p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>{csvRows.length ? `${csvRows.length} rows loaded` : 'Upload a bank statement CSV to begin.'}</p>
              <p>{transactionCount ? `${transactionCount} rows mapped for preview` : 'Map column names to the required fields.'}</p>
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || !selectedAccountId || csvRows.length === 0}
              className="mt-6 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Importing…' : 'Import statement'}
            </button>
            {summary && (
              <div className="mt-4 rounded-2xl border border-border-soft bg-slate-900 p-4 text-sm text-slate-200">
                <p>Imported: {summary.imported}</p>
                <p>Duplicates skipped: {summary.skipped}</p>
                {summary.autoMatchResult && (
                  <p>Auto-matched: {summary.autoMatchResult.matched_count ?? 0}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
