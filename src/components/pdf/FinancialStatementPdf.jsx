import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { pdfStyles } from './PdfTheme'
import { COMPANY } from '../../lib/company-config'
import { formatStatementAmount } from '../../lib/financialStatements'
import logo from '../../assets/ModuloDevLogo.png'

function fmtCurrency(value) {
  return `GHS ${formatStatementAmount(value)}`
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function FinancialStatementPdf({ statementType, startDate, endDate, asAtDate, division, reports = {} }) {
  const is = reports.incomeStatement || {}
  const bs = reports.balanceSheet || {}
  const cf = reports.cashFlow || {}
  const trialRows = reports.trialPeriod || []

  const renderIncome = () => (
    <View>
      <Text style={pdfStyles.sectionTitle}>Income Statement</Text>
      <Text style={pdfStyles.label}>Period: {formatDate(startDate)} — {formatDate(endDate)}</Text>
      <Text style={pdfStyles.label}>Division: {division || 'All'}</Text>
      <Text style={pdfStyles.label}>Revenue</Text>
      {(is.revenueLines || []).map((line) => (
        <View style={pdfStyles.tableRow} key={line.label}>
          <Text style={pdfStyles.tableCell}>{line.label}</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(line.amount)}</Text>
        </View>
      ))}
      <View style={pdfStyles.totalRow}>
        <Text style={pdfStyles.tableCell}>Total Revenue</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(is.totalRevenue)}</Text>
      </View>
      <Text style={pdfStyles.label}>Cost of Sales</Text>
      {(is.costOfSalesLines || []).map((line) => (
        <View style={pdfStyles.tableRow} key={line.account_code}>
          <Text style={pdfStyles.tableCell}>{line.account_name}</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(line.amount)}</Text>
        </View>
      ))}
      <View style={pdfStyles.totalRow}>
        <Text style={pdfStyles.tableCell}>Gross Profit</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(is.grossProfit)}</Text>
      </View>
      <View style={pdfStyles.totalRow}>
        <Text style={pdfStyles.tableCell}>Net Profit After Tax</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(is.netProfitAfterTax)}</Text>
      </View>
    </View>
  )

  const renderBalance = () => (
    <View>
      <Text style={pdfStyles.sectionTitle}>Balance Sheet</Text>
      <Text style={pdfStyles.label}>As at: {formatDate(asAtDate)}</Text>
      <View style={pdfStyles.totalRow}>
        <Text style={pdfStyles.tableCell}>Total Assets</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(bs.totalAssets)}</Text>
      </View>
      <View style={pdfStyles.totalRow}>
        <Text style={pdfStyles.tableCell}>Total Liabilities + Equity</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(bs.totalLiabilitiesAndEquity)}</Text>
      </View>
      <Text style={pdfStyles.label}>
        {bs.balanced ? 'Balanced' : `Variance: ${fmtCurrency(bs.variance)}`}
      </Text>
    </View>
  )

  const renderTrial = () => (
    <View>
      <Text style={pdfStyles.sectionTitle}>Trial Balance</Text>
      <Text style={pdfStyles.label}>Period: {formatDate(startDate)} — {formatDate(endDate)}</Text>
      {trialRows.slice(0, 40).map((row) => (
        <View style={pdfStyles.tableRow} key={row.account_code}>
          <Text style={pdfStyles.tableCell}>{row.account_code}</Text>
          <Text style={pdfStyles.amountCell}>{fmtCurrency(row.net_balance)}</Text>
        </View>
      ))}
    </View>
  )

  const renderCash = () => (
    <View>
      <Text style={pdfStyles.sectionTitle}>Cash Flow Statement</Text>
      <Text style={pdfStyles.label}>Period: {formatDate(startDate)} — {formatDate(endDate)}</Text>
      <View style={pdfStyles.tableRow}>
        <Text style={pdfStyles.tableCell}>Net Cash from Operations</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(cf.netCashFromOperations)}</Text>
      </View>
      <View style={pdfStyles.tableRow}>
        <Text style={pdfStyles.tableCell}>Net Cash from Investing</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(cf.netCashFromInvesting)}</Text>
      </View>
      <View style={pdfStyles.tableRow}>
        <Text style={pdfStyles.tableCell}>Net Cash from Financing</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(cf.netCashFromFinancing)}</Text>
      </View>
      <View style={pdfStyles.totalRow}>
        <Text style={pdfStyles.tableCell}>Net Cash Change</Text>
        <Text style={pdfStyles.amountCell}>{fmtCurrency(cf.netCashChange)}</Text>
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
        <Text style={pdfStyles.footer}>Computer-generated — {COMPANY.name}.</Text>
      </Page>
    </Document>
  )
}
