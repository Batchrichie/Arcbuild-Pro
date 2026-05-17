import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, colors } from './PdfTheme'

function formatCurrency(value) {
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

export default function PayslipPdf({ line, employee, run }) {
  const employeeName = employee.full_name || employee.name || employee.profile_id || 'Employee'
  const jobTitle = employee.job_title || employee.position || 'N/A'
  const department = employee.department || 'N/A'

  const basic = Number(line.basic_salary || 0)
  const allowances = Number(line.allowances || 0)
  const overtime = Number(line.overtime_amount || 0)
  const bonus = Number(line.bonus_amount || 0)
  const grossPay = Number(line.gross_pay || 0)
  const ssnit = Number(line.ssnit_employee || 0)
  const paye = Number(line.paye || 0)
  const loan = Number(line.loan_deduction || 0)
  const other = Number(line.other_deductions || 0)
  const totalDeductions = ssnit + paye + loan + other
  const netPay = Number(line.net_pay || 0)

  return (
    <Document>
      <Page style={pdfStyles.page}>
        <View style={pdfStyles.headerBar}>
          <Text style={pdfStyles.companyName}>ARCBUILD PRO</Text>
          <Text style={pdfStyles.companyTagline}>PAYSLIP — CONFIDENTIAL</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Employee Details</Text>
          <Text style={pdfStyles.label}>Name</Text>
          <Text style={pdfStyles.value}>{employeeName}</Text>
          <Text style={pdfStyles.label}>Employee Number</Text>
          <Text style={pdfStyles.value}>{employee.employee_number || 'N/A'}</Text>
          <Text style={pdfStyles.label}>Job Title</Text>
          <Text style={pdfStyles.value}>{jobTitle}</Text>
          <Text style={pdfStyles.label}>Department</Text>
          <Text style={pdfStyles.value}>{department}</Text>
          <Text style={pdfStyles.label}>Pay Period</Text>
          <Text style={pdfStyles.value}>{`${formatDate(run.period_start)} — ${formatDate(run.period_end)}`}</Text>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Earnings</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableHeaderCell}>Description</Text>
              <Text style={pdfStyles.tableHeaderCell}>Amount</Text>
            </View>
            <View style={pdfStyles.tableRow}>
              <Text style={pdfStyles.tableCell}>Basic Salary</Text>
              <Text style={pdfStyles.amountCell}>{formatCurrency(basic)}</Text>
            </View>
            {allowances > 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>Allowances</Text>
                <Text style={pdfStyles.amountCell}>{formatCurrency(allowances)}</Text>
              </View>
            )}
            {overtime > 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>Overtime</Text>
                <Text style={pdfStyles.amountCell}>{formatCurrency(overtime)}</Text>
              </View>
            )}
            {bonus > 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>Bonus</Text>
                <Text style={pdfStyles.amountCell}>{formatCurrency(bonus)}</Text>
              </View>
            )}
            <View style={pdfStyles.totalRow}>
              <Text style={pdfStyles.tableCell}>Gross Pay</Text>
              <Text style={pdfStyles.amountCell}>{formatCurrency(grossPay)}</Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.sectionRow}>
          <Text style={pdfStyles.sectionTitle}>Deductions</Text>
          <View style={pdfStyles.table}>
            {ssnit > 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>SSNIT Employee (5.5%)</Text>
                <Text style={pdfStyles.amountCell}>{formatCurrency(ssnit)}</Text>
              </View>
            )}
            {paye > 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>PAYE</Text>
                <Text style={pdfStyles.amountCell}>{formatCurrency(paye)}</Text>
              </View>
            )}
            {loan > 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>Loan Repayment</Text>
                <Text style={pdfStyles.amountCell}>{formatCurrency(loan)}</Text>
              </View>
            )}
            {other > 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>Other Deductions</Text>
                <Text style={pdfStyles.amountCell}>{formatCurrency(other)}</Text>
              </View>
            )}
            <View style={pdfStyles.totalRow}>
              <Text style={pdfStyles.tableCell}>Total Deductions</Text>
              <Text style={pdfStyles.amountCell}>{formatCurrency(totalDeductions)}</Text>
            </View>
          </View>
        </View>

        <View style={[pdfStyles.sectionRow, { backgroundColor: colors.surface, padding: 12, borderRadius: 4, marginBottom: 16 }]}> 
          <Text style={[pdfStyles.sectionTitle, { marginBottom: 4 }]}>Net Pay</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.amber }}>{formatCurrency(netPay)}</Text>
        </View>

        <Text style={pdfStyles.footer}>This is a computer-generated payslip. ARCBUILD PRO.</Text>
      </Page>
    </Document>
  )
}
