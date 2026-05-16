import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function startOfYear(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function endOfYear(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10)
}

function fmt(amount) {
  if (amount == null) return ''
  const neg = Number(amount) < 0
  const abs = Math.abs(Number(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return neg ? `(${abs})` : abs
}

export default function FinancialStatements() {
  const today = new Date()
  const [tab, setTab] = useState('income')
  const [startDate, setStartDate] = useState(startOfYear(today))
  const [endDate, setEndDate] = useState(endOfYear(today))
  const [asAtDate, setAsAtDate] = useState(new Date().toISOString().slice(0,10))
  const [division, setDivision] = useState('All')

  const [glRows, setGlRows] = useState([])
  const [coaMap, setCoaMap] = useState({})
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchCoaAndDivisions(); }, [])

  async function fetchCoaAndDivisions(){
    const { data: coa } = await supabase.from('chart_of_accounts').select('account_code,account_name,account_type')
    const map = {}
    coa?.forEach(c => map[c.account_code] = c)
    setCoaMap(map)

    const { data: divs } = await supabase.from('divisions').select('id,name')
    setDivisions(divs || [])
  }

  async function fetchGL(rangeStart, rangeEnd, upto=false){
    setLoading(true)
    let query = supabase.from('general_ledger').select('*')
    if (upto) query = query.lte('entry_date', rangeEnd)
    else query = query.gte('entry_date', rangeStart).lte('entry_date', rangeEnd)
    const { data, error } = await query.order('entry_date', { ascending: true }).limit(20000)
    if (error) console.error('GL fetch', error)
    setGlRows(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchGL(startDate, endDate) }, [startDate, endDate])

  // Income statement aggregation
  const incomeAgg = useMemo(() => {
    const rows = glRows.filter(r => {
      const coa = coaMap[r.account_code]
      return coa && (coa.account_type === 'revenue' || coa.account_type === 'expense') && (division === 'All' || (r.division_id && divisions.find(d=>d.id===r.division_id)?.name === division))
    })
    const byDivision = {}
    rows.forEach(r => {
      const divName = divisions.find(d=>d.id===r.division_id)?.name || 'All'
      byDivision[divName] = byDivision[divName] || { revenue: 0, expense: 0 }
      const coa = coaMap[r.account_code]
      if (coa.account_type === 'revenue') byDivision[divName].revenue += Number(r.credit_amount || 0) - Number(r.debit_amount || 0)
      if (coa.account_type === 'expense') byDivision[divName].expense += Number(r.debit_amount || 0) - Number(r.credit_amount || 0)
    })
    return byDivision
  }, [glRows, coaMap, division, divisions])

  // Trial balance aggregation
  const trialAgg = useMemo(() => {
    const map = {}
    glRows.forEach(r => {
      const key = r.account_code
      map[key] = map[key] || { account_code: key, account_name: r.account_name, total_debits: 0, total_credits: 0 }
      map[key].total_debits += Number(r.debit_amount || 0)
      map[key].total_credits += Number(r.credit_amount || 0)
    })
    return Object.values(map).sort((a,b)=>a.account_code.localeCompare(b.account_code))
  }, [glRows])

  // Balance sheet as-of date: fetch upto asAtDate separately when tab changes
  const [bsRows, setBsRows] = useState([])
  useEffect(() => {
    if (tab !== 'balance') return
    fetchGL(null, asAtDate, true).then(()=>{
      // compute balance by account_type
      const byAcc = {}
      glRows.forEach(r => {
        byAcc[r.account_code] = byAcc[r.account_code] || { account_name: r.account_name, balance: 0 }
        byAcc[r.account_code].balance += Number(r.debit_amount || 0) - Number(r.credit_amount || 0)
      })
      const list = Object.keys(byAcc).map(k => ({ account_code: k, account_name: byAcc[k].account_name, balance: byAcc[k].balance, account_type: coaMap[k]?.account_type }))
      setBsRows(list.filter(x => ['asset','liability','equity'].includes(x.account_type)))
    })
  }, [tab, asAtDate, coaMap])

  // Cash flow simplified
  const cashFlow = useMemo(() => {
    // use glRows for the date range
    const netProfit = Object.values(incomeAgg).reduce((s,v)=>s + (v.revenue - v.expense), 0)
    const depreciation = glRows.filter(r=>r.account_code==='6401').reduce((s,r)=>s + (Number(r.debit_amount||0)-Number(r.credit_amount||0)),0)
    const receivables = glRows.filter(r=>r.account_code==='1110').reduce((s,r)=>s + (Number(r.debit_amount||0)-Number(r.credit_amount||0)),0)
    const payables = glRows.filter(r=>r.account_code==='2101').reduce((s,r)=>s + (Number(r.credit_amount||0)-Number(r.debit_amount||0)),0)
    const investing = glRows.filter(r=>r.account_code==='1210').reduce((s,r)=>s + (Number(r.debit_amount||0)-Number(r.credit_amount||0)),0)
    const financing = glRows.filter(r=>r.account_code==='2201').reduce((s,r)=>s + (Number(r.credit_amount||0)-Number(r.debit_amount||0)),0)
    return { netProfit, depreciation, receivables, payables, investing, financing }
  }, [glRows, incomeAgg])

  function exportCsvForTrial() {
    const cols = ['account_code','account_name','total_debits','total_credits']
    const csv = [cols.join(',')]
    for (const r of trialAgg) csv.push(cols.map(c=>r[c]).join(','))
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'trial_balance.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold">Financial Statements</h2>
      <div className="mt-4">
        <div className="flex gap-2">
          <button onClick={()=>setTab('income')} className={`px-3 py-1 ${tab==='income'?'bg-slate-200':'bg-white'}`}>Income Statement</button>
          <button onClick={()=>setTab('balance')} className={`px-3 py-1 ${tab==='balance'?'bg-slate-200':'bg-white'}`}>Balance Sheet</button>
          <button onClick={()=>setTab('trial')} className={`px-3 py-1 ${tab==='trial'?'bg-slate-200':'bg-white'}`}>Trial Balance</button>
          <button onClick={()=>setTab('cash')} className={`px-3 py-1 ${tab==='cash'?'bg-slate-200':'bg-white'}`}>Cash Flow</button>
        </div>

        <div className="mt-4 p-4 border rounded bg-white">
          {(tab === 'income') && (
            <div>
              <div className="flex gap-4 items-end">
                <div>
                  <label className="block text-sm">Start</label>
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border p-1" />
                </div>
                <div>
                  <label className="block text-sm">End</label>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="border p-1" />
                </div>
                <div>
                  <label className="block text-sm">Division</label>
                  <select value={division} onChange={e=>setDivision(e.target.value)} className="border p-1">
                    <option>All</option>
                    {divisions.map(d => <option key={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="ml-auto">
                  <button onClick={()=>window.print()} className="btn">Export to PDF</button>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold">REVENUE</h3>
                {Object.keys(incomeAgg).map(divName => (
                  <div key={divName} className="flex justify-between border-b py-2">
                    <div>{divName} Revenue</div>
                    <div className="text-right">GHS {fmt(incomeAgg[divName].revenue)}</div>
                  </div>
                ))}
                <div className="flex justify-between font-semibold mt-2"> <div>Total Revenue</div> <div>GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+v.revenue,0))}</div></div>

                <h3 className="font-semibold mt-4">OPERATING EXPENSES</h3>
                <div className="flex justify-between border-b py-2"><div>Total Operating Expenses</div><div>GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+v.expense,0))}</div></div>

                <div className="mt-4 font-semibold">NET PROFIT BEFORE TAX: GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0))}</div>
                <div>Tax Provision (25%): GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.25)}</div>
                <div className="font-bold mt-2">NET PROFIT AFTER TAX: GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.75)}</div>
              </div>
            </div>
          )}

          {(tab === 'balance') && (
            <div>
              <div className="flex gap-4 items-end">
                <div>
                  <label className="block text-sm">As at</label>
                  <input type="date" value={asAtDate} onChange={e=>setAsAtDate(e.target.value)} className="border p-1" />
                </div>
                <div className="ml-auto">
                  <button onClick={()=>window.print()} className="btn">Export to PDF</button>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold">ASSETS</h3>
                <div className="pl-4">
                  <div className="flex justify-between"><div>Current Assets</div><div>GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('11')).reduce((s,r)=>s+r.balance,0))}</div></div>
                  <div className="flex justify-between"><div>Non-Current Assets</div><div>GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('12')).reduce((s,r)=>s+r.balance,0))}</div></div>
                </div>
                <div className="font-semibold mt-2">TOTAL ASSETS: GHS {fmt(bsRows.reduce((s,r)=>s+r.balance,0))}</div>

                <h3 className="font-semibold mt-4">LIABILITIES</h3>
                <div className="pl-4">
                  <div className="flex justify-between"><div>Current Liabilities</div><div>GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('21')).reduce((s,r)=>s+r.balance,0))}</div></div>
                </div>
                <div className="font-semibold mt-2">TOTAL LIABILITIES: GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('21') || r.account_code.startsWith('22')).reduce((s,r)=>s+r.balance,0))}</div>

                <h3 className="font-semibold mt-4">EQUITY</h3>
                <div className="font-semibold">TOTAL EQUITY: GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('3')).reduce((s,r)=>s+r.balance,0))}</div>

                <div className="mt-4 font-bold">TOTAL LIABILITIES + EQUITY: GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('21') || r.account_code.startsWith('22')).reduce((s,r)=>s+r.balance,0) + bsRows.filter(r=>r.account_code.startsWith('3')).reduce((s,r)=>s+r.balance,0))}</div>

                <div className="mt-4">
                  {Math.abs(bsRows.reduce((s,r)=>s+r.balance,0) - (bsRows.filter(r=>r.account_code.startsWith('21') || r.account_code.startsWith('22')).reduce((s,r)=>s+r.balance,0) + bsRows.filter(r=>r.account_code.startsWith('3')).reduce((s,r)=>s+r.balance,0))) > 0.5 && (
                    <div className="text-red-600 font-semibold">Balance sheet does not balance — contact your accountant.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(tab === 'trial') && (
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">Date range: {startDate} — {endDate}</div>
                <div className="flex gap-2">
                  <button onClick={exportCsvForTrial} className="btn">Export CSV</button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-slate-600"><th>Account</th><th>Total Debits</th><th>Total Credits</th><th>Net Balance</th></tr></thead>
                  <tbody>
                    {trialAgg.map(r => (
                      <tr key={r.account_code} className="border-t"><td className="p-2">{r.account_code} — {r.account_name}</td><td className="p-2 text-right">{fmt(r.total_debits)}</td><td className="p-2 text-right">{fmt(r.total_credits)}</td><td className="p-2 text-right">{fmt(r.total_debits - r.total_credits)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 font-semibold flex justify-between"><div>Totals</div><div>{fmt(trialAgg.reduce((s,r)=>s+r.total_debits,0))} / {fmt(trialAgg.reduce((s,r)=>s+r.total_credits,0))}</div></div>
              {Math.abs(trialAgg.reduce((s,r)=>s+r.total_debits,0) - trialAgg.reduce((s,r)=>s+r.total_credits,0)) > 0.5 && (
                <div className="text-red-600 font-semibold mt-2">Trial balance is out of balance.</div>
              )}
            </div>
          )}

          {(tab === 'cash') && (
            <div>
              <div className="flex items-center gap-4">
                <div>Period: {startDate} — {endDate}</div>
                <div className="ml-auto"><button onClick={()=>window.print()} className="btn">Export to PDF</button></div>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold">OPERATING ACTIVITIES</h4>
                <div className="flex justify-between"><div>Net Profit After Tax</div><div className="text-right">GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.75)}</div></div>
                <div className="flex justify-between"><div>Add back: Depreciation (6401)</div><div className="text-right">GHS {fmt(cashFlow.depreciation)}</div></div>
                <div className="flex justify-between"><div>(Increase)/Decrease in Receivables (1110)</div><div className="text-right">GHS {fmt(-cashFlow.receivables)}</div></div>
                <div className="flex justify-between"><div>Increase/(Decrease) in Payables (2101)</div><div className="text-right">GHS {fmt(cashFlow.payables)}</div></div>
                <div className="font-semibold mt-2">Net Cash from Operations: GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.75 + cashFlow.depreciation - cashFlow.receivables + cashFlow.payables)}</div>

                <h4 className="font-semibold mt-4">INVESTING ACTIVITIES</h4>
                <div className="flex justify-between"><div>Purchase of Assets (1210)</div><div className="text-right">GHS {fmt(-cashFlow.investing)}</div></div>
                <div className="font-semibold mt-2">Net Cash from Investing: GHS {fmt(-cashFlow.investing)}</div>

                <h4 className="font-semibold mt-4">FINANCING ACTIVITIES</h4>
                <div className="flex justify-between"><div>Loan drawdowns / repayments (2201)</div><div className="text-right">GHS {fmt(cashFlow.financing)}</div></div>
                <div className="font-semibold mt-2">Net Cash from Financing: GHS {fmt(cashFlow.financing)}</div>

                <div className="mt-4 font-bold">NET INCREASE/(DECREASE) IN CASH: GHS {fmt((Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.75 + cashFlow.depreciation - cashFlow.receivables + cashFlow.payables) + (-cashFlow.investing) + cashFlow.financing)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
