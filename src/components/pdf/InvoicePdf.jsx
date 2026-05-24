import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { COMPANY } from '../../lib/company-config'
import {
  formatPdfDate,
  formatPdfMoney,
  getInvoiceDocumentTitle,
  getServiceLine,
  normalizePdfLineItems,
} from '../../lib/invoice-pdf-utils'
import { numberToWords } from '../../utils/numberToWords'
import logo from '../../assets/ModuloDevLogo.png'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0f172a',
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 36,
    backgroundColor: '#ffffff',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  companyBlock: { flex: 1.2, paddingRight: 12 },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  companyLine: { fontSize: 8, color: '#475569', marginBottom: 2 },
  metaBlock: { flex: 1, alignItems: 'flex-end' },
  metaTable: { width: '100%' },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
  metaLabel: { width: 72, fontSize: 8, color: '#64748b', textAlign: 'right', paddingRight: 6 },
  metaValue: { width: 110, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'right' },
  invoiceBanner: {
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#0b1730',
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLogo: { width: 36, height: 36, marginRight: 10 },
  bannerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#f4bf4d', letterSpacing: 1 },
  bannerSub: { fontSize: 8, color: '#e2e8f0', marginTop: 2 },
  infoRow: { flexDirection: 'row', marginBottom: 10, gap: 12 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 7, color: '#64748b', marginBottom: 2, textTransform: 'uppercase' },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  table: { marginTop: 6, marginBottom: 12 },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f4bf4d',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  thDesc: { flex: 3, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827' },
  thQty: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827', textAlign: 'center' },
  thAmt: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827', textAlign: 'right' },
  sectionRow: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a', letterSpacing: 0.5 },
  lineRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tdDesc: { flex: 3, fontSize: 8, color: '#0f172a' },
  tdQty: { flex: 1, fontSize: 8, color: '#0f172a', textAlign: 'center' },
  tdAmt: { flex: 1, fontSize: 8, color: '#0f172a', textAlign: 'right' },
  totalsWrap: { marginTop: 8, alignItems: 'flex-end' },
  totalsBox: { width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontSize: 8, color: '#475569' },
  totalValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
  },
  grandLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  grandValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  wordsBlock: { marginTop: 10, marginBottom: 12 },
  wordsLabel: { fontSize: 7, color: '#64748b', marginBottom: 2 },
  wordsValue: { fontSize: 8, fontStyle: 'italic', color: '#0f172a' },
  footerBlock: { marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  footerTagline: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'center', marginBottom: 4 },
  footerThanks: { fontSize: 8, color: '#475569', textAlign: 'center', marginBottom: 2 },
  footerFx: { fontSize: 7, color: '#64748b', textAlign: 'center', marginTop: 6 },
  footerLegal: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
})

function MetaPair({ label, value }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

function TotalLine({ label, value, bold }) {
  return (
    <View style={styles.totalRow}>
      <Text style={bold ? styles.grandLabel : styles.totalLabel}>{label}</Text>
      <Text style={bold ? styles.grandValue : styles.totalValue}>{value}</Text>
    </View>
  )
}

export default function InvoicePdf({ invoice = {}, lineItems = [], client = {}, project = {}, division = {} }) {
  const currency = invoice.currency || 'GHS'
  const divisionName = division?.name || ''
  const projectName = project?.name || ''
  const clientName = client?.name || 'Client'
  const location = client?.region || client?.country || 'GREATER ACCRA'

  const documentTitle = getInvoiceDocumentTitle(divisionName, projectName, invoice.notes)
  const serviceLine = getServiceLine(divisionName, projectName, invoice.notes)
  const rows = normalizePdfLineItems(lineItems)

  const subtotal = Number(invoice.subtotal ?? 0)
  const nhil = Number(invoice.nhil_amount ?? 0)
  const getfund = Number(invoice.getfund_amount ?? 0)
  const taxableAmount = subtotal + nhil + getfund
  const vat = Number(invoice.vat_amount ?? 0)
  const grossTotal = Number(invoice.gross_total ?? 0)
  const wht = Number(invoice.wht_amount ?? 0)
  const expectedReceipt = Number(invoice.expected_receipt ?? grossTotal - wht)

  const fmt = (n) => formatPdfMoney(n, currency)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{COMPANY.name.toUpperCase()}</Text>
            <Text style={styles.companyLine}>{COMPANY.address}</Text>
            <Text style={styles.companyLine}>{COMPANY.city}</Text>
            <Text style={styles.companyLine}>Phone: {COMPANY.phone}</Text>
            <Text style={styles.companyLine}>Email: {COMPANY.email}</Text>
          </View>
          <View style={styles.metaBlock}>
            <View style={styles.metaTable}>
              <MetaPair label="Date" value={formatPdfDate(invoice.created_at)} />
              <MetaPair label="Due Date" value={formatPdfDate(invoice.due_date)} />
              <MetaPair label="Invoice #" value={invoice.invoice_number || invoice.id} />
              <MetaPair label="Location" value={location} />
            </View>
          </View>
        </View>

        <View style={styles.invoiceBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Image src={logo} style={styles.bannerLogo} />
            <View>
              <Text style={styles.bannerTitle}>{documentTitle}</Text>
              <Text style={styles.bannerSub}>{COMPANY.shortName}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>For</Text>
            <Text style={styles.infoValue}>{serviceLine}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Bill to</Text>
            <Text style={styles.infoValue}>{clientName}</Text>
            {client.address ? <Text style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{client.address}</Text> : null}
            {client.tin ? <Text style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>TIN: {client.tin}</Text> : null}
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Project</Text>
            <Text style={styles.infoValue}>{projectName || '—'}</Text>
            {divisionName ? (
              <Text style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>Division: {divisionName}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={styles.thDesc}>DESCRIPTION</Text>
            <Text style={styles.thQty}>UNIT QTY / DAYS</Text>
            <Text style={styles.thAmt}>AMOUNT</Text>
          </View>
          {rows.length ? (
            rows.map((row) =>
              row.type === 'section' ? (
                <View key={row.key} style={styles.sectionRow}>
                  <Text style={styles.sectionText}>{row.title}:</Text>
                </View>
              ) : (
                <View key={row.key} style={styles.lineRow}>
                  <Text style={styles.tdDesc}>{row.description}</Text>
                  <Text style={styles.tdQty}>{row.quantity}</Text>
                  <Text style={styles.tdAmt}>{fmt(row.lineTotal)}</Text>
                </View>
              )
            )
          ) : (
            <View style={styles.lineRow}>
              <Text style={styles.tdDesc}>No line items</Text>
            </View>
          )}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <TotalLine label="SUB-TOTAL" value={fmt(subtotal)} />
            {(nhil > 0 || getfund > 0) && (
              <TotalLine label="NHIL & GETFUND" value={fmt(nhil + getfund)} />
            )}
            <TotalLine label="TAXABLE AMOUNT" value={fmt(taxableAmount)} />
            <TotalLine label="VAT 15%" value={fmt(vat)} />
            {wht > 0 && <TotalLine label="WHT DEDUCTION" value={fmt(wht)} />}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>GRAND TOTAL</Text>
              <Text style={styles.grandValue}>{fmt(grossTotal)}</Text>
            </View>
            {expectedReceipt !== grossTotal && (
              <TotalLine label="EXPECTED RECEIPT" value={fmt(expectedReceipt)} />
            )}
          </View>
        </View>

        <View style={styles.wordsBlock}>
          <Text style={styles.wordsLabel}>Amount in words</Text>
          <Text style={styles.wordsValue}>{numberToWords(grossTotal, currency)}</Text>
        </View>

        <View style={styles.footerBlock}>
          <Text style={styles.footerTagline}>{COMPANY.tagline.toUpperCase()}</Text>
          <Text style={styles.footerThanks}>THANK YOU FOR ENTRUSTING TO US YOUR DREAMS</Text>
          <Text style={styles.footerThanks}>WE WILL HELP MAKE IT A REALITY</Text>
          {currency !== 'GHS' && (
            <Text style={styles.footerFx}>
              Exchange rate information: Payments are preferably made in {currency}. If settled in Ghana Cedis
              (GHS), the reference exchange rate is {currency} 1 = GHS {Number(invoice.fx_rate_to_ghs || 1).toFixed(2)}.
            </Text>
          )}
        </View>

        <Text style={styles.footerLegal}>
          This is a computer-generated invoice — {COMPANY.name} | {documentTitle}
        </Text>
      </Page>
    </Document>
  )
}
