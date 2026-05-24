/**
 * Invoice / receipt PDF helpers (Modulo Development layout).
 * Section rows in line items: prefix description with "## " e.g. "## RECEPTION"
 */

export function slugifyFilenamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

/** Invoice document title shown on PDF and used in download filename. */
export function getInvoiceDocumentTitle(divisionName = '', projectName = '', notes = '') {
  const combined = `${divisionName} ${projectName} ${notes}`.toLowerCase()

  if (/website|web\s*design|digital\s*design|ux\/ui|ui\/ux/.test(combined)) {
    return 'WEBSITE DESIGN INVOICE'
  }

  const division = String(divisionName || '').toLowerCase()
  if (division.includes('construction')) return 'CONSTRUCTION INVOICE'
  if (division.includes('architecture')) return 'DESIGN INVOICE'
  if (division.includes('real estate')) return 'REAL ESTATE INVOICE'
  if (division.includes('logistics')) return 'LOGISTICS INVOICE'

  return 'INVOICE'
}

export function getServiceLine(divisionName = '', projectName = '', notes = '') {
  const combined = `${divisionName} ${projectName} ${notes}`.toLowerCase()
  if (/website|web\s*design|digital/.test(combined)) return 'Website & Digital Design Services'
  if (String(divisionName).toLowerCase().includes('construction')) return 'Construction Services'
  if (String(divisionName).toLowerCase().includes('architecture')) return 'Project Consultancy'
  if (String(divisionName).toLowerCase().includes('real estate')) return 'Real Estate Services'
  if (String(divisionName).toLowerCase().includes('logistics')) return 'Logistics Services'
  return 'Professional Services'
}

export function buildInvoicePdfFilename({
  clientName,
  projectName,
  divisionName,
  invoiceNumber,
  notes,
}) {
  const docTitle = getInvoiceDocumentTitle(divisionName, projectName, notes)
  const client = slugifyFilenamePart(clientName) || 'CLIENT'
  const project = slugifyFilenamePart(projectName) || 'GENERAL'
  const base = `${client} ${project} - (${docTitle})`
  return `${base}.pdf`.replace(/\s+/g, ' ')
}

export function buildReceiptPdfFilename({ clientName, invoiceNumber }) {
  const client = slugifyFilenamePart(clientName) || 'CLIENT'
  const inv = String(invoiceNumber || 'RECEIPT').replace(/\s+/g, '-')
  return `${client} - PAYMENT RECEIPT ${inv}.pdf`.replace(/\s+/g, ' ')
}

/** Split line items into renderable rows (section headers vs billable lines). */
export function normalizePdfLineItems(lineItems = []) {
  return lineItems.map((item, index) => {
    const description = String(item.description || '').trim()
    const quantity = Number(item.quantity ?? 0)
    const unitPrice = Number(item.unit_price ?? 0)

    if (/^##\s+/.test(description)) {
      return {
        key: `section-${index}`,
        type: 'section',
        title: description.replace(/^##\s+/, '').trim().toUpperCase(),
      }
    }

    if (quantity === 0 && unitPrice === 0 && /:$/.test(description)) {
      return {
        key: `section-${index}`,
        type: 'section',
        title: description.replace(/:$/, '').trim().toUpperCase(),
      }
    }

    return {
      key: `line-${index}`,
      type: 'line',
      description,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    }
  })
}

export function formatPdfMoney(amount, currency = 'GHS') {
  const value = Number(amount || 0)
  const code = currency === 'GHS' ? 'GHS' : currency
  const prefix = code === 'GHS' ? 'GHS ' : `${code} `
  return `${prefix}${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPdfDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
