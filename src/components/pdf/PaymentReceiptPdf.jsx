import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { COMPANY } from '../../lib/company-config'
import { numberToWords } from '../../utils/numberToWords'
import Logo from '../../assets/ModuloDevLogo.png'

const colors = {
  dark: '#1a1a1a',
  gold: '#C9A84C',
  slate: '#9ca3af',
  white: '#ffffff',
  lightBg: '#f7f7f7',
}

function fmt(amount) {
  const n = Number(amount) || 0
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(date) {
  const d = new Date(date)
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const day = String(d.getDate()).padStart(2, '0')
  const year = d.getFullYear()
  return `${month}-${day}-${year}`
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.lightBg,
    padding: 0,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  container: { padding: 20 },
  headerRow: { backgroundColor: colors.dark, paddingTop: 20, paddingBottom: 14, paddingLeft: 20, paddingRight: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerContent: { flex: 1, alignItems: 'center' },
  logo: { width: 56, height: 56 },
  company: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: colors.gold, textAlign: 'center' },
  receiptTitleBlock: { textAlign: 'center', marginTop: 6 },
  receiptTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: colors.white, textTransform: 'uppercase' },
  receiptMeta: { fontSize: 10, color: '#d1d5db', marginTop: 4 },
  hrThick: { height: 2, backgroundColor: colors.slate, marginVertical: 6 },

  sectionLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: colors.slate, marginBottom: 6 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatarText: { color: colors.gold, fontSize: 14, fontFamily: 'Helvetica-Bold' },
  clientName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: colors.dark },
  clientMeta: { fontSize: 10, color: colors.slate, marginTop: 2 },

  amountBand: { backgroundColor: colors.gold, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 6 },
  amountLabel: { fontSize: 9, color: colors.dark, textTransform: 'uppercase', opacity: 0.9 },
  amountFigure: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: colors.dark },
  badge: { backgroundColor: colors.dark, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  badgeText: { color: colors.gold, fontSize: 9, fontFamily: 'Helvetica-Bold' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  infoCard: { backgroundColor: '#f3f4f6', padding: 10, borderRadius: 8, width: '48%' },
  infoLabel: { fontSize: 8, color: colors.slate, textTransform: 'uppercase' },
  infoValue: { fontSize: 11, color: colors.dark, fontFamily: 'Helvetica-Bold', marginTop: 6 },

  breakdownTable: { marginTop: 8, marginBottom: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { fontSize: 10, color: colors.slate },
  breakdownValue: { fontSize: 10, color: colors.dark, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.slate, marginVertical: 6 },

  outstandingBox: { padding: 12, borderRadius: 10, marginTop: 12 },
  footerHr: { height: 1, backgroundColor: '#e5e7eb', marginTop: 12, marginBottom: 8 },
  footerText: { fontSize: 9, color: colors.slate, textAlign: 'center' },
  generated: { fontSize: 8, color: colors.slate, textAlign: 'center', marginTop: 6 },
  footerStrip: { backgroundColor: '#f3f4f6', padding: 8, borderRadius: 6, marginTop: 12 },
})

export default function PaymentReceiptPdf({ receiptData = {}, amountPaid = 0, paymentDate = '', paymentReference = '' }) {
  const currency = receiptData.currency || 'GHS'
  const formatCurrency = (val) => `${currency} ${fmt(val)}`

  const expectedReceiptGhs = Number(receiptData.expected_receipt_ghs || 0)
  const paymentAmt = Number(amountPaid || 0)
  const outstandingBalance = Number((expectedReceiptGhs - paymentAmt).toFixed(2))

  const createdOn = new Date().toLocaleString()
  const clientName = receiptData.client?.name || ''
  const initials = clientName.split(' ').filter(Boolean).map(n => n[0]).slice(0,2).join('').toUpperCase() || 'NA'
  const paymentMethod = receiptData.payment_account_name || receiptData.payment_method || 'Bank Transfer'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Image src={Logo} style={styles.logo} />
            <View style={styles.headerContent}>
              <Text style={styles.company}>{COMPANY.name}</Text>
              <View style={styles.receiptTitleBlock}>
                <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>
                <Text style={styles.receiptMeta}>{`RCPT-${receiptData.invoice_number || ''}`}</Text>
                <Text style={styles.receiptMeta}>{paymentDate ? formatDate(paymentDate) : ''}</Text>
              </View>
            </View>
          </View>

          <View style={styles.amountBand}>
            <View>
              <Text style={styles.amountLabel}>AMOUNT RECEIVED</Text>
              <Text style={styles.amountFigure}>{formatCurrency(paymentAmt)}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{paymentReference || paymentMethod}</Text>
            </View>
          </View>

          <View style={{ padding: 16, backgroundColor: colors.white, borderRadius: 12, marginTop: 12 }}>
            <Text style={styles.sectionLabel}>Received From</Text>
            <View style={styles.clientRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <View>
                <Text style={styles.clientName}>{clientName}</Text>
                {receiptData.project?.name ? <Text style={styles.clientMeta}>{receiptData.project.name}</Text> : null}
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>Invoice</Text><Text style={styles.infoValue}>{receiptData.invoice_number || '—'}</Text></View>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>Payment date</Text><Text style={styles.infoValue}>{paymentDate ? new Date(paymentDate).toLocaleDateString() : '—'}</Text></View>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>Method</Text><Text style={styles.infoValue}>{paymentMethod}</Text></View>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>Currency</Text><Text style={styles.infoValue}>{receiptData.currency || 'GHS'}</Text></View>
            </View>

            <View style={styles.breakdownTable}>
              <Text style={{ marginBottom: 6, color: colors.slate, fontSize: 10 }}>Invoice Breakdown</Text>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>{'Subtotal'}</Text><Text style={styles.breakdownValue}>{formatCurrency(receiptData.subtotal_ghs)}</Text></View>
              {Number(receiptData.vat_amount_ghs || 0) > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>VAT (15%)</Text><Text style={styles.breakdownValue}>{formatCurrency(receiptData.vat_amount_ghs)}</Text></View>}
              {Number(receiptData.nhil_amount_ghs || 0) > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>NHIL (2.5%)</Text><Text style={styles.breakdownValue}>{formatCurrency(receiptData.nhil_amount_ghs)}</Text></View>}
              {Number(receiptData.getfund_amount_ghs || 0) > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>GetFUND (2.5%)</Text><Text style={styles.breakdownValue}>{formatCurrency(receiptData.getfund_amount_ghs)}</Text></View>}
              {Number(receiptData.retention_withheld || 0) > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Retention withheld</Text><Text style={styles.breakdownValue}>{formatCurrency(receiptData.retention_withheld)}</Text></View>}
              <View style={styles.divider} />
              <View style={styles.breakdownRow}><Text style={[styles.breakdownLabel, { fontWeight: 'bold' }]}>Gross total</Text><Text style={[styles.breakdownValue, { fontWeight: 'bold' }]}>{formatCurrency(receiptData.gross_total_ghs)}</Text></View>
            </View>

            {outstandingBalance <= 0 ? (
              <View style={[styles.outstandingBox, { backgroundColor: colors.dark }]}>
                <Text style={{ color: colors.white, fontSize: 11, fontWeight: 'bold' }}>FULLY PAID — No Outstanding Balance</Text>
              </View>
            ) : (
              <View style={[styles.outstandingBox, { backgroundColor: colors.dark }]}> 
                <Text style={{ fontSize: 9, textTransform: 'uppercase', color: colors.white }}>OUTSTANDING BALANCE</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.white, marginTop: 6 }}>{formatCurrency(outstandingBalance)}</Text>
                <Text style={{ fontSize: 9, color: colors.gold, marginTop: 6 }}>Payment is due. Please contact us to settle.</Text>
              </View>
            )}

            <View style={styles.footerHr} />
            <Text style={styles.generated}>{`Generated on: ${createdOn}`}</Text>
          </View>
        </View>
        <View style={styles.footerStrip}>
          <Text style={styles.footerText}>{COMPANY.email} · {COMPANY.phone}</Text>
        </View>
      </Page>
    </Document>
  )
}
