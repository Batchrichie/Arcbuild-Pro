import React from 'react'
import ReactPDF, { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'

const LogoPath = path.resolve('./public/modulo-logo.png')
let logoDataUri = null
try {
  const img = fs.readFileSync(LogoPath)
  const b64 = img.toString('base64')
  const ext = path.extname(LogoPath).slice(1) || 'png'
  logoDataUri = `data:image/${ext};base64,${b64}`
  console.log('Logo embedded successfully')
} catch (e) {
  console.warn('Logo not found, proceeding without embedded logo', e.message)
}

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
  page: { backgroundColor: colors.lightBg, padding: 20, fontFamily: 'Helvetica' },
  headerRow: { backgroundColor: colors.dark, paddingTop: 20, paddingBottom: 14, paddingLeft: 20, paddingRight: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerContent: { flex: 1, alignItems: 'center' },
  logo: { width: 56, height: 56 },
  company: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: colors.gold, textAlign: 'center' },
  receiptTitle: { fontSize: 14, color: colors.white, textTransform: 'uppercase', marginTop: 6 },
  receiptMeta: { fontSize: 9, color: '#d1d5db', marginTop: 4 },
  amountBand: { backgroundColor: colors.gold, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 6, marginTop: 10 },
  amountLabel: { fontSize: 9, color: colors.dark, textTransform: 'uppercase', opacity: 0.9 },
  amountFigure: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: colors.dark },
  badge: { backgroundColor: colors.dark, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  badgeText: { color: colors.gold, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  card: { padding: 12, backgroundColor: colors.white, borderRadius: 10, marginTop: 12 },
  sectionLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: colors.slate, marginBottom: 6 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.gold, fontSize: 14, fontFamily: 'Helvetica-Bold' },
  clientName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: colors.dark },
  clientMeta: { fontSize: 10, color: colors.slate, marginTop: 2 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  infoCard: { backgroundColor: '#f3f4f6', padding: 10, borderRadius: 8, width: '48%' },
  infoLabel: { fontSize: 8, color: colors.slate, textTransform: 'uppercase' },
  infoValue: { fontSize: 11, color: colors.dark, fontFamily: 'Helvetica-Bold', marginTop: 6 },
  breakdownTable: { marginTop: 8, marginBottom: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { fontSize: 10, color: colors.slate },
  breakdownValue: { fontSize: 10, color: colors.dark, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.slate, marginVertical: 6 },
  outstandingBox: { padding: 12, borderRadius: 10, marginTop: 12, backgroundColor: colors.dark },
  footerStrip: { backgroundColor: '#f3f4f6', padding: 8, borderRadius: 6, marginTop: 12, textAlign: 'center' },
  footerText: { fontSize: 9, color: colors.slate, textAlign: 'center' }
})

const sampleData = {
  invoice_number: 'ARC-2026-0002',
  client: { name: 'Mr. Abedi Boadi', client_type: 'Individual', contact_person: 'Abedi', contact_phone: '(024) 6516534', contact_email: 'modulodevelopmentltd@yahoo.com' },
  project: { name: 'Dorka-King Apartment Mante' },
  currency: 'GHS',
  subtotal_ghs: 17110.05,
  vat_amount_ghs: 2566.51,
  nhil_amount_ghs: 427.75,
  getfund_amount_ghs: 427.75,
  retention_withheld: 1026.6,
  gross_total_ghs: 20532.06,
  expected_receipt_ghs: 4932.06,
}

const doc = React.createElement(Document, null,
  React.createElement(Page, { size: 'A4', style: styles.page },
    React.createElement(View, null,
      React.createElement(View, { style: styles.headerRow },
        logoDataUri ? React.createElement(Image, { src: logoDataUri, style: styles.logo }) : null,
        React.createElement(View, { style: styles.headerContent },
          React.createElement(Text, { style: styles.company }, 'MODULO DEVELOPMENT'),
          React.createElement(Text, { style: styles.receiptTitle }, 'PAYMENT RECEIPT'),
          React.createElement(Text, { style: styles.receiptMeta }, `RCPT-${sampleData.invoice_number}`),
          React.createElement(Text, { style: styles.receiptMeta }, formatDate(new Date()))
        )
      ),

      React.createElement(View, { style: styles.amountBand },
        React.createElement(View, null,
          React.createElement(Text, { style: styles.amountLabel }, 'Amount Received'),
          React.createElement(Text, { style: styles.amountFigure }, `GHS ${fmt(sampleData.expected_receipt_ghs)}`)
        ),
        React.createElement(View, { style: styles.badge },
          React.createElement(Text, { style: styles.badgeText }, 'PART PAYMENT')
        )
      ),

      React.createElement(View, { style: styles.card },
        React.createElement(Text, { style: styles.sectionLabel }, 'Received From'),
        React.createElement(View, { style: styles.clientRow },
          React.createElement(View, { style: styles.avatar }, React.createElement(Text, { style: styles.avatarText }, 'AB')),
          React.createElement(View, null,
            React.createElement(Text, { style: styles.clientName }, sampleData.client.name),
            React.createElement(Text, { style: styles.clientMeta }, sampleData.project.name)
          )
        ),

        React.createElement(View, { style: styles.infoGrid },
          React.createElement(View, { style: styles.infoCard }, React.createElement(Text, { style: styles.infoLabel }, 'Invoice'), React.createElement(Text, { style: styles.infoValue }, sampleData.invoice_number)),
          React.createElement(View, { style: styles.infoCard }, React.createElement(Text, { style: styles.infoLabel }, 'Payment date'), React.createElement(Text, { style: styles.infoValue }, new Date().toLocaleDateString())),
          React.createElement(View, { style: styles.infoCard }, React.createElement(Text, { style: styles.infoLabel }, 'Method'), React.createElement(Text, { style: styles.infoValue }, 'Bank Transfer')),
          React.createElement(View, { style: styles.infoCard }, React.createElement(Text, { style: styles.infoLabel }, 'Currency'), React.createElement(Text, { style: styles.infoValue }, sampleData.currency))
        ),

        React.createElement(View, { style: styles.breakdownTable },
          React.createElement(Text, { style: { marginBottom: 6, color: colors.slate, fontSize: 10 } }, 'Invoice Breakdown'),
          React.createElement(View, { style: styles.breakdownRow }, React.createElement(Text, { style: styles.breakdownLabel }, 'Subtotal'), React.createElement(Text, { style: styles.breakdownValue }, `GHS ${fmt(sampleData.subtotal_ghs)}`)),
          React.createElement(View, { style: styles.breakdownRow }, React.createElement(Text, { style: styles.breakdownLabel }, 'VAT (15%)'), React.createElement(Text, { style: styles.breakdownValue }, `GHS ${fmt(sampleData.vat_amount_ghs)}`)),
          React.createElement(View, { style: styles.breakdownRow }, React.createElement(Text, { style: styles.breakdownLabel }, 'NHIL (2.5%)'), React.createElement(Text, { style: styles.breakdownValue }, `GHS ${fmt(sampleData.nhil_amount_ghs)}`)),
          React.createElement(View, { style: styles.breakdownRow }, React.createElement(Text, { style: styles.breakdownLabel }, 'GetFUND (2.5%)'), React.createElement(Text, { style: styles.breakdownValue }, `GHS ${fmt(sampleData.getfund_amount_ghs)}`)),
          React.createElement(View, { style: styles.breakdownRow }, React.createElement(Text, { style: styles.breakdownLabel }, 'Retention withheld'), React.createElement(Text, { style: styles.breakdownValue }, `GHS ${fmt(sampleData.retention_withheld)}`)),
          React.createElement(View, { style: styles.divider }),
          React.createElement(View, { style: styles.breakdownRow }, React.createElement(Text, { style: { fontWeight: 'bold' } }, 'Gross total'), React.createElement(Text, { style: { fontWeight: 'bold' } }, `GHS ${fmt(sampleData.gross_total_ghs)}`))
        ),

        React.createElement(View, { style: styles.outstandingBox },
          React.createElement(Text, { style: { fontSize: 9, textTransform: 'uppercase', color: colors.white } }, 'OUTSTANDING BALANCE'),
          React.createElement(Text, { style: { fontSize: 18, fontWeight: 'bold', color: colors.white, marginTop: 6 } }, `GHS ${fmt(sampleData.gross_total_ghs - sampleData.expected_receipt_ghs)}`),
          React.createElement(Text, { style: { fontSize: 9, color: colors.gold, marginTop: 6 } }, 'Payment is due. Please contact us to settle.')
        ),

        React.createElement(View, { style: styles.divider }),
        React.createElement(Text, { style: styles.generated }, `Generated on: ${new Date().toLocaleString()}`)
      ),

      React.createElement(View, { style: styles.footerStrip }, React.createElement(Text, { style: styles.footerText }, 'modulodevelopmentltd@yahoo.com · (024) 6516534'))
    )
  )
)

const outPath = path.resolve('./sample-receipt.pdf')

ReactPDF.render(doc, outPath)
  .then(() => console.log('Sample receipt generated at', outPath))
  .catch((err) => { console.error('PDF generation failed', err); process.exit(1) })
