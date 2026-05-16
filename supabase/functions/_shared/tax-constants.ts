/**
 * ARCBUILD PRO — Tax Constants & Account Codes
 * 
 * Shared constants used by all Supabase Edge Functions for invoice processing,
 * tax computation, and journal entry generation.
 * 
 * Usage:
 *   import { TAX_RATES, ACCOUNT_CODES, DIVISION_REVENUE_ACCOUNT } from './_shared/tax-constants.ts'
 */

/**
 * TAX_RATES
 * Standard tax rates applied in Ghana.
 * - VAT: 15% on all taxable supplies (unless client exempt)
 * - NHIL: 2.5% National Health Insurance Levy
 * - GETFUND: 2.5% Ghana Education Trust Fund
 * - WHT: Withholding Tax rates by client type (individual 5%, corporate 7.5%, government 15%)
 */
export const TAX_RATES = {
  VAT: 0.15,
  NHIL: 0.025,
  GETFUND: 0.025,
  WHT: {
    individual: 0.05,
    corporate: 0.075,
    government: 0.15,
  },
} as const;

/**
 * ACCOUNT_CODES
 * Standard Chart of Accounts codes for invoice processing.
 * Used to post invoice line items, tax amounts, and journal entries.
 */
export const ACCOUNT_CODES = {
  // Assets
  ACCOUNTS_RECEIVABLE: '1110',
  WHT_RECEIVABLE: '1111',

  // Liabilities
  VAT_PAYABLE: '2102',
  NHIL_PAYABLE: '2103',
  GETFUND_PAYABLE: '2104',
  WHT_PAYABLE: '2107',

  // Revenue by Division (used as the credit side of invoice posting)
  REVENUE_CONSTRUCTION: '4100',
  REVENUE_ARCHITECTURE: '4200',
  REVENUE_REAL_ESTATE: '4300',
  REVENUE_LOGISTICS: '4400',
} as const;

/**
 * DIVISION_REVENUE_ACCOUNT
 * Maps division names to their corresponding revenue account codes.
 * Used when posting invoice line items to the general ledger.
 */
export const DIVISION_REVENUE_ACCOUNT: Record<string, string> = {
  'Construction': ACCOUNT_CODES.REVENUE_CONSTRUCTION,
  'Architecture': ACCOUNT_CODES.REVENUE_ARCHITECTURE,
  'Real Estate': ACCOUNT_CODES.REVENUE_REAL_ESTATE,
  'Logistics': ACCOUNT_CODES.REVENUE_LOGISTICS,
} as const;

/**
 * TAX_CONFIG
 * Runtime configuration for tax computation.
 * Includes default currency and approval thresholds.
 */
export const TAX_CONFIG = {
  DEFAULT_CURRENCY: 'GHS',
  FX_SOURCE: 'bank_of_ghana',
  
  // Invoice approval threshold (GHS) — fetch from system_config at runtime
  APPROVAL_THRESHOLD_GHS: 100000,
} as const;

/**
 * INVOICE_STATUS
 * Valid invoice statuses through the workflow lifecycle.
 */
export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT = 'sent',
  PAID = 'paid',
  REJECTED = 'rejected',
}

/**
 * CURRENCY
 * Supported currencies for invoicing.
 */
export enum Currency {
  GHS = 'GHS',
  USD = 'USD',
  GBP = 'GBP',
  EUR = 'EUR',
}

/**
 * CLIENT_TYPE
 * Classification of clients for tax purposes.
 */
export enum ClientType {
  INDIVIDUAL = 'individual',
  CORPORATE = 'corporate',
  GOVERNMENT = 'government',
}

/**
 * Utility: Get WHT rate by client type
 */
export function getWHTRate(clientType: ClientType): number {
  return TAX_RATES.WHT[clientType] ?? 0;
}

/**
 * Utility: Get revenue account code by division
 */
export function getRevenueAccountByDivision(division: string): string {
  return DIVISION_REVENUE_ACCOUNT[division] ?? ACCOUNT_CODES.REVENUE_CONSTRUCTION;
}
