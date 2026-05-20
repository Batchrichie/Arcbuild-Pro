import * as XLSX from 'xlsx'

export function exportToExcel(rows, columns, filename) {
  // columns is an array of { header: 'Display Name', key: 'field_key' }
  const worksheetData = [
    columns.map(c => c.header),
    ...rows.map(row => columns.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return '—'
      return val
    }))
  ]

  const worksheet  = XLSX.utils.aoa_to_sheet(worksheetData)
  const workbook   = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  XLSX.writeFile(workbook, filename)
}
