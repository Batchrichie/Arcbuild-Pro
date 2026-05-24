import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatGhs } from '../../lib/formatGhs'
import { budgetVarianceStatus } from '../../lib/status-classes'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import DebtorsLedger from '../accounting/DebtorsLedger'
import TimesheetReport from './TimesheetReport'

const TABS = [
  'Revenue by Division',
  'Project Profitability',
  'Aged Receivables',
  'Aged Payables',
  'Employee Cost',
  'Budget vs Actual',
  'Timesheet Summary',
]

function downloadCsv(filename, rows) {
  const csv = [Object.keys(rows[0] || {}).join(','), ...rows.map(r => Object.values(r).map(v => `"${String(v ?? '')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ManagementReports() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  // Revenue by division
  const [year, setYear] = useState(new Date().getFullYear())
  const [incomeRows, setIncomeRows] = useState([])

  // Project profitability
  const [projects, setProjects] = useState([])

  // Payables
  const [payables, setPayables] = useState([])

  // Employee costs
  const [employeeCosts, setEmployeeCosts] = useState([])

  // Budget vs actual
  const [budgetRows, setBudgetRows] = useState([])

  async function loadIncome() {
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const { data, error } = await supabase
      .from('income_statement')
      .select('division_name,amount,period_month')
      .gte('period_month', start)
      .lte('period_month', end)
    if (error) return console.warn(error)
    setIncomeRows(data || [])
  }

  async function loadProjects() {
    const { data, error } = await supabase.from('project_finance_summary').select('*')
    if (error) return console.warn(error)
    setProjects(data || [])
  }

  async function loadPayables() {
    const { data, error } = await supabase
      .from('general_ledger')
      .select('journal_date,line_description,amount,reference')
      .eq('account_code', '2101')
    if (error) return console.warn(error)
    setPayables(data || [])
  }

  async function loadEmployeeCosts() {
    const { data, error } = await supabase
      .from('payroll_lines')
      .select('employee_id,gross_pay,paye,ssnit_employee,ssnit_employer,allowances')
      .limit(1000)
    if (error) return console.warn(error)
    // join employee names
    const employeeIds = [...new Set((data || []).map(r => r.employee_id))].filter(Boolean)
    const { data: emps } = await supabase.from('employees').select('id,full_name,department,division').in('id', employeeIds)
    const empMap = (emps || []).reduce((m,e)=>{m[e.id]=e;return m},{})
    const rows = (data || []).map(r=>({
      employee: empMap[r.employee_id]?.full_name || r.employee_id,
      department: empMap[r.employee_id]?.department || '',
      division: empMap[r.employee_id]?.division || '',
      basic: r.gross_pay || 0,
      allowances: r.allowances || 0,
      gross: r.gross_pay || 0,
      paye: r.paye || 0,
      ssnit_employee: r.ssnit_employee || 0,
      ssnit_employer: r.ssnit_employer || 0,
      net: (r.gross_pay || 0) - (r.paye || 0) - (r.ssnit_employee || 0),
    }))
    setEmployeeCosts(rows)
  }

  async function loadBudget() {
    const { data, error } = await supabase
      .from('project_budgets')
      .select('cost_category,total_budget')
    if (error) return console.warn(error)
    // aggregate actuals
    const { data: actuals } = await supabase.from('project_costs').select('cost_category,amount')
    const actualMap = {};
    (actuals||[]).forEach(a=>{ actualMap[a.cost_category] = (actualMap[a.cost_category]||0)+Number(a.amount||0) })
    const rows = (data||[]).map(b=>({
      cost_category: b.cost_category,
      total_budget: b.total_budget || 0,
      total_actual: actualMap[b.cost_category]||0,
      variance: (b.total_budget||0) - (actualMap[b.cost_category]||0),
      variance_pct: ((b.total_budget||0)===0?0:(((b.total_budget||0)-(actualMap[b.cost_category]||0))/(b.total_budget||1))*100),
    }))
    setBudgetRows(rows)
  }

  useEffect(() => {
    if (activeTab === 'Revenue by Division') {
      loadIncome()
    }
  }, [activeTab, year])

  useEffect(() => {
    if (activeTab === 'Project Profitability') loadProjects()
    if (activeTab === 'Aged Payables') loadPayables()
    if (activeTab === 'Employee Cost') loadEmployeeCosts()
    if (activeTab === 'Budget vs Actual') loadBudget()
  }, [activeTab])

  const revenueChartData = useMemo(() => {
    // pivot by month and division
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12']
    const divisions = ['Construction','Architecture','Real Estate','Logistics']
    const map = {}
    ;(incomeRows||[]).forEach(r=>{
      const m = r.period_month ? r.period_month.slice(5,7) : ''
      const key = m
      if (!map[key]) map[key] = { month: key }
      map[key][r.division_name] = (map[key][r.division_name]||0) + Number(r.amount||0)
    })
    return months.map(m=>({ month: m, ...divisions.reduce((acc,d)=>{acc[d]=map[m]?.[d]||0;return acc},{}) }))
  }, [incomeRows])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Management Reports</h2>
        <div className="flex items-center gap-2">
          {activeTab === 'Revenue by Division' && (
            <select value={year} onChange={(e)=>setYear(Number(e.target.value))} className="rounded px-2 py-1 bg-slate-900 text-white">
              {Array.from({length:5}).map((_,i)=>{
                const y = new Date().getFullYear()-i; return <option key={y} value={y}>{y}</option>
              })}
            </select>
          )}
        </div>
      </div>

      <div className="tabs flex gap-2">
        {TABS.map(t=> (
          <button key={t} onClick={()=>setActiveTab(t)} className={`px-4 py-2 rounded ${activeTab===t?'bg-amber-500/15 text-amber-100':'text-slate-400'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'Revenue by Division' && (
          <div>
            <div style={{height:300}} className="bg-slate-950 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v)=>formatGhs(v)} />
                  <Legend />
                  <Bar dataKey="Construction" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Architecture" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="Real Estate" stackId="a" fill="#10b981" />
                  <Bar dataKey="Logistics" stackId="a" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4">
              <table className="w-full text-sm text-slate-200">
                <thead className="text-slate-400">
                  <tr><th>Division</th>{Array.from({length:12}).map((_,i)=><th key={i} className="text-right">{new Date(0, i).toLocaleString('en-GH',{month:'short'})}</th>)}<th className="text-right">YTD</th></tr>
                </thead>
                <tbody>
                  {['Construction','Architecture','Real Estate','Logistics'].map(div=>{
                    const monthly = revenueChartData.map(d=>d[div]||0)
                    const ytd = monthly.reduce((s,n)=>s+Number(n||0),0)
                    return (<tr key={div}><td>{div}</td>{monthly.map((m,idx)=><td key={idx} className="text-right">{formatGhs(m)}</td>)}<td className="text-right font-semibold">{formatGhs(ytd)}</td></tr>)
                  })}
                  <tr className="border-t text-slate-200"><td className="font-semibold">Totals</td>{Array.from({length:12}).map((_,i)=>{
                    return <td key={i} className="text-right">{formatGhs(0)}</td>
                  })}<td className="text-right font-semibold">{formatGhs(incomeRows.reduce((s,r)=>s+Number(r.amount||0),0))}</td></tr>
                </tbody>
              </table>
              <div className="mt-3"><button onClick={()=>downloadCsv(`revenue_${year}.csv`, incomeRows)} className="rounded bg-emerald-500 px-3 py-2">Export CSV</button></div>
            </div>
          </div>
        )}

        {activeTab === 'Project Profitability' && (
          <div>
            <div className="rounded-2xl bg-slate-950 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-200">
                  <thead className="text-slate-400"><tr><th>Rank</th><th>Project</th><th>Division</th><th className="text-right">Contract</th><th className="text-right">Invoiced</th><th className="text-right">Costs</th><th className="text-right">Gross Profit</th><th className="text-right">Margin %</th><th>Status</th></tr></thead>
                  <tbody>
                    {(projects||[]).sort((a,b)=>Number(b.gross_profit_ghs||0)-Number(a.gross_profit_ghs||0)).map((p,idx)=>{
                      const margin = p.contract_value_ghs?((p.gross_profit_ghs||0)/p.contract_value_ghs)*100:0
                      const color = margin>20? 'text-emerald-300': margin>=10? 'text-amber-300':'text-rose-300'
                      return (<tr key={p.id}><td>{idx+1}</td><td>{p.project_name}</td><td>{p.division_name}</td><td className="text-right">{formatGhs(p.contract_value_ghs)}</td><td className="text-right">{formatGhs(p.total_invoiced_ghs)}</td><td className="text-right">{formatGhs(p.total_costs_ghs)}</td><td className="text-right">{formatGhs(p.gross_profit_ghs)}</td><td className={`text-right ${color}`}>{Number(margin).toFixed(1)}%</td><td>{p.status}</td></tr>)
                    })}
                  </tbody>
                </table>
                <div className="mt-3"><button onClick={()=>downloadCsv('project_profitability.csv', projects||[])} className="rounded bg-emerald-500 px-3 py-2">Export CSV</button></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Aged Receivables' && (
          <div>
            <div className="rounded-2xl bg-slate-950 p-4">
              <div className="mb-3">As-at: <input type="date" className="rounded bg-slate-900 px-2 py-1 text-white" /></div>
              <DebtorsLedger readOnly={true} />
              <div className="mt-3"><button className="rounded bg-emerald-500 px-3 py-2">Export PDF</button></div>
            </div>
          </div>
        )}

        {activeTab === 'Aged Payables' && (
          <div>
            <div className="rounded-2xl bg-slate-950 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-200">
                  <thead className="text-slate-400"><tr><th>Supplier</th><th>Journal Date</th><th>Description</th><th className="text-right">Amount</th><th>Reference</th></tr></thead>
                  <tbody>
                    {(payables||[]).map((r,idx)=> (<tr key={idx}><td>{r.line_description}</td><td>{r.journal_date}</td><td>{r.description}</td><td className="text-right">{formatGhs(r.amount)}</td><td>{r.reference}</td></tr>))}
                  </tbody>
                </table>
                <div className="mt-3"><button onClick={()=>downloadCsv('aged_payables.csv', payables||[])} className="rounded bg-emerald-500 px-3 py-2">Export CSV</button></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Employee Cost' && (
          <div>
            <div className="rounded-2xl bg-slate-950 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-200"><thead className="text-slate-400"><tr><th>Employee</th><th>Department</th><th>Division</th><th className="text-right">Basic</th><th className="text-right">Allowances</th><th className="text-right">Gross</th><th className="text-right">PAYE</th><th className="text-right">SSNIT(E)</th><th className="text-right">SSNIT(ER)</th><th className="text-right">Net</th></tr></thead><tbody>{(employeeCosts||[]).map((e,idx)=>(<tr key={idx}><td>{e.employee}</td><td>{e.department}</td><td>{e.division}</td><td className="text-right">{formatGhs(e.basic)}</td><td className="text-right">{formatGhs(e.allowances)}</td><td className="text-right">{formatGhs(e.gross)}</td><td className="text-right">{formatGhs(e.paye)}</td><td className="text-right">{formatGhs(e.ssnit_employee)}</td><td className="text-right">{formatGhs(e.ssnit_employer)}</td><td className="text-right">{formatGhs(e.net)}</td></tr>))}</tbody></table>
                <div className="mt-3"><button onClick={()=>downloadCsv('employee_costs.csv', employeeCosts||[])} className="rounded bg-emerald-500 px-3 py-2">Export CSV</button></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Budget vs Actual' && (
          <div>
            <div className="rounded-2xl bg-slate-950 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-text-primary"><thead className="text-text-muted"><tr><th className="py-2 text-left">Cost Category</th><th className="py-2 text-right">Total Budget</th><th className="py-2 text-right">Total Actual</th><th className="py-2 text-right">Variance</th><th className="py-2 text-right">Variance %</th><th className="py-2 text-left">Status</th></tr></thead><tbody>{(budgetRows||[]).map((b,idx)=>{const { label, className } = budgetVarianceStatus(b.variance_pct); return (<tr key={idx} className="border-t border-border-soft"><td className="py-2">{b.cost_category}</td><td className="py-2 text-right">{formatGhs(b.total_budget)}</td><td className="py-2 text-right">{formatGhs(b.total_actual)}</td><td className="py-2 text-right">{formatGhs(b.variance)}</td><td className="py-2 text-right">{b.variance_pct.toFixed(1)}%</td><td className="py-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span></td></tr>)})}</tbody></table>
                <div className="mt-3"><button onClick={()=>downloadCsv('budget_vs_actual.csv', budgetRows||[])} className="rounded bg-emerald-500 px-3 py-2">Export CSV</button></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Timesheet Summary' && (
          <div>
            <TimesheetReport />
          </div>
        )}
      </div>
    </div>
  )
}
