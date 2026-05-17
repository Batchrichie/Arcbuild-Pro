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
    <div className="mt-8 space-y-6">
      <div className="flex gap-2 border-b border-white/10">
        <button onClick={()=>setTab('income')} className={`px-4 py-3 text-sm font-semibold transition ${tab==='income'?'border-b-2 border-amber-400 text-amber-300':'text-slate-400 hover:text-slate-300'}`}>Income Statement</button>
        <button onClick={()=>setTab('balance')} className={`px-4 py-3 text-sm font-semibold transition ${tab==='balance'?'border-b-2 border-blue-400 text-blue-300':'text-slate-400 hover:text-slate-300'}`}>Balance Sheet</button>
        <button onClick={()=>setTab('trial')} className={`px-4 py-3 text-sm font-semibold transition ${tab==='trial'?'border-b-2 border-teal-400 text-teal-300':'text-slate-400 hover:text-slate-300'}`}>Trial Balance</button>
        <button onClick={()=>setTab('cash')} className={`px-4 py-3 text-sm font-semibold transition ${tab==='cash'?'border-b-2 border-green-400 text-green-300':'text-slate-400 hover:text-slate-300'}`}>Cash Flow</button>
      </div>

      <div className="space-y-6">
        {(tab === 'income') && (
          <div className="space-y-6">
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <label className="block text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Start date</label>
                <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400/50 focus:bg-white/10 outline-none" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">End date</label>
                <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400/50 focus:bg-white/10 outline-none" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Division</label>
                <select value={division} onChange={e=>setDivision(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber-400/50 focus:bg-white/10 outline-none">
                  <option className="bg-slate-950 text-white">All</option>
                  {divisions.map(d => <option key={d.id} className="bg-slate-950 text-white">{d.name}</option>)}
                </select>
              </div>
              <div className="ml-auto">
                <button onClick={()=>window.print()} className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:border-amber-400/50 hover:bg-amber-500/20">Export to PDF</button>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Revenue</p>
                <div className="mt-4 space-y-3">
                  {Object.keys(incomeAgg).map(divName => (
                    <div key={divName} className="flex justify-between border-b border-white/10 pb-3">
                      <div className="text-sm text-slate-300">{divName}</div>
                      <div className="text-sm font-semibold text-amber-300">GHS {fmt(incomeAgg[divName].revenue)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-white/10 pt-4 flex justify-between">
                  <div className="font-semibold text-white">Total Revenue</div>
                  <div className="font-semibold text-amber-300">GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+v.revenue,0))}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Expenses</p>
                <div className="mt-4 flex justify-between border-b border-white/10 pb-4">
                  <div className="text-sm text-slate-300">Operating Expenses</div>
                  <div className="text-sm font-semibold text-red-300">GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+v.expense,0))}</div>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-300">Net Profit Before Tax</div>
                    <div className="font-semibold text-cyan-300">GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0))}</div>
                  </div>
                  <div className="flex justify-between text-sm border-t border-white/10 pt-4">
                    <div className="text-slate-300">Tax Provision (25%)</div>
                    <div className="font-semibold text-orange-300">GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.25)}</div>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-4">
                    <div className="font-semibold text-white">Net Profit After Tax</div>
                    <div className="font-bold text-green-300 text-lg">GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.75)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(tab === 'balance') && (
          <div className="space-y-6">
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">As at date</label>
                <input type="date" value={asAtDate} onChange={e=>setAsAtDate(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-400/50 focus:bg-white/10 outline-none" />
              </div>
              <div className="ml-auto">
                <button onClick={()=>window.print()} className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:border-blue-400/50 hover:bg-blue-500/20">Export to PDF</button>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Assets</p>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-300">Current Assets</div>
                    <div className="text-blue-300">GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('11')).reduce((s,r)=>s+r.balance,0))}</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-300">Non-Current Assets</div>
                    <div className="text-blue-300">GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('12')).reduce((s,r)=>s+r.balance,0))}</div>
                  </div>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4 flex justify-between">
                  <div className="font-semibold text-white">Total Assets</div>
                  <div className="font-semibold text-blue-300">GHS {fmt(bsRows.reduce((s,r)=>s+r.balance,0))}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Liabilities</p>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-300">Current Liabilities</div>
                    <div className="text-red-300">GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('21')).reduce((s,r)=>s+r.balance,0))}</div>
                  </div>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4 flex justify-between">
                  <div className="font-semibold text-white">Total Liabilities</div>
                  <div className="font-semibold text-red-300">GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('21') || r.account_code.startsWith('22')).reduce((s,r)=>s+r.balance,0))}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Equity</p>
                <div className="mt-4 border-t border-white/10 pt-4 flex justify-between">
                  <div className="font-semibold text-white">Total Equity</div>
                  <div className="font-semibold text-green-300">GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('3')).reduce((s,r)=>s+r.balance,0))}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex justify-between mb-4 pb-4 border-b border-white/10">
                <div className="font-semibold text-white">Total Liabilities + Equity</div>
                <div className="font-semibold text-teal-300">GHS {fmt(bsRows.filter(r=>r.account_code.startsWith('21') || r.account_code.startsWith('22')).reduce((s,r)=>s+r.balance,0) + bsRows.filter(r=>r.account_code.startsWith('3')).reduce((s,r)=>s+r.balance,0))}</div>
              </div>
              {Math.abs(bsRows.reduce((s,r)=>s+r.balance,0) - (bsRows.filter(r=>r.account_code.startsWith('21') || r.account_code.startsWith('22')).reduce((s,r)=>s+r.balance,0) + bsRows.filter(r=>r.account_code.startsWith('3')).reduce((s,r)=>s+r.balance,0))) > 0.5 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 font-semibold">⚠ Balance sheet does not balance — contact your accountant.</div>
              )}
            </div>
          </div>
        )}

        {(tab === 'trial') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">Date range: <span className="text-white font-semibold">{startDate} — {endDate}</span></div>
              <button onClick={exportCsvForTrial} className="rounded-lg border border-teal-400/30 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-300 transition hover:border-teal-400/50 hover:bg-teal-500/20">Export CSV</button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.16em] font-semibold text-slate-400">Account Code</th>
                      <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.16em] font-semibold text-slate-400">Account Name</th>
                      <th className="px-6 py-4 text-right text-xs uppercase tracking-[0.16em] font-semibold text-slate-400">Total Debits</th>
                      <th className="px-6 py-4 text-right text-xs uppercase tracking-[0.16em] font-semibold text-slate-400">Total Credits</th>
                      <th className="px-6 py-4 text-right text-xs uppercase tracking-[0.16em] font-semibold text-slate-400">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialAgg.map((r, idx) => (
                      <tr key={r.account_code} className={`border-b border-white/5 ${idx % 2 === 0 ? 'bg-white/2' : ''} hover:bg-white/5`}>
                        <td className="px-6 py-3 text-slate-300">{r.account_code}</td>
                        <td className="px-6 py-3 text-slate-300">{r.account_name}</td>
                        <td className="px-6 py-3 text-right text-teal-300">{fmt(r.total_debits)}</td>
                        <td className="px-6 py-3 text-right text-orange-300">{fmt(r.total_credits)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-slate-200">{fmt(r.total_debits - r.total_credits)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-white/10 bg-white/5 font-semibold">
                      <td colSpan="2" className="px-6 py-4 text-white">Totals</td>
                      <td className="px-6 py-4 text-right text-teal-300">{fmt(trialAgg.reduce((s,r)=>s+r.total_debits,0))}</td>
                      <td className="px-6 py-4 text-right text-orange-300">{fmt(trialAgg.reduce((s,r)=>s+r.total_credits,0))}</td>
                      <td className="px-6 py-4 text-right text-slate-200">{fmt(trialAgg.reduce((s,r)=>s+(r.total_debits - r.total_credits),0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {Math.abs(trialAgg.reduce((s,r)=>s+r.total_debits,0) - trialAgg.reduce((s,r)=>s+r.total_credits,0)) > 0.5 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 font-semibold">⚠ Trial balance is out of balance.</div>
            )}
          </div>
        )}

        {(tab === 'cash') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">Period: <span className="text-white font-semibold">{startDate} — {endDate}</span></div>
              <button onClick={()=>window.print()} className="rounded-lg border border-green-400/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300 transition hover:border-green-400/50 hover:bg-green-500/20">Export to PDF</button>
            </div>

            <div className="grid gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-4">Operating Activities</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-300">Net Profit After Tax</div>
                    <div className="text-green-300">GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.75)}</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-300">Add back: Depreciation</div>
                    <div className="text-green-300">GHS {fmt(cashFlow.depreciation)}</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-300">(Increase)/Decrease in Receivables</div>
                    <div className="text-green-300">GHS {fmt(-cashFlow.receivables)}</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-300">Increase/(Decrease) in Payables</div>
                    <div className="text-green-300">GHS {fmt(cashFlow.payables)}</div>
                  </div>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4 flex justify-between font-semibold">
                  <div className="text-white">Net Cash from Operations</div>
                  <div className="text-green-300">GHS {fmt(Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.75 + cashFlow.depreciation - cashFlow.receivables + cashFlow.payables)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-4">Investing Activities</p>
                <div className="flex justify-between text-sm mb-4">
                  <div className="text-slate-300">Purchase of Assets</div>
                  <div className="text-blue-300">GHS {fmt(-cashFlow.investing)}</div>
                </div>
                <div className="border-t border-white/10 pt-4 flex justify-between font-semibold">
                  <div className="text-white">Net Cash from Investing</div>
                  <div className="text-blue-300">GHS {fmt(-cashFlow.investing)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-4">Financing Activities</p>
                <div className="flex justify-between text-sm mb-4">
                  <div className="text-slate-300">Loan drawdowns / repayments</div>
                  <div className="text-amber-300">GHS {fmt(cashFlow.financing)}</div>
                </div>
                <div className="border-t border-white/10 pt-4 flex justify-between font-semibold">
                  <div className="text-white">Net Cash from Financing</div>
                  <div className="text-amber-300">GHS {fmt(cashFlow.financing)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-6">
                <div className="flex justify-between items-center">
                  <div className="text-white font-bold">Net Increase/(Decrease) in Cash</div>
                  <div className="text-3xl font-bold text-cyan-300">GHS {fmt((Object.values(incomeAgg).reduce((s,v)=>s+(v.revenue - v.expense),0) * 0.75 + cashFlow.depreciation - cashFlow.receivables + cashFlow.payables) + (-cashFlow.investing) + cashFlow.financing)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
