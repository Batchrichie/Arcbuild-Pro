import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'
import Modal from '../ui/Modal'

const EMPTY = {
  full_name: '', email: '', phone: '', employee_number: '', job_title: '', department: '',
  division_id: '', contract_type: 'permanent', hire_date: '', termination_date: '',
  basic_salary: '', monthly_allowances: '', tin: '', ssnit_number: '', bank_name: '',
  bank_account: '', is_ssnit_exempt: false, is_paye_exempt: false, send_invite: true,
}

const cls = 'w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white'

export default function EmployeeRegistry() {
  const [rows, setRows] = useState([])
  const [divs, setDivs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ department: '', division_id: '', contract_type: '', status: 'active' })
  const [wizard, setWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [edit, setEdit] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [e, d] = await Promise.all([
      supabase.from('employees').select('*, profiles:profile_id(id, full_name, phone, is_active), division:division_id(id, name)').order('employee_number'),
      supabase.from('divisions').select('id, name').order('name'),
    ])
    if (!e.error) setRows(e.data ?? [])
    if (!d.error) setDivs(d.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const departments = [...new Set(rows.map((r) => r.department).filter(Boolean))]
  const filtered = rows.filter((r) => {
    if (filters.department && r.department !== filters.department) return false
    if (filters.division_id && r.division_id !== filters.division_id) return false
    if (filters.contract_type && r.contract_type !== filters.contract_type) return false
    if (filters.status === 'active' && !r.is_active) return false
    if (filters.status === 'inactive' && r.is_active) return false
    return true
  })

  const openDetail = (row) => {
    setSelected(row)
    setEdit({
      full_name: row.profiles?.full_name ?? '', phone: row.profiles?.phone ?? '',
      job_title: row.job_title ?? '', department: row.department ?? '', division_id: row.division_id ?? '',
      contract_type: row.contract_type ?? 'permanent', hire_date: row.hire_date ?? '',
      termination_date: row.termination_date ?? '', basic_salary: row.basic_salary ?? '',
      monthly_allowances: row.monthly_allowances ?? '', tin: row.tin ?? '', ssnit_number: row.ssnit_number ?? '',
      bank_name: row.bank_name ?? '', bank_account: row.bank_account ?? '',
      is_ssnit_exempt: row.is_ssnit_exempt ?? false, is_paye_exempt: row.is_paye_exempt ?? false, is_active: row.is_active,
    })
  }

  const saveDetail = async () => {
    if (!selected || !edit) return
    setSaving(true)
    const pe = await supabase.from('profiles').update({ full_name: edit.full_name, phone: edit.phone || null }).eq('id', selected.profile_id)
    const ee = await supabase.from('employees').update({
      job_title: edit.job_title || null, department: edit.department || null, division_id: edit.division_id || null,
      contract_type: edit.contract_type, hire_date: edit.hire_date || null, termination_date: edit.termination_date || null,
      basic_salary: parseFloat(edit.basic_salary) || 0, monthly_allowances: parseFloat(edit.monthly_allowances) || 0,
      tin: edit.tin || null, ssnit_number: edit.ssnit_number || null, bank_name: edit.bank_name || null,
      bank_account: edit.bank_account || null, is_ssnit_exempt: edit.is_ssnit_exempt, is_paye_exempt: edit.is_paye_exempt, is_active: edit.is_active,
    }).eq('id', selected.id)
    setSaving(false)
    if (pe.error || ee.error) { setError(pe.error?.message || ee.error?.message); return }
    setSelected(null); load()
  }

  const finishWizard = async () => {
    setSaving(true); setError(null)
    try {
      const pw = crypto.randomUUID().slice(0, 12) + 'Aa1!'
      const { data: auth, error: se } = await supabase.auth.signUp({
        email: form.email.trim(), password: pw,
        options: { data: { full_name: form.full_name.trim(), role: 'employee' } },
      })
      if (se) throw se
      const uid = auth.user?.id
      if (!uid) throw new Error('Account not created — check email confirmation settings.')
      await new Promise((r) => setTimeout(r, 400))
      const { data: prof, error: pfe } = await supabase.from('profiles').select('id').eq('user_id', uid).single()
      if (pfe || !prof) throw new Error('Profile not found after signup')
      if (form.phone) await supabase.from('profiles').update({ phone: form.phone }).eq('id', prof.id)
      const { error: ie } = await supabase.from('employees').insert({
        profile_id: prof.id, employee_number: form.employee_number.trim(),
        job_title: form.job_title || null, department: form.department || null, division_id: form.division_id || null,
        contract_type: form.contract_type, hire_date: form.hire_date || null, termination_date: form.termination_date || null,
        basic_salary: parseFloat(form.basic_salary) || 0, monthly_allowances: parseFloat(form.monthly_allowances) || 0,
        tin: form.tin || null, ssnit_number: form.ssnit_number || null, bank_name: form.bank_name || null,
        bank_account: form.bank_account || null, is_ssnit_exempt: form.is_ssnit_exempt, is_paye_exempt: form.is_paye_exempt, is_active: true,
      })
      if (ie) throw ie
      if (form.send_invite) await supabase.auth.resetPasswordForEmail(form.email.trim())
      setWizard(false); setStep(0); setForm(EMPTY); load()
    } catch (err) { setError(err.message || 'Failed') } finally { setSaving(false) }
  }

  const stepBody = [
    (<div key="0" className="space-y-3">
      <input required className={cls} placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      <input required type="email" className={cls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input className={cls} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
    </div>),
    (<div key="1" className="space-y-3">
      <input required className={cls} placeholder="Employee number" value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} />
      <input className={cls} placeholder="Job title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
      <input className={cls} placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
      <select className={cls} value={form.division_id} onChange={(e) => setForm({ ...form, division_id: e.target.value })}>
        <option value="">Division</option>{divs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select className={cls} value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
        <option value="permanent">Permanent</option><option value="contract">Contract</option>
        <option value="casual">Casual</option><option value="intern">Intern</option>
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" className={cls} value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
        <input type="date" className={cls} value={form.termination_date} onChange={(e) => setForm({ ...form, termination_date: e.target.value })} />
      </div>
    </div>),
    (<div key="2" className="space-y-3">
      <input type="number" className={cls} placeholder="Basic salary" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} />
      <input type="number" className={cls} placeholder="Allowances" value={form.monthly_allowances} onChange={(e) => setForm({ ...form, monthly_allowances: e.target.value })} />
      <input className={cls} placeholder="TIN" value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} />
      <input className={cls} placeholder="SSNIT" value={form.ssnit_number} onChange={(e) => setForm({ ...form, ssnit_number: e.target.value })} />
      <input className={cls} placeholder="Bank" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
      <input className={cls} placeholder="Account" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} />
      <label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_ssnit_exempt} onChange={(e) => setForm({ ...form, is_ssnit_exempt: e.target.checked })} />SSNIT exempt</label>
      <label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_paye_exempt} onChange={(e) => setForm({ ...form, is_paye_exempt: e.target.checked })} />PAYE exempt</label>
    </div>),
    (<div key="3" className="space-y-2 text-sm text-slate-300">
      <p>Role: <strong className="text-white">employee</strong></p>
      <label className="flex gap-2"><input type="checkbox" checked={form.send_invite} onChange={(e) => setForm({ ...form, send_invite: e.target.checked })} />Send password reset invitation</label>
    </div>),
  ]

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select className={cls + ' w-auto'} value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
            <option value="">Department</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className={cls + ' w-auto'} value={filters.division_id} onChange={(e) => setFilters({ ...filters, division_id: e.target.value })}>
            <option value="">Division</option>{divs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select className={cls + ' w-auto'} value={filters.contract_type} onChange={(e) => setFilters({ ...filters, contract_type: e.target.value })}>
            <option value="">Contract</option>
            <option value="permanent">Permanent</option><option value="contract">Contract</option>
            <option value="casual">Casual</option><option value="intern">Intern</option>
          </select>
          <select className={cls + ' w-auto'} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
        <button type="button" onClick={() => { setWizard(true); setStep(0) }} className="rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white">Add Employee</button>
      </div>
      {loading ? <div className="h-40 animate-pulse rounded-2xl bg-white/5" /> : (
        <div className="portal-table-scroll overflow-x-auto rounded-2xl border border-border-soft">
          <table className="w-full min-w-[880px] text-sm">
            <thead><tr className="border-b border-border-soft text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-3">#</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Title</th>
              <th className="px-3 py-3">Dept</th><th className="px-3 py-3">Division</th><th className="px-3 py-3">Basic</th>
              <th className="px-3 py-3">Contract</th><th className="px-3 py-3">Hired</th><th className="px-3 py-3">Status</th>
            </tr></thead>
            <tbody>{filtered.map((r) => (
              <tr key={r.id} onClick={() => openDetail(r)} className="cursor-pointer border-b border-border-soft hover:bg-white/5">
                <td className="px-3 py-3 text-slate-400">{r.employee_number}</td>
                <td className="px-3 py-3 text-white">{r.profiles?.full_name}</td>
                <td className="px-3 py-3 text-slate-400">{r.job_title ?? '—'}</td>
                <td className="px-3 py-3 text-slate-400">{r.department ?? '—'}</td>
                <td className="px-3 py-3 text-slate-400">{r.division?.name ?? '—'}</td>
                <td className="px-3 py-3">{formatGhs(r.basic_salary)}</td>
                <td className="px-3 py-3 capitalize text-slate-400">{r.contract_type ?? '—'}</td>
                <td className="px-3 py-3 text-slate-400">{r.hire_date ?? '—'}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${r.is_active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-500/20 text-slate-300'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Modal open={wizard} onClose={() => setWizard(false)} title={`Add employee (${step + 1}/4)`} size="lg" footer={
        <div className="flex flex-wrap gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-full border border-border-soft px-4 py-2 text-sm text-slate-300"
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="rounded-full bg-violet-500 px-4 py-2 text-sm text-white"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={finishWizard}
              className="rounded-full bg-violet-500 px-4 py-2 text-sm text-white"
            >
              {saving ? '…' : 'Complete'}
            </button>
          )}
        </div>
      }>
        <div className="mt-4">{stepBody[step]}</div>
      </Modal>

      <Modal open={Boolean(selected && edit)} onClose={() => setSelected(null)} title={selected?.profiles?.full_name || 'Employee details'} size="lg" footer={
        <button
          type="button"
          disabled={saving}
          onClick={saveDetail}
          className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Save
        </button>
      }>
        <div className="space-y-3">
          <input className={cls} value={edit?.full_name || ''} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
          <input className={cls} value={edit?.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
          <input className={cls} value={edit?.job_title || ''} onChange={(e) => setEdit({ ...edit, job_title: e.target.value })} />
          <input className={cls} value={edit?.department || ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })} />
          <input type="number" className={cls} value={edit?.basic_salary || ''} onChange={(e) => setEdit({ ...edit, basic_salary: e.target.value })} />
          <label className="flex gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={edit?.is_active || false} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
            Active
          </label>
        </div>
      </Modal>
    </div>
  )
}
