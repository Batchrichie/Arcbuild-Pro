import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { numberToWords } from '../../utils/numberToWords'

const colors = {
  navy: '#0f172a',
  slate: '#64748b',
  emerald: '#10b981',
  amber: '#f59e0b',
  white: '#ffffff',
  nearBlack: '#1e293b',
  red: '#ef4444',
}

function fmt(amount) {
  const n = Number(amount) || 0
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.white,
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  company: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: colors.navy },
  tagline: { fontSize: 8, color: colors.slate, marginTop: 4 },
  contact: { fontSize: 8, color: colors.slate, marginTop: 2 },
  receiptBlock: { textAlign: 'right' },
  receiptTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: colors.navy, textTransform: 'uppercase' },
  receiptMeta: { fontSize: 10, color: colors.slate, marginTop: 6 },
  hrThick: { height: 4, backgroundColor: colors.navy, marginVertical: 8 },

  sectionLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 1, color: colors.slate, marginBottom: 4 },
  clientName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: colors.navy },
  clientMeta: { fontSize: 9, color: colors.slate, marginTop: 2 },

  amountBox: { backgroundColor: colors.nearBlack, padding: 12, borderRadius: 6, color: colors.white, marginTop: 8, marginBottom: 8 },
  amountLabel: { fontSize: 8, textTransform: 'uppercase', color: colors.white, textAlign: 'center' },
  amountFigure: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: colors.white, textAlign: 'center', marginTop: 6 },
  amountWords: { fontSize: 9, fontStyle: 'italic', color: colors.white, textAlign: 'center', marginTop: 6 },

  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0 },
  tableLabel: { color: colors.slate, fontSize: 9 },
  tableValue: { color: colors.navy, fontSize: 9, fontFamily: 'Helvetica-Bold' },

  breakdownTable: { marginTop: 4, marginBottom: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  negative: { color: colors.red },
  amberText: { color: colors.amber },

  outstandingBox: { padding: 10, borderRadius: 6, marginTop: 8, marginBottom: 8 },
  footerHr: { height: 1, backgroundColor: colors.slate, marginTop: 12, marginBottom: 8 },
  footerText: { fontSize: 9, color: colors.slate, textAlign: 'center' },
  generated: { fontSize: 8, color: colors.slate, textAlign: 'right', marginTop: 6 },
})

export default function PaymentReceiptPdf({ receiptData = {}, amountPaid = 0, paymentDate = '', paymentReference = '' }) {
  const currency = receiptData.currency || 'GHS'
  const formatCurrency = (val) => `${currency} ${fmt(val)}`

  const expectedReceiptGhs = Number(receiptData.expected_receipt_ghs || 0)
  const paymentAmt = Number(amountPaid || 0)
  const outstandingBalance = Number((expectedReceiptGhs - paymentAmt).toFixed(2))

  const createdOn = new Date().toLocaleString()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.company}>ARCBUILD PRO</Text>
            <Text style={styles.tagline}>Construction · Architecture · Real Estate · Logistics</Text>
            <Text style={styles.contact}>Accra, Ghana | info@arcbuildpro.com | +233 000 000 000</Text>
          </View>

          <View style={styles.receiptBlock}>
            <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>
            <Text style={styles.receiptMeta}>{`RCPT-${receiptData.invoice_number || ''}`}</Text>
            <Text style={styles.receiptMeta}>{paymentDate ? new Date(paymentDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</Text>
          </View>
        </View>

        <View style={styles.hrThick} />

        <View>
          <Text style={styles.sectionLabel}>RECEIVED FROM</Text>
          <Text style={styles.clientName}>{receiptData.client?.name || ''}</Text>
          <Text style={styles.clientMeta}>{receiptData.client?.client_type || ''}</Text>
          {receiptData.client?.address ? <Text style={styles.clientMeta}>{receiptData.client.address}</Text> : null}
          {receiptData.client?.contact_person ? <Text style={styles.clientMeta}>{receiptData.client.contact_person}</Text> : null}
          {receiptData.client?.tin ? <Text style={styles.clientMeta}>{`TIN: ${receiptData.client.tin}`}</Text> : null}
          {receiptData.project?.name ? <Text style={styles.clientMeta}>{`Project: ${receiptData.project.name}`}</Text> : null}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>AMOUNT RECEIVED</Text>
          <Text style={styles.amountFigure}>{formatCurrency(paymentAmt)}</Text>
          <Text style={styles.amountWords}>{numberToWords(paymentAmt, currency)}</Text>
        </View>

        <View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Payment Reference</Text>
            <Text style={styles.tableValue}>{paymentReference || ''}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Payment Date</Text>
            <Text style={styles.tableValue}>{paymentDate ? new Date(paymentDate).toLocaleDateString() : ''}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Payment Method</Text>
            <Text style={styles.tableValue}>Bank Transfer</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Invoice Number</Text>
            <Text style={styles.tableValue}>{receiptData.invoice_number || ''}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Invoice Currency</Text>
            <Text style={styles.tableValue}>{receiptData.currency || ''}</Text>
          </View>
        </View>

        <View style={styles.breakdownTable}>
          <View style={styles.breakdownRow}>
            <Text style={styles.tableLabel}>Invoice Subtotal</Text>
            <Text style={styles.tableValue}>{formatCurrency(receiptData.subtotal_ghs)}</Text>
          </View>

          {Number(receiptData.vat_amount_ghs || 0) > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.tableLabel}>VAT (15%)</Text>
              <Text style={styles.tableValue}>{formatCurrency(receiptData.vat_amount_ghs)}</Text>
            </View>
          )}

          {Number(receiptData.nhil_amount_ghs || 0) > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.tableLabel}>NHIL (2.5%)</Text>
              <Text style={styles.tableValue}>{formatCurrency(receiptData.nhil_amount_ghs)}</Text>
            </View>
          )}

          {Number(receiptData.getfund_amount_ghs || 0) > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.tableLabel}>GetFUND (2.5%)</Text>
              <Text style={styles.tableValue}>{formatCurrency(receiptData.getfund_amount_ghs)}</Text>
            </View>
          )}

          <View style={styles.breakdownRow}>
            <Text style={[styles.tableLabel, { fontWeight: 'bold' }]}>Gross Total</Text>
            <Text style={[styles.tableValue]}>{formatCurrency(receiptData.gross_total_ghs)}</Text>
          </View>

          {Number(receiptData.wht_amount_ghs || 0) > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.tableLabel}>WHT Deducted</Text>
              <Text style={[styles.tableValue, styles.negative]}>-{formatCurrency(receiptData.wht_amount_ghs)}</Text>
            </View>
          )}

          {Number(receiptData.retention_withheld || 0) > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.tableLabel}>Retention Withheld</Text>
              <Text style={[styles.tableValue, styles.amberText]}>{formatCurrency(receiptData.retention_withheld)}</Text>
            </View>
          )}

          <View style={styles.breakdownRow}>
            <Text style={[styles.tableLabel, { fontWeight: 'bold' }]}>Expected Receipt</Text>
            <Text style={[styles.tableValue]}>{formatCurrency(receiptData.expected_receipt_ghs)}</Text>
          </View>
        </View>

        {outstandingBalance <= 0 ? (
          <View style={[styles.outstandingBox, { backgroundColor: colors.emerald, color: colors.white }]}> 
            <Text style={{ textAlign: 'center', fontWeight: 'bold', color: colors.white }}>FULLY PAID — No Outstanding Balance</Text>
          </View>
        ) : (
          <View style={[styles.outstandingBox, { backgroundColor: colors.amber }]}> 
            <Text style={{ fontSize: 9, textTransform: 'uppercase', color: colors.navy }}>OUTSTANDING BALANCE</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.navy, marginTop: 6 }}>{formatCurrency(outstandingBalance)}</Text>
            <Text style={{ fontSize: 9, color: colors.navy, marginTop: 6 }}>Payment is due. Please contact us to arrange settlement.</Text>
          </View>
        )}

        <View style={styles.footerHr} />
        <Text style={styles.footerText}>This is an official payment receipt issued by ARCBUILD PRO.</Text>
        <Text style={styles.footerText}>For queries, contact accounts@arcbuildpro.com</Text>
        <Text style={styles.generated}>{`Generated on: ${createdOn}`}</Text>
      </Page>
    </Document>
  )
}
