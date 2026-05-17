import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { pdfStyles, colors } from './PdfTheme'
import { COMPANY } from '../../lib/company-config'
import logo from '../../assets/ModuloDevLogo.png'

function fmtCurrency(value) {
  const amount = Number(value || 0)
  return `GHS ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function FinancialStatementPdf({ statementType, startDate, endDate, asAtDate, division, incomeAgg = {}, bsRows = [], trialAgg = [], cashFlow = {} }) {
  const totalRevenue = Object.values(incomeAgg).reduce((sum, row) => sum + (Number(row.revenue || 0)), 0)
  const totalExpense = Object.values(incomeAgg).reduce((sum, row) => sum + (Number(row.expense || 0)), 0)
  const netProfit = totalRevenue - totalExpense
  const totalAssets = bsRows.filter((row) => row.account_code?.startsWith('11') || row.account_code?.startsWith('12')).reduce((sum, row) => sum + Number(row.balance || 0), 0)
  const totalLiabilities = bsRows.filter((row) => row.account_code?.startsWith('21') || row.account_code?.startsWith('22')).reduce((sum, row) => sum + Number(row.balance || 0), 0)
  const totalEquity = bsRows.filter((row) => row.account_code?.startsWith('3')).reduce((sum, row) => sum + Number(row.balance || 0), 0)

  const renderIncome = () => (
    <View>
      <View style={pdfStyles.sectionRow}>
        <Text style={pdfStyles.sectionTitle}>Income Statement</Text>
        <Text style={pdfStyles.label}>Period</Text>
        <Text style={pdfStyles.value}>{`${formatDate(startDate)} — ${formatDate(endDate)}`}</Text>
        <Text style={pdfStyles.label}>Division</Text>
        <Text style={pdfStyles.value}>{division || 'All'}</Text>
      </View>
      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableHeader}>
          <Text style={pdfStyles.tableHeaderCell}>Division</Text>
          <Text style={pdfStyles.tableHeaderCell}>Revenue</Text>
          <Text style={pdfStyles.tableHeaderCell}>Expenses</Text>
          <Text style={pdfStyles.tableHeaderCell}>Net Profit</Text>
        </View>
        {Object.entries(incomeAgg).map(([name, row]) => (
          <View style={pdfStyles.tableRow} key={name}>
            <Text style={pdfStyles.tableCell}>{name}</Text>
            <Text style={pdfStyles.tableCell}>{fmtCurrency(row.revenue)}</Text>
            <Text style={pdfStyles.tableCell}>{fmtCurrency(row.expense)}</Text>
            <Text style={pdfStyles.amountCell}>{fmtCurrency(Number(row.revenue || 0) - Number(row.expense || 0))}</Text>
          </View>
        ))}
        <View style={pdfStyles.totalRow}>
          <Text style={pdfStyles.tableCell}>Total</Text>
          <Text style={pdfStyles.tableCell}>{fmtCurrency(totalRevenue)}</Text>
          <Text style={pdfStyles.tableCell}>{fmtCurrency(totalExpense)}</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(netProfit)}</Text>
        </View>
      </View>
    </View>
  )

  const renderBalance = () => (
    <View>
      <View style={pdfStyles.sectionRow}>
        <Text style={pdfStyles.sectionTitle}>Balance Sheet</Text>
        <Text style={pdfStyles.label}>As at</Text>
        <Text style={pdfStyles.value}>{formatDate(asAtDate)}</Text>
      </View>
      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableHeader}>
          <Text style={pdfStyles.tableHeaderCell}>Account</Text>
          <Text style={pdfStyles.tableHeaderCell}>Type</Text>
          <Text style={pdfStyles.tableHeaderCell}>Balance</Text>
        </View>
        {bsRows.map((row) => (
          <View style={pdfStyles.tableRow} key={row.account_code}>
            <Text style={pdfStyles.tableCell}>{row.account_name || row.account_code}</Text>
            <Text style={pdfStyles.tableCell}>{row.account_type || 'N/A'}</Text>
            <Text style={pdfStyles.amountCell}>{fmtCurrency(row.balance)}</Text>
          </View>
        ))}
        <View style={pdfStyles.totalRow}>
          <Text style={pdfStyles.tableCell}>Totals</Text>
          <Text style={pdfStyles.tableCell}>{''}</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(totalAssets + totalLiabilities + totalEquity)}</Text>
        </View>
      </View>
      <View style={pdfStyles.sectionRow}>
        <Text style={pdfStyles.value}>Assets: {fmtCurrency(totalAssets)}</Text>
        <Text style={pdfStyles.value}>Liabilities: {fmtCurrency(totalLiabilities)}</Text>
        <Text style={pdfStyles.value}>Equity: {fmtCurrency(totalEquity)}</Text>
      </View>
    </View>
  )

  const renderTrial = () => (
    <View>
      <View style={pdfStyles.sectionRow}>
        <Text style={pdfStyles.sectionTitle}>Trial Balance</Text>
        <Text style={pdfStyles.label}>Period</Text>
        <Text style={pdfStyles.value}>{`${formatDate(startDate)} — ${formatDate(endDate)}`}</Text>
      </View>
      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableHeader}>
          <Text style={pdfStyles.tableHeaderCell}>Account Code</Text>
          <Text style={pdfStyles.tableHeaderCell}>Account Name</Text>
          <Text style={pdfStyles.tableHeaderCell}>Debits</Text>
          <Text style={pdfStyles.tableHeaderCell}>Credits</Text>
          <Text style={pdfStyles.tableHeaderCell}>Net Balance</Text>
        </View>
        {trialAgg.map((row) => (
          <View style={pdfStyles.tableRow} key={row.account_code}>
            <Text style={pdfStyles.tableCell}>{row.account_code}</Text>
            <Text style={pdfStyles.tableCell}>{row.account_name}</Text>
            <Text style={pdfStyles.tableCell}>{fmtCurrency(row.total_debits)}</Text>
            <Text style={pdfStyles.tableCell}>{fmtCurrency(row.total_credits)}</Text>
            <Text style={pdfStyles.amountCell}>{fmtCurrency(Number(row.total_debits || 0) - Number(row.total_credits || 0))}</Text>
          </View>
        ))}
      </View>
    </View>
  )

  const renderCash = () => (
    <View>
      <View style={pdfStyles.sectionRow}>
        <Text style={pdfStyles.sectionTitle}>Cash Flow Statement</Text>
        <Text style={pdfStyles.label}>Period</Text>
        <Text style={pdfStyles.value}>{`${formatDate(startDate)} — ${formatDate(endDate)}`}</Text>
      </View>
      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableRow}>
          <Text style={pdfStyles.tableCell}>Net Profit After Tax</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(cashFlow.netProfit)}</Text>
        </View>
        <View style={pdfStyles.tableRow}>
          <Text style={pdfStyles.tableCell}>Depreciation</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(cashFlow.depreciation)}</Text>
        </View>
        <View style={pdfStyles.tableRow}>
          <Text style={pdfStyles.tableCell}>Receivables Change</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(-cashFlow.receivables)}</Text>
        </View>
        <View style={pdfStyles.tableRow}>
          <Text style={pdfStyles.tableCell}>Payables Change</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(cashFlow.payables)}</Text>
        </View>
        <View style={pdfStyles.tableRow}>
          <Text style={pdfStyles.tableCell}>Investing Activities</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(-cashFlow.investing)}</Text>
        </View>
        <View style={pdfStyles.tableRow}>
          <Text style={pdfStyles.tableCell}>Financing Activities</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(cashFlow.financing)}</Text>
        </View>
        <View style={pdfStyles.totalRow}>
          <Text style={pdfStyles.tableCell}>Net Cash Change</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency((cashFlow.netProfit || 0) + (cashFlow.depreciation || 0) - (cashFlow.receivables || 0) + (cashFlow.payables || 0) - (cashFlow.investing || 0) + (cashFlow.financing || 0))}</Text>
        </View>
      </View>
    </View>
  )

  return (
    <Document>
      <Page style={pdfStyles.page}>
        <View style={pdfStyles.headerBar}>
          <View style={pdfStyles.headerTop}>
            <Image src={logo} style={pdfStyles.logoImage} />
            <View style={pdfStyles.headerTextGroup}>
              <Text style={pdfStyles.companyName}>{COMPANY.name}</Text>
              <Text style={pdfStyles.companyTagline}>Financial Statement</Text>
            </View>
          </View>
        </View>
        {statementType === 'income' && renderIncome()}
        {statementType === 'balance' && renderBalance()}
        {statementType === 'trial' && renderTrial()}
        {statementType === 'cash' && renderCash()}
        <Text style={pdfStyles.footer}>This is a computer-generated financial statement — {COMPANY.name}.</Text>
      </Page>
    </Document>
  )
}
