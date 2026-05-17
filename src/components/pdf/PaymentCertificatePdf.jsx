import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, colors } from './PdfTheme'

function formatGhs(value) {
  const amount = Number(value || 0)
  return `GHS ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PaymentCertificatePdf({ certificate }) {
  return (
    <Document>
      <Page style={pdfStyles.page}>
        <View style={pdfStyles.headerBar}>
          <Text style={pdfStyles.companyName}>ARCBUILD PRO</Text>
          <Text style={pdfStyles.companyTagline}>PAYMENT CERTIFICATE</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Certificate</Text>
          <Text style={pdfStyles.label}>Certificate Number</Text>
          <Text style={pdfStyles.value}>{certificate.certificateNumber || 'N/A'}</Text>
          <Text style={pdfStyles.label}>Issue Date</Text>
          <Text style={pdfStyles.value}>{new Date().toLocaleDateString('en-GH')}</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Recipient</Text>
          <Text style={pdfStyles.label}>Subcontractor</Text>
          <Text style={pdfStyles.value}>{certificate.subcontractorName || 'Subcontractor'}</Text>
          <Text style={pdfStyles.label}>TIN</Text>
          <Text style={pdfStyles.value}>{certificate.subcontractorTin || 'N/A'}</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Project & Payment</Text>
          <Text style={pdfStyles.label}>Project</Text>
          <Text style={pdfStyles.value}>{certificate.projectName || 'Project name unavailable'}</Text>
          <Text style={pdfStyles.label}>Description</Text>
          <Text style={pdfStyles.value}>{certificate.description || 'Payment certificate for completed works'}</Text>
          <Text style={pdfStyles.label}>Payment Date</Text>
          <Text style={pdfStyles.value}>{certificate.paymentDate || 'N/A'}</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Amounts</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableHeaderCell}>Description</Text>
              <Text style={pdfStyles.tableHeaderCell}>Amount</Text>
            </View>
            <View style={pdfStyles.tableRow}>
              <Text style={pdfStyles.tableCell}>Gross Amount</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(certificate.grossGhs)}</Text>
            </View>
            <View style={pdfStyles.tableRow}>
              <Text style={pdfStyles.tableCell}>WHT Deducted</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(certificate.whtDeducted)}</Text>
            </View>
            <View style={pdfStyles.totalRow}>
              <Text style={pdfStyles.tableCell}>Net Payable</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(certificate.netPayable)}</Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.value}>
            Payment certified by ARCBUILD PRO for works completed as described.
          </Text>
        </View>

        <View style={[pdfStyles.sectionRow, { marginTop: 24 }]}> 
          <Text style={pdfStyles.label}>Authorised by</Text>
          <Text style={pdfStyles.value}>ARCBUILD PRO Finance</Text>
          <Text style={pdfStyles.label}>Date</Text>
          <Text style={pdfStyles.value}>{new Date().toLocaleDateString('en-GH')}</Text>
        </View>

        <Text style={pdfStyles.footer}>This is a computer-generated payment certificate — ARCBUILD PRO.</Text>
      </Page>
    </Document>
  )
}
