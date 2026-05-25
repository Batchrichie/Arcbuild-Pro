/**
 * Financial statements engine — Trial Balance is the single source of truth.
 * Income Statement, Balance Sheet, and Cash Flow are derived from the same TB aggregates.
 */

const GHANA_TAX_RATE = 0.25

/** @typedef {{ account_code: string, account_name: string, account_type: string, element?: string, sub_element?: string, nature?: string, is_contra?: boolean, financial_statement?: string }} CoaRow */
/** @typedef {{ account_code: string, total_debits: number, total_credits: number, signed_balance: number, coa: CoaRow }} TrialBalanceRow */

export function formatStatementAmount(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  const n = Number(amount)
  const neg = n < 0
  const abs = Math.abs(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return neg ? `(${abs})` : abs
}

export function signedBalanceForAccount(coa, totalDebits, totalCredits) {
  const deb = Number(totalDebits) || 0
  const cred = Number(totalCredits) || 0
  const net = deb - cred
  const contra = Boolean(coa?.is_contra)

  switch (coa?.account_type) {
    case 'asset':
      return contra ? -net : net
    case 'liability':
    case 'equity':
      return cred - deb
    case 'revenue':
      return cred - deb
    case 'expense':
      return deb - cred
    default:
      return net
  }
}

function isMemoAccount(coa) {
  return coa?.financial_statement === 'Memo' || !coa?.account_type
}

function matchesDivision(row, divisionName, divisions) {
  if (!divisionName || divisionName === 'All') return true
  const div = divisions.find((d) => d.id === row.division_id)
  return div?.name === divisionName
}

/**
 * Aggregate GL rows into trial balance lines keyed by account.
 */
export function aggregateTrialBalance(glRows, coaMap, { division = 'All', divisions = [] } = {}) {
  const totals = {}

  for (const row of glRows) {
    if (!matchesDivision(row, division, divisions)) continue
    const code = row.account_code
    if (!code) continue
    const coa = coaMap[code]
    if (!coa || isMemoAccount(coa)) continue

    if (!totals[code]) {
      totals[code] = {
        account_code: code,
        account_name: coa.account_name || row.account_name || code,
        account_type: coa.account_type,
        total_debits: 0,
        total_credits: 0,
        coa,
      }
    }
    totals[code].total_debits += Number(row.debit_amount) || 0
    totals[code].total_credits += Number(row.credit_amount) || 0
  }

  return Object.values(totals)
    .map((t) => ({
      ...t,
      signed_balance: signedBalanceForAccount(t.coa, t.total_debits, t.total_credits),
      net_balance: t.total_debits - t.total_credits,
    }))
    .filter((t) => Math.abs(t.total_debits) > 0.001 || Math.abs(t.total_credits) > 0.001)
    .sort((a, b) => a.account_code.localeCompare(b.account_code))
}

function sumLines(lines) {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
}

function pickAccounts(trialRows, predicate) {
  return trialRows
    .filter((r) => predicate(r.coa, r))
    .map((r) => ({
      account_code: r.account_code,
      account_name: r.account_name,
      amount: r.signed_balance,
    }))
    .filter((l) => Math.abs(l.amount) > 0.005)
}

function revenueLineLabel(coa) {
  const code = coa.account_code || ''
  if (code.startsWith('41')) return 'Construction Contracts'
  if (code.startsWith('42')) return 'Architectural Design Fees'
  if (code.startsWith('43')) return 'Real Estate Revenue'
  if (code.startsWith('44')) return 'Website & Digital Design'
  if (code.startsWith('45')) return 'Other Income'
  if (code.startsWith('46')) return 'IFRS 15 Revenue Recognition'
  if (/digital|website/i.test(coa.account_name || '')) return 'Website & Digital Design'
  if (/consult/i.test(coa.account_name || '')) return 'Consultancy'
  return coa.account_name || code
}

function groupRevenueLines(trialPeriod) {
  const revenueRows = trialPeriod.filter((r) => r.account_type === 'revenue')
  const groups = new Map()

  for (const row of revenueRows) {
    const label = revenueLineLabel(row.coa)
    const prev = groups.get(label) || 0
    groups.set(label, prev + row.signed_balance)
  }

  return Array.from(groups.entries())
    .map(([label, amount]) => ({ label, amount }))
    .filter((g) => Math.abs(g.amount) > 0.005)
    .sort((a, b) => b.amount - a.amount)
}

function expenseLinesBySubElement(trialPeriod, subElement, codePrefix) {
  return pickAccounts(
    trialPeriod,
    (coa) =>
      coa.account_type === 'expense' &&
      (coa.sub_element === subElement || (codePrefix && coa.account_code?.startsWith(codePrefix)))
  ).map((l) => ({
    ...l,
    label: l.account_name,
  }))
}

const OPEX_NATURE_ORDER = [
  { match: (coa) => coa.account_code?.startsWith('610') || /staff|salary|payroll/i.test(coa.nature || ''), label: 'Staff Salaries' },
  { match: (coa) => coa.account_code?.startsWith('620') || /rent|utilit|office|admin/i.test(coa.nature || ''), label: 'Rent & Utilities' },
  { match: (coa) => /software|subscription/i.test(coa.nature || '') || coa.account_code === '6203', label: 'Software & Subscriptions' },
  { match: (coa) => coa.account_code?.startsWith('660') || /market/i.test(coa.nature || ''), label: 'Marketing' },
  { match: (coa) => coa.account_code?.startsWith('640') || /depreciat/i.test(coa.nature || ''), label: 'Depreciation' },
  { match: (coa) => coa.account_code?.startsWith('650') || /professional/i.test(coa.nature || ''), label: 'Professional Fees' },
  { match: (coa) => /bank charge|finance cost/i.test(coa.nature || '') && !coa.account_code?.startsWith('63'), label: 'Bank Charges' },
]

function groupOperatingExpenses(trialPeriod) {
  const rows = trialPeriod.filter(
    (r) =>
      r.account_type === 'expense' &&
      (r.coa.sub_element === 'Operating Expense' || r.account_code?.startsWith('6')) &&
      r.coa.sub_element !== 'Cost of Sales' &&
      r.coa.sub_element !== 'Finance Cost' &&
      r.coa.sub_element !== 'Tax Expense' &&
      !r.account_code?.startsWith('63') &&
      !r.account_code?.startsWith('7')
  )

  const used = new Set()
  const lines = []

  for (const rule of OPEX_NATURE_ORDER) {
    let amount = 0
    for (const row of rows) {
      if (used.has(row.account_code)) continue
      if (rule.match(row.coa)) {
        amount += row.signed_balance
        used.add(row.account_code)
      }
    }
    if (Math.abs(amount) > 0.005) lines.push({ label: rule.label, amount })
  }

  for (const row of rows) {
    if (used.has(row.account_code)) continue
    if (Math.abs(row.signed_balance) > 0.005) {
      lines.push({ label: row.account_name, amount: row.signed_balance })
    }
  }

  return lines
}

function sumTaxAccounts(trialPeriod) {
  return trialPeriod
    .filter((r) => r.coa.sub_element === 'Tax Expense' || r.account_code?.startsWith('7'))
    .reduce((s, r) => s + r.signed_balance, 0)
}

/**
 * Build income statement, balance sheet, and cash flow from trial balance sets.
 */
export function buildFinancialReports({
  trialPeriod,
  trialAsAt,
  trialOpening,
  coaMap,
}) {
  const revenueLines = groupRevenueLines(trialPeriod)
  const totalRevenue = sumLines(revenueLines)

  const costOfSalesLines = expenseLinesBySubElement(trialPeriod, 'Cost of Sales', '5')
  const totalCostOfSales = sumLines(costOfSalesLines)
  const grossProfit = totalRevenue - totalCostOfSales

  const operatingExpenseLines = groupOperatingExpenses(trialPeriod)
  const totalOperatingExpenses = sumLines(operatingExpenseLines)
  const operatingProfit = grossProfit - totalOperatingExpenses

  const financeLines = pickAccounts(
    trialPeriod,
    (coa) => coa.sub_element === 'Finance Cost' || coa.account_code?.startsWith('63')
  ).map((l) => ({ label: l.account_name, amount: l.amount }))
  const totalFinance = sumLines(financeLines)

  const netProfitBeforeTax = operatingProfit - totalFinance
  const taxFromLedger = sumTaxAccounts(trialPeriod)
  const taxProvision =
    Math.abs(taxFromLedger) > 0.005 ? taxFromLedger : Math.max(0, netProfitBeforeTax) * GHANA_TAX_RATE
  const netProfitAfterTax = netProfitBeforeTax - taxProvision

  const incomeStatement = {
    revenueLines,
    totalRevenue,
    costOfSalesLines,
    totalCostOfSales,
    grossProfit,
    operatingExpenseLines,
    totalOperatingExpenses,
    operatingProfit,
    financeLines,
    totalFinance,
    netProfitBeforeTax,
    taxProvision,
    netProfitAfterTax,
  }

  const bsRows = trialAsAt.filter((r) => ['asset', 'liability', 'equity'].includes(r.account_type))

  const assetsCurrent = pickAccounts(
    bsRows,
    (coa) =>
      coa.account_type === 'asset' &&
      (coa.sub_element === 'Current Asset' || (!coa.sub_element && coa.account_code?.startsWith('11')))
  )
  const assetsNonCurrent = pickAccounts(
    bsRows,
    (coa) =>
      coa.account_type === 'asset' &&
      (coa.sub_element === 'Non-Current Asset' ||
        (!coa.sub_element && (coa.account_code?.startsWith('12') || coa.account_code?.startsWith('13'))))
  )

  const liabilitiesCurrent = pickAccounts(
    bsRows,
    (coa) =>
      coa.account_type === 'liability' &&
      (coa.sub_element === 'Current Liability' ||
        (!coa.sub_element && (coa.account_code?.startsWith('21') || coa.account_code?.startsWith('23'))))
  )
  const liabilitiesNonCurrent = pickAccounts(
    bsRows,
    (coa) =>
      coa.account_type === 'liability' &&
      (coa.sub_element === 'Non-Current Liability' || (!coa.sub_element && coa.account_code?.startsWith('22')))
  )

  const equityFromTb = pickAccounts(bsRows, (coa) => coa.account_type === 'equity')
  const equityExCurrentYear = equityFromTb.filter((l) => !l.account_code?.startsWith('33'))

  const totalAssets =
    sumLines(assetsCurrent) + sumLines(assetsNonCurrent)
  const totalLiabilities =
    sumLines(liabilitiesCurrent) + sumLines(liabilitiesNonCurrent)
  const equityLedgerTotal = sumLines(equityFromTb)
  const currentYearFromAccount = equityFromTb
    .filter((l) => l.account_code?.startsWith('33'))
    .reduce((s, l) => s + l.amount, 0)

  const currentYearProfit =
    Math.abs(currentYearFromAccount) > 0.005 ? currentYearFromAccount : netProfitAfterTax

  const totalEquity =
    sumLines(equityExCurrentYear) + currentYearProfit

  const balanceSheet = {
    assetsCurrent,
    assetsNonCurrent,
    totalAssets,
    liabilitiesCurrent,
    liabilitiesNonCurrent,
    totalLiabilities,
    equityLines: [
      ...equityExCurrentYear,
      { account_code: 'NPAT', account_name: 'Current Year Profit / (Loss)', amount: currentYearProfit },
    ],
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.02,
    variance: totalAssets - (totalLiabilities + totalEquity),
    currentYearProfit,
    netProfitAfterTax,
  }

  const closingBalance = (codes) => {
    const set = new Set(Array.isArray(codes) ? codes : [codes])
    return trialAsAt
      .filter((r) => [...set].some((c) => r.account_code?.startsWith(c)))
      .reduce((s, r) => s + r.signed_balance, 0)
  }

  const openingBalance = (codes) => {
    const set = new Set(Array.isArray(codes) ? codes : [codes])
    return trialOpening
      .filter((r) => [...set].some((c) => r.account_code?.startsWith(c)))
      .reduce((s, r) => s + r.signed_balance, 0)
  }

  const movement = (codes) => closingBalance(codes) - openingBalance(codes)

  const depreciation = trialPeriod
    .filter((r) => r.account_code?.startsWith('640') || /depreciat/i.test(r.coa.nature || ''))
    .reduce((s, r) => s + r.signed_balance, 0)

  const receivablesChange = -(movement(['111']))
  const payablesChange = movement(['2101', '2108'])
  const inventoryChange = -movement(['114'])
  const contractAssetChange = -movement(['130', '140'])

  const investingCash = -trialPeriod
    .filter((r) => r.account_code?.startsWith('121') && r.account_type === 'asset')
    .reduce((s, r) => s + (Number(r.total_debits) - Number(r.total_credits)), 0)

  const financingCash = movement(['220'])

  const netCashFromOperations =
    netProfitAfterTax +
    depreciation +
    receivablesChange +
    payablesChange +
    inventoryChange +
    contractAssetChange

  const netCashFromInvesting = -investingCash
  const netCashFromFinancing = financingCash
  const netCashChange = netCashFromOperations + netCashFromInvesting + netCashFromFinancing

  const cashFlow = {
    netProfitAfterTax,
    depreciation,
    receivablesChange,
    payablesChange,
    inventoryChange,
    contractAssetChange,
    netCashFromOperations,
    investingLines: pickAccounts(
      trialPeriod,
      (coa) => coa.account_type === 'asset' && coa.sub_element === 'Non-Current Asset' && coa.account_code?.startsWith('121')
    ).map((l) => ({ label: l.account_name, amount: -l.amount })),
    netCashFromInvesting,
    financingLines: pickAccounts(
      trialPeriod,
      (coa) => coa.account_type === 'liability' && coa.sub_element === 'Non-Current Liability'
    ).map((l) => ({ label: l.account_name, amount: l.amount })),
    netCashFromFinancing,
    netCashChange,
    openingCash: openingBalance(['1101', '1102', '1103', '1104', '1401']),
    closingCash: closingBalance(['1101', '1102', '1103', '1104', '1401']),
  }

  const trialTotals = {
    debits: trialPeriod.reduce((s, r) => s + r.total_debits, 0),
    credits: trialPeriod.reduce((s, r) => s + r.total_credits, 0),
    balanced: Math.abs(
      trialPeriod.reduce((s, r) => s + r.total_debits, 0) -
        trialPeriod.reduce((s, r) => s + r.total_credits, 0)
    ) < 0.02,
  }

  return {
    incomeStatement,
    balanceSheet,
    cashFlow,
    trialTotals,
  }
}

export function dayBefore(isoDate) {
  const d = new Date(isoDate)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function startOfYear(date = new Date()) {
  const d = new Date(date)
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

export function endOfYear(date = new Date()) {
  const d = new Date(date)
  return new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10)
}
