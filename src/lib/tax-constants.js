/** Client-safe re-export of invoice tax constants (mirrors supabase/functions/_shared/tax-constants.ts) */

export const TAX_RATES = {
  VAT: 0.15,
  NHIL: 0.025,
  GETFUND: 0.025,
  WHT: {
    individual: 0.05,
    corporate: 0.075,
    government: 0.15,
  },
}

export const Currency = {
  GHS: 'GHS',
  USD: 'USD',
  GBP: 'GBP',
  EUR: 'EUR',
}
