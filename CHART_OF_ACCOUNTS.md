# Arcbuild Pro Chart of Accounts

## 1. Purpose and Standards
This document describes the Arcbuild Pro chart of accounts classification system. The account structure is designed to align with ICAG Ghana financial accounting standards and IFRS as adopted in Ghana.

Standards referenced:
- IAS 1 — Presentation of Financial Statements
- IAS 2 — Inventories
- IAS 7 — Statement of Cash Flows
- IAS 12 — Income Taxes
- IAS 16 — Property, Plant and Equipment
- IAS 19 — Employee Benefits
- IAS 21 — Effects of Changes in Foreign Exchange Rates
- IAS 23 — Borrowing Costs
- IAS 37 — Provisions, Contingent Liabilities and Contingent Assets
- IAS 38 — Intangible Assets
- IFRS 9 — Financial Instruments
- IFRS 15 — Revenue from Contracts with Customers
- IFRS 16 — Leases
- Companies Act 2019 (Ghana)
- Income Tax Act 2000 (Ghana), as amended

This system adds four classification layers to each account record plus payment account metadata. The goal is to preserve existing account codes and balances while enabling financial statement grouping, contra-account handling, and payment account selection.

## 2. Account Code Structure
The code structure reflects the major ledger categories used by Arcbuild Pro.

1000–1999  Assets
  1100–1199  Current Assets
  1200–1299  Non-Current Assets
  1300–1399  Contract Assets and Retention
  1400–1499  Digital Payment Accounts (Mobile Money)
2000–2999  Liabilities
  2100–2199  Current Liabilities
  2200–2299  Non-Current Liabilities
  2300–2399  Contract Liabilities
3000–3999  Equity
4000–4999  Revenue
  4100–4199  Construction Revenue
  4200–4299  Architecture Revenue
  4300–4399  Real Estate Revenue
  4400–4499  Logistics Revenue
  4500–4599  Other Income
  4600–4699  IFRS 15 Recognition Accounts
5000–5999  Cost of Sales
6000–6999  Operating Expenses
  6300–6399  Finance Costs
7000–7999  Tax Accounts

## 3. Classification Hierarchy
Arcbuild Pro stores four classification levels for each ledger account.

- `financial_statement`
  - Allowed values: `Balance Sheet`, `Income Statement`, `Memo`
  - Purpose: indicates the statement on which the account is reported, or that it is a header/grouping row.

- `element`
  - Allowed values: `Asset`, `Liability`, `Equity`, `Revenue`, `Expense`
  - Purpose: maps accounts to IFRS element categories using IAS and IFRS framework guidance.

- `sub_element`
  - Asset: `Current Asset`, `Non-Current Asset`
  - Liability: `Current Liability`, `Non-Current Liability`
  - Equity: `Contributed Capital`, `Retained Earnings`, `Other Comprehensive Income`
  - Revenue: `Operating Revenue`, `Other Income`
  - Expense: `Cost of Sales`, `Operating Expense`, `Finance Cost`, `Tax Expense`, `Other Expense`
  - Purpose: supports ICAG Ghana grouping for published financial statements.

- `nature`
  - Free-text field for the most granular classification.
  - Typical values include `Cash and Cash Equivalents`, `Trade Receivables`, `Property Plant and Equipment`, `Contract Revenue`, `Employee Benefits`, `Foreign Exchange Losses`, `Current Tax Expense`, and others.

## 4. Special Account Behaviours
This section documents accounts with rules that differ from normal ledger rows.

- `1211 Accumulated Depreciation`
  - Treated as a contra-asset.
  - `is_contra = true`.
  - Presented as a deduction from Property, Plant and Equipment on the Balance Sheet rather than as a standalone asset line.

- `2120 GetFUND Levy Payable`
  - Duplicate of `2104`.
  - This account is permanently inactive to preserve referential integrity.
  - Never delete `2120`; it remains in the ledger as inactive.

- `3300 Current Year Earnings`
  - Retained earnings-type account used during the year.
  - At year end, its balance is closed to `3200 Retained Earnings` via the year-end closing journal.
  - `nature = 'Current Year Earnings'` is the system marker for the closing function.

- `3400 FX Translation Reserve`
  - Equity item under IAS 21.
  - Classified as Other Comprehensive Income.
  - This balance is not reported through the Income Statement.

- `6701 Loss on Asset Disposal`
  - Classified as `Other Expense`, not Travel.
  - Corrects a historical misclassification and ensures proper profit and loss presentation.

## 5. Payment Account Rules
Payment account metadata drives every payment dropdown in the system.

- `is_payment_account`
  - Only accounts with this flag set to `true` appear in payment account selectors.
  - Used for cash, bank, and mobile money accounts.

- `payment_method_type`
  - Allowed values: `Cash`, `Bank`, `Mobile Money`
  - Groups payment accounts in the UI.
  - Cash and Bank accounts can be used for general collections.
  - Mobile Money accounts are always Ghana Cedi (GHS) only, per Bank of Ghana rules.

- When adding a payment account, set:
  - `is_payment_account = true`
  - `payment_method_type` to the matching payment channel

- In the payment modal, accounts are grouped into three sections:
  - Cash
  - Bank
  - Mobile Money

## 6. Adding New Accounts
To add a new account in Arcbuild Pro:
1. Open the Chart of Accounts management page.
2. Click `+ Add New Account`.
3. Enter the account code and name.
4. Select the account type and classification fields.
5. Choose `financial_statement`, `element`, `sub_element`, and enter a `nature` value.
6. If the account is a payment account, tick `Payment Account` and select the correct payment method.
7. Save the account.

Important: account codes are permanently locked once saved.

## 7. Ghana Tax Context
Arcbuild Pro includes Ghana-specific tax account classification.

- VAT — standard Ghana VAT rate is 15%.
- NHIL — National Health Insurance Levy at 2.5%.
- GetFUND — Ghana Education Trust Fund levy at 2.5%.
- WHT — Withholding tax rates vary by client and transaction type.
- PAYE — Pay-As-You-Earn bands are applied per Ghana income tax rules.
- SSNIT — Social Security and National Insurance Trust contributions are applied at statutory employee/employer rates.
- Corporate Income Tax — Ghana corporate tax rate is 25%.
- Capital Allowances — treated under the Income Tax Act 2000 Schedule 3 as tax relief items.

These accounts are classified so that tax payables and tax expense items flow coherently through the system and into financial statements.
