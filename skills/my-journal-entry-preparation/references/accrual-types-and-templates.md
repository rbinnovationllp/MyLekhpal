# Standard Accrual Types and Common Transaction Templates

Read this when classifying a transaction and picking the debit/credit pattern. These are
starting patterns — always adapt account names to whatever chart of accounts the user has
given you, and flag when you're using a generic placeholder account name instead.

## Accounts Payable Accruals

For goods/services received but not yet invoiced at period end.

- **Debit:** relevant expense or qualifying asset
- **Credit:** accrued liabilities

Typical sources: open POs with confirmed receipt, goods-received records, contracts for
services already rendered, unbilled professional services, recurring utilities/subscriptions,
unprocessed employee expenses.

Controls to apply: document the estimate basis, use a consistent calculation method, set a
reversal date, compare the eventual actual invoice against the accrual and flag material
differences, and make sure the accrual and the later invoice aren't both expensed.

## Fixed-Asset Depreciation and Amortization

- **Debit:** depreciation/amortization expense
- **Credit:** accumulated depreciation/amortization

Supported methods: straight-line, written-down value/declining balance, units of production,
or another method the applicable framework allows.

Controls: use the fixed-asset register if the user has one, verify capitalization date and
useful life/residual value, check for additions/transfers/disposals/impairments, keep book vs.
tax depreciation separate if both are relevant, and never depreciate past full depreciation or
disposal.

## Prepaid-Expense Amortization

- **Debit:** relevant expense
- **Credit:** prepaid expense

Common categories: insurance, software licences, rent, maintenance contracts, memberships,
conference/event fees.

Controls: track start/end dates, calculate the periodic amortization, review for cancelled
contracts, apply the org's materiality policy, and never amortize beyond the remaining prepaid
balance.

## Payroll Accruals

Salary accrual — Debit: salary expense / Credit: accrued payroll
Bonus accrual — Debit: bonus expense / Credit: accrued bonus
Benefits accrual — Debit: employee-benefit expense / Credit: accrued employee benefits
Payroll-tax/statutory accrual — Debit: payroll-related expense / Credit: statutory liability

Controls: use working days and payroll-period dates, include only authorized bonuses/
incentives, account for employer contributions, track leave/PTO liabilities where relevant,
and treat employee data as sensitive — don't restate more personal payroll detail than the
entry needs.

## Revenue Recognition

Recognize deferred revenue — Debit: deferred revenue / Credit: revenue
Recognize revenue + receivable — Debit: accounts receivable / Credit: revenue
Record advance consideration — Debit: cash or A/R / Credit: deferred revenue or customer
advances

Controls: apply whatever framework the user's jurisdiction uses (don't assume ASC 606 — it
could be IFRS 15, Ind AS 115, or another local standard; ask if unclear and it matters),
identify performance obligations, determine/allocate transaction price, recognize on
satisfaction of obligations, and track contract modifications/refunds/credits/variable
consideration.

## Common Transaction Templates

Use these as the default debit/credit shape, adjusting account names to the user's chart of
accounts:

| Transaction | Typical Debit | Typical Credit |
|---|---|---|
| Cash sale | Cash | Revenue (+ Output tax if applicable) |
| Credit sale | Accounts Receivable | Revenue (+ Output tax) |
| Cash purchase | Expense/Inventory (+ Input tax) | Cash |
| Credit purchase | Expense/Inventory (+ Input tax) | Accounts Payable |
| Customer receipt | Cash/Bank | Accounts Receivable |
| Vendor payment | Accounts Payable | Cash/Bank |
| Bank charges | Bank Charges Expense | Bank |
| Interest income | Bank/Interest Receivable | Interest Income |
| Interest expense | Interest Expense | Bank/Interest Payable |
| Loan receipt | Cash/Bank | Loan Payable |
| Loan repayment | Loan Payable (+ Interest Expense) | Cash/Bank |
| Owner/partner capital contribution | Cash/Bank | Owner's/Partner's Capital |
| Drawings/partner withdrawal | Owner's/Partner's Drawings | Cash/Bank |
| Expense reimbursement | Expense | Cash/Bank or Employee Payable |
| Customer advance | Cash/Bank | Customer Advances (liability) |
| Vendor advance | Vendor Advances (asset) | Cash/Bank |
| Sales return | Sales Returns/Revenue | Accounts Receivable (+ reverse output tax) |
| Purchase return | Accounts Payable | Purchase Returns (+ reverse input tax) |
| Bad-debt write-off | Bad Debt Expense (or Allowance) | Accounts Receivable |
| Inventory adjustment | Inventory or COGS (direction depends on adjustment) | the other side |
| Intercompany transaction | Intercompany Receivable | Intercompany Payable (mirrored at other entity) |
| FX revaluation | FX Loss (or the asset/liability) | FX Gain (or the asset/liability) |
| Provision/contingency | Expense | Provision (liability) |
| Tax payment | Tax Payable | Cash/Bank |
| Tax refund | Cash/Bank | Tax Receivable or Tax Expense reversal |
| Lease entry (simple) | Right-of-Use Asset / Lease Expense | Lease Liability / Cash |
| Asset purchase | Fixed Asset | Cash/Bank or Accounts Payable |
| Asset disposal | Cash/Bank + Accumulated Depreciation (+ Loss on Disposal) | Fixed Asset (+ Gain on Disposal) |

These must be configurable to the organization's actual chart of accounts and policy — treat
the table as a fallback, not a rule that overrides what the user tells you their accounts are
called.
