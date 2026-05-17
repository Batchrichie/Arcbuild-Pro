export function invoiceOverdueTemplate(data: {
  clientName: string
  invoiceNumber: string
  amount: string
  daysOverdue: number
  dueDate: string
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #F59E0B; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">ARCBUILD PRO — Invoice Overdue</h1>
      </div>
      <div style="padding: 24px; background: #1A1D27; color: #F9FAFB;">
        <p>Invoice <strong>${data.invoiceNumber}</strong> for <strong>${data.clientName}</strong> is <strong>${data.daysOverdue} days overdue</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #9CA3AF;">Amount Outstanding</td><td style="padding: 8px; font-weight: bold;">GHS ${data.amount}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Due Date</td><td style="padding: 8px;">${data.dueDate}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Days Overdue</td><td style="padding: 8px; color: #EF4444; font-weight: bold;">${data.daysOverdue} days</td></tr>
        </table>
        <p style="color: #9CA3AF; font-size: 14px;">Log in to ARCBUILD PRO to take action.</p>
      </div>
    </div>
  `
}

export function budgetOverrunTemplate(data: {
  projectName: string
  costCategory: string
  budgetAmount: string
  actualAmount: string
  variancePct: string
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #EF4444; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">ARCBUILD PRO — Budget Overrun Alert</h1>
      </div>
      <div style="padding: 24px; background: #1A1D27; color: #F9FAFB;">
        <p>Project <strong>${data.projectName}</strong> has exceeded its <strong>${data.costCategory}</strong> budget.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #9CA3AF;">Budget</td><td style="padding: 8px;">GHS ${data.budgetAmount}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Actual</td><td style="padding: 8px; color: #EF4444; font-weight: bold;">GHS ${data.actualAmount}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Overrun</td><td style="padding: 8px; color: #EF4444; font-weight: bold;">${data.variancePct}% over budget</td></tr>
        </table>
      </div>
    </div>
  `
}

export function taxDeadlineTemplate(data: {
  taxType: string
  period: string
  dueDate: string
  daysUntilDue: number
  estimatedAmount: string
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #F59E0B; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">ARCBUILD PRO — Tax Deadline Reminder</h1>
      </div>
      <div style="padding: 24px; background: #1A1D27; color: #F9FAFB;">
        <p><strong>${data.taxType}</strong> return for <strong>${data.period}</strong> is due in <strong>${data.daysUntilDue} days</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #9CA3AF;">Tax Type</td><td style="padding: 8px;">${data.taxType}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Period</td><td style="padding: 8px;">${data.period}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Due Date</td><td style="padding: 8px; font-weight: bold;">${data.dueDate}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Estimated Amount</td><td style="padding: 8px;">GHS ${data.estimatedAmount}</td></tr>
        </table>
      </div>
    </div>
  `
}

export function contractExpiryTemplate(data: {
  employeeName: string
  jobTitle: string
  expiryDate: string
  daysUntilExpiry: number
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #F59E0B; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">ARCBUILD PRO — Contract Expiry Notice</h1>
      </div>
      <div style="padding: 24px; background: #1A1D27; color: #F9FAFB;">
        <p>Employee <strong>${data.employeeName}</strong> (${data.jobTitle}) has a contract expiring in <strong>${data.daysUntilExpiry} days</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #9CA3AF;">Employee</td><td style="padding: 8px;">${data.employeeName}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Job Title</td><td style="padding: 8px;">${data.jobTitle}</td></tr>
          <tr><td style="padding: 8px; color: #9CA3AF;">Contract End</td><td style="padding: 8px; font-weight: bold;">${data.expiryDate}</td></tr>
        </table>
      </div>
    </div>
  `
}
