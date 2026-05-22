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

export default function InvoicePdf({ invoice, lineItems = [], client = {} }) {
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)
  const discountRate = Number(invoice?.discount_rate ?? invoice?.discount_percent ?? 0)
  const discountAmount = Number(invoice?.discount_amount ?? (subtotal * discountRate) / 100)
  const subtotalAfterDiscount = subtotal - discountAmount
  const nhil = subtotalAfterDiscount * 0.025
  const getfund = subtotalAfterDiscount * 0.025
  const taxableAmount = subtotalAfterDiscount + nhil + getfund
  const vat = taxableAmount * 0.15
  const grossTotal = subtotalAfterDiscount + nhil + getfund + vat
  const whtDeduction = Number(invoice?.expected_receipt_ghs) ? Math.max(0, grossTotal - Number(invoice.expected_receipt_ghs)) : 0
  const expectedReceipt = Number(invoice?.expected_receipt_ghs) || grossTotal - whtDeduction

  return (
    <Document>
      <Page style={pdfStyles.page}>
        <View style={pdfStyles.headerBar}>
          <View style={pdfStyles.headerTop}>
            <Image src={logo} style={pdfStyles.logoImage} />
            <View style={pdfStyles.headerTextGroup}>
              <Text style={pdfStyles.companyName}>{COMPANY.name}</Text>
              <Text style={pdfStyles.companyTagline}>INVOICE</Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Invoice</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={pdfStyles.label}>Invoice #</Text>
              <Text style={pdfStyles.value}>{invoice.invoice_number || invoice.id}</Text>
            </View>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={pdfStyles.label}>Issue Date</Text>
              <Text style={pdfStyles.value}>{formatDate(invoice.created_at)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pdfStyles.label}>Due Date</Text>
              <Text style={pdfStyles.value}>{formatDate(invoice.due_date)}</Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Bill To</Text>
          <Text style={pdfStyles.label}>Name</Text>
          <Text style={pdfStyles.value}>{client.name || 'Client Name'}</Text>
          <Text style={pdfStyles.label}>Address</Text>
          <Text style={pdfStyles.value}>{client.address || 'No address on file'}</Text>
          <Text style={pdfStyles.label}>TIN</Text>
          <Text style={pdfStyles.value}>{client.tin || 'N/A'}</Text>
          <Text style={pdfStyles.label}>Email</Text>
          <Text style={pdfStyles.value}>{client.email || 'N/A'}</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>From</Text>
          <Text style={pdfStyles.label}>{COMPANY.name}</Text>
          <Text style={pdfStyles.value}>{COMPANY.address}</Text>
          <Text style={pdfStyles.value}>{COMPANY.city}</Text>
          <Text style={pdfStyles.value}>Email: {COMPANY.email}</Text>
          <Text style={pdfStyles.value}>Phone: {COMPANY.phone}</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Line Items</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableHeaderCell}>Description</Text>
              <Text style={pdfStyles.tableHeaderCell}>Quantity</Text>
              <Text style={pdfStyles.tableHeaderCell}>Unit Price</Text>
              <Text style={pdfStyles.tableHeaderCell}>Line Total</Text>
            </View>
            {lineItems.length ? (
              lineItems.map((item, index) => (
                <View style={pdfStyles.tableRow} key={`${item.description}-${index}`}>
                  <Text style={pdfStyles.tableCell}>{item.description || 'Item'}</Text>
                  <Text style={pdfStyles.tableCell}>{item.quantity ?? 0}</Text>
                  <Text style={pdfStyles.tableCell}>{formatGhs(item.unit_price)}</Text>
                  <Text style={pdfStyles.amountCell}>{formatGhs((item.quantity || 0) * (item.unit_price || 0))}</Text>
                </View>
              ))
            ) : (
              <View style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>No invoice items available</Text>
              </View>
            )}
          </View>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Tax Breakdown</Text>
          <View style={pdfStyles.table}>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}> 
              <Text style={pdfStyles.tableCell}>Subtotal</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(subtotal)}</Text>
            </View>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}>
              <Text style={pdfStyles.tableCell}>Discount</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(discountAmount)}</Text>
            </View>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}> 
              <Text style={pdfStyles.tableCell}>Subtotal after discount</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(subtotalAfterDiscount)}</Text>
            </View>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}> 
              <Text style={pdfStyles.tableCell}>NHIL (2.5%)</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(nhil)}</Text>
            </View>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}> 
              <Text style={pdfStyles.tableCell}>GetFUND (2.5%)</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(getfund)}</Text>
            </View>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}> 
              <Text style={pdfStyles.tableCell}>Taxable Amount</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(taxableAmount)}</Text>
            </View>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}> 
              <Text style={pdfStyles.tableCell}>VAT (15%)</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(vat)}</Text>
            </View>
            <View style={pdfStyles.totalRow}>
              <Text style={pdfStyles.tableCell}>Gross Total</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(grossTotal)}</Text>
            </View>
            <View style={pdfStyles.tableRow}>
              <Text style={pdfStyles.tableCell}>WHT Deduction</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(whtDeduction)}</Text>
            </View>
            <View style={pdfStyles.totalRow}>
              <Text style={pdfStyles.tableCell}>Expected Receipt</Text>
              <Text style={pdfStyles.amountCell}>{formatGhs(expectedReceipt)}</Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Payment Terms</Text>
          <Text style={pdfStyles.value}>Payment is due within 30 days of the invoice date. Please remit payment to the account below.</Text>
          <Text style={pdfStyles.value}>Bank: Ghana Commercial Bank</Text>
          <Text style={pdfStyles.value}>Account Name: {COMPANY.shortName}</Text>
          <Text style={pdfStyles.value}>Account Number: 1234567890</Text>
          <Text style={pdfStyles.value}>Branch: Accra Main Branch</Text>
        </View>

        <Text style={pdfStyles.footer}>This is a computer-generated invoice — {COMPANY.name}</Text>
      </Page>
    </Document>
  )
}
