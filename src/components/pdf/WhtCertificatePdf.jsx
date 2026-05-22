import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { pdfStyles } from './PdfTheme'
import { COMPANY } from '../../lib/company-config'
import logo from '../../assets/ModuloDevLogo.png'

function formatGhs(value) {
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

export default function WhtCertificatePdf({ certificate }) {
  const year = certificate.year || certificate.period_year || new Date().getFullYear()
  const grossPaid = Number(certificate.total_gross_paid || certificate.total_gross_amount || 0)
  const whtRate = Number(certificate.wht_rate ?? (certificate.rate || 0))
  const whtDeducted = Number(certificate.total_wht_deducted || 0)
  const subcontractorName = certificate.subcontractor_name || certificate.name || 'Subcontractor'
  const tin = certificate.tin || certificate.tax_id || 'N/A'

  return (
    <Document>
      <Page style={pdfStyles.page}>
        <View style={pdfStyles.headerBar}>
          <View style={pdfStyles.headerTop}>
            <Image src={logo} style={pdfStyles.logoImage} />
            <View style={pdfStyles.headerTextGroup}>
              <Text style={pdfStyles.companyName}>{COMPANY.name}</Text>
              <Text style={pdfStyles.companyTagline}>WITHHOLDING TAX CERTIFICATE</Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Issuer</Text>
          <Text style={pdfStyles.value}>{COMPANY.name}</Text>
          <Text style={pdfStyles.value}>{COMPANY.address}</Text>
          <Text style={pdfStyles.value}>{COMPANY.city}</Text>
          <Text style={pdfStyles.value}>Email: {COMPANY.email}</Text>
          <Text style={pdfStyles.value}>Phone: {COMPANY.phone}</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Recipient</Text>
          <Text style={pdfStyles.label}>Name</Text>
          <Text style={pdfStyles.value}>{subcontractorName}</Text>
          <Text style={pdfStyles.label}>TIN</Text>
          <Text style={pdfStyles.value}>{tin}</Text>
          <Text style={pdfStyles.label}>Tax Year</Text>
          <Text style={pdfStyles.value}>{year}</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Certificate Details</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableHeaderCell}>Payment Date</Text>
              <Text style={pdfStyles.tableHeaderCell}>Description</Text>
              <Text style={pdfStyles.tableHeaderCell}>Gross Amount</Text>
              <Text style={pdfStyles.tableHeaderCell}>WHT Rate</Text>
              <Text style={pdfStyles.tableHeaderCell}>WHT Deducted</Text>
            </View>
            <View style={pdfStyles.tableRow}>
              <Text style={pdfStyles.tableCell}>{year}</Text>
              <Text style={pdfStyles.tableCell}>Annual withholding tax summary</Text>
              <Text style={pdfStyles.tableCell}>{formatGhs(grossPaid)}</Text>
              <Text style={pdfStyles.amountCell}>{whtRate}%</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(whtDeducted)}</Text>
            </View>
          </View>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.tableCell}>Total WHT deducted</Text>
            <Text style={pdfStyles.amountCell}>{formatGhs(whtDeducted)}</Text>
          </View>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.value}>
            This certificate confirms that withholding tax has been deducted and will be remitted to the Ghana Revenue Authority.
          </Text>
        </View>

        <View style={[pdfStyles.sectionRow, { marginTop: 24 }]}> 
          <Text style={pdfStyles.label}>Authorised by</Text>
          <Text style={pdfStyles.value}>{COMPANY.shortName} Finance</Text>
          <Text style={pdfStyles.label}>Date</Text>
          <Text style={pdfStyles.value}>{formatDate(new Date().toISOString())}</Text>
        </View>

        <Text style={pdfStyles.footer}>This is a computer-generated certificate — {COMPANY.name}.</Text>
      </Page>
    </Document>
  )
}
