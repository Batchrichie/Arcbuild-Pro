-- =============================================================================
-- Migration 038: ICAG/IFRS Account Classification System
-- ARCBUILD PRO — Chart of Accounts structured classification
--
-- Purpose:
--   Adds four IFRS-aligned classification columns to chart_of_accounts plus
--   two operational flag columns. No existing data is modified except the
--   backfill UPDATE statements below.
--
-- Classification hierarchy (ICAG/IFRS aligned):
--   financial_statement → element → sub_element → nature
--
-- financial_statement values:
--   'Balance Sheet'      — assets, liabilities, equity
--   'Income Statement'   — revenue, expenses, tax
--   'Memo'               — header/grouping rows that do not post to any statement
--
-- element values (IFRS Framework Chapter 4):
--   'Asset'              — IAS 1.54 — resources controlled by the entity
--   'Liability'          — IAS 1.54 — present obligations of the entity
--   'Equity'             — IAS 1.54 — residual interest in net assets
--   'Revenue'            — IFRS 15  — income from ordinary activities
--   'Expense'            — IAS 1    — decreases in economic benefits
--
-- sub_element values (ICAG Ghana classification):
--   Assets:     'Current Asset', 'Non-Current Asset'
--   Liabilities:'Current Liability', 'Non-Current Liability'
--   Equity:     'Contributed Capital', 'Retained Earnings',
--               'Other Comprehensive Income'
--   Revenue:    'Operating Revenue', 'Other Income'
--   Expense:    'Cost of Sales', 'Operating Expense',
--               'Finance Cost', 'Tax Expense', 'Other Expense'
--
-- nature values:
--   The most granular ICAG classification. Used by financial statement
--   views to group line items correctly on published statements.
--
-- is_contra:
--   TRUE for accounts whose normal balance reduces a related account.
--
-- is_payment_account:
--   TRUE only for accounts that represent actual cash/bank/mobile money
--   balances into which customer payments can be received.
--
-- payment_method_type:
--   Groups payment accounts for the UI dropdown.
--
-- References:
--   ICAG Ghana — Financial Accounting Study Manual (2023 Edition)
--   IAS 1       — Presentation of Financial Statements
--   IFRS 15     — Revenue from Contracts with Customers
--   IAS 16      — Property, Plant and Equipment
--   IAS 12      — Income Taxes
--   IAS 21      — Effects of Changes in Foreign Exchange Rates
-- =============================================================================

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS financial_statement  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS element              TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sub_element          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nature               TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_contra            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_payment_account   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_method_type  TEXT DEFAULT NULL
    CHECK (payment_method_type IN ('Cash', 'Bank', 'Mobile Money'));

CREATE INDEX IF NOT EXISTS idx_coa_payment_account
  ON chart_of_accounts (is_payment_account, is_active)
  WHERE is_payment_account = TRUE;

CREATE INDEX IF NOT EXISTS idx_coa_financial_statement
  ON chart_of_accounts (financial_statement, element, sub_element);

-- BACKFILL: Classify every existing account
-- All four levels applied to every row.
-- Accounts that are header/grouping rows use financial_statement = 'Memo'
-- because they never receive journal postings directly.

UPDATE chart_of_accounts SET
  financial_statement = 'Memo', element = 'Asset',
  sub_element = NULL, nature = 'Header'
WHERE account_code IN ('1000', '1100', '1200');

UPDATE chart_of_accounts SET
  financial_statement = 'Memo', element = 'Liability',
  sub_element = NULL, nature = 'Header'
WHERE account_code IN ('2000', '2100', '2200');

UPDATE chart_of_accounts SET
  financial_statement = 'Memo', element = 'Equity',
  sub_element = NULL, nature = 'Header'
WHERE account_code = '3000';

UPDATE chart_of_accounts SET
  financial_statement = 'Memo', element = 'Revenue',
  sub_element = NULL, nature = 'Header'
WHERE account_code IN ('4000', '4100', '4200', '4300', '4400', '4500');

UPDATE chart_of_accounts SET
  financial_statement = 'Memo', element = 'Expense',
  sub_element = NULL, nature = 'Header'
WHERE account_code IN ('5000', '5100', '5200', '5300', '5400',
                       '6000', '6100', '6200', '6300', '6400',
                       '6500', '6600', '6700', '7000');

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Current Asset',
  nature              = 'Cash and Cash Equivalents',
  is_payment_account  = TRUE,
  payment_method_type = 'Cash'
WHERE account_code IN ('1101', '1102', '1103', '1104');

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Current Asset',
  nature              = 'Cash and Cash Equivalents',
  is_payment_account  = TRUE,
  payment_method_type = 'Mobile Money'
WHERE account_code = '1401';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Current Asset',
  nature              = 'Trade Receivables'
WHERE account_code = '1110';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Current Asset',
  nature              = 'Tax Receivables'
WHERE account_code IN ('1111', '1112');

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Current Asset',
  nature              = 'Prepayments'
WHERE account_code = '1120';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Current Asset',
  nature              = 'Other Receivables'
WHERE account_code = '1130';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Current Asset',
  nature              = 'Inventories'
WHERE account_code = '1140';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Current Asset',
  nature              = 'Contract Assets'
WHERE account_code IN ('1300', '1400');

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Non-Current Asset',
  nature              = 'Property Plant and Equipment',
  is_contra           = FALSE
WHERE account_code = '1210';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Non-Current Asset',
  nature              = 'Property Plant and Equipment',
  is_contra           = TRUE
WHERE account_code = '1211';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Non-Current Asset',
  nature              = 'Intangible Assets'
WHERE account_code = '1220';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Asset',
  sub_element         = 'Non-Current Asset',
  nature              = 'Other Non-Current Assets'
WHERE account_code = '1230';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Liability',
  sub_element         = 'Current Liability',
  nature              = 'Trade Payables'
WHERE account_code = '2101';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Liability',
  sub_element         = 'Current Liability',
  nature              = 'Tax Payables'
WHERE account_code IN ('2102', '2103', '2104', '2105', '2106', '2107', '2120');

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Liability',
  sub_element         = 'Current Liability',
  nature              = 'Accrued Liabilities'
WHERE account_code = '2108';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Liability',
  sub_element         = 'Current Liability',
  nature              = 'Contract Liabilities'
WHERE account_code IN ('2109', '2110', '2300');

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Liability',
  sub_element         = 'Non-Current Liability',
  nature              = 'Borrowings'
WHERE account_code = '2201';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Liability',
  sub_element         = 'Non-Current Liability',
  nature              = 'Deferred Tax'
WHERE account_code = '2202';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Equity',
  sub_element         = 'Contributed Capital',
  nature              = 'Share Capital'
WHERE account_code = '3100';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Equity',
  sub_element         = 'Retained Earnings',
  nature              = 'Retained Earnings'
WHERE account_code = '3200';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Equity',
  sub_element         = 'Retained Earnings',
  nature              = 'Current Year Earnings'
WHERE account_code = '3300';

UPDATE chart_of_accounts SET
  financial_statement = 'Balance Sheet',
  element             = 'Equity',
  sub_element         = 'Other Comprehensive Income',
  nature              = 'Translation Reserve'
WHERE account_code = '3400';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Operating Revenue',
  nature              = 'Contract Revenue'
WHERE account_code IN ('4100', '4101', '4102', '4600');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Operating Revenue',
  nature              = 'Service Revenue'
WHERE account_code IN ('4200', '4201', '4202');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Operating Revenue',
  nature              = 'Property Revenue'
WHERE account_code IN ('4300', '4301');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Operating Revenue',
  nature              = 'Rental Revenue'
WHERE account_code = '4302';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Operating Revenue',
  nature              = 'Service Revenue'
WHERE account_code IN ('4400', '4401', '4402');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Other Income',
  nature              = 'Other Income'
WHERE account_code = '4500';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Other Income',
  nature              = 'Foreign Exchange Gains'
WHERE account_code = '4501';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Other Income',
  nature              = 'Finance Income'
WHERE account_code = '4502';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Revenue',
  sub_element         = 'Other Income',
  nature              = 'Gains on Disposal'
WHERE account_code = '4503';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Direct Costs'
WHERE account_code IN ('5100', '5200', '5300', '5400');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Materials Cost'
WHERE account_code = '5101';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Subcontractor Cost'
WHERE account_code = '5102';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Labour Cost'
WHERE account_code = '5103';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Equipment Cost'
WHERE account_code = '5104';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Professional Fees'
WHERE account_code = '5201';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Land and Property Cost'
WHERE account_code = '5301';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Development Cost'
WHERE account_code = '5302';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Cost of Sales',
  nature              = 'Vehicle Operating Cost'
WHERE account_code IN ('5401', '5402');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Operating Expense',
  nature              = 'Employee Benefits'
WHERE account_code IN ('6100', '6101', '6102', '6103');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Operating Expense',
  nature              = 'Occupancy Costs'
WHERE account_code IN ('6201', '6202');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Operating Expense',
  nature              = 'Administrative Expenses'
WHERE account_code IN ('6200', '6203', '6204');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Finance Cost',
  nature              = 'Finance Costs'
WHERE account_code IN ('6300', '6301', '6302');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Finance Cost',
  nature              = 'Foreign Exchange Losses'
WHERE account_code = '6303';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Operating Expense',
  nature              = 'Depreciation'
WHERE account_code IN ('6400', '6401');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Operating Expense',
  nature              = 'Professional Fees'
WHERE account_code IN ('6500', '6501', '6502');

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Operating Expense',
  nature              = 'Marketing Expenses'
WHERE account_code = '6600';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Operating Expense',
  nature              = 'Travel Expenses'
WHERE account_code = '6700';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Other Expense',
  nature              = 'Losses on Disposal'
WHERE account_code = '6701';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Tax Expense',
  nature              = 'Current Tax Expense'
WHERE account_code = '7100';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Tax Expense',
  nature              = 'Tax Relief'
WHERE account_code = '7200';

UPDATE chart_of_accounts SET
  financial_statement = 'Income Statement',
  element             = 'Expense',
  sub_element         = 'Tax Expense',
  nature              = 'Deferred Tax Expense'
WHERE account_code = '7300';

UPDATE chart_of_accounts
  SET status = 'Inactive', is_active = FALSE
WHERE account_code = '2120';
