# Past Expenditure Analysis & Multiple-Bank Financial Overview

## Accepted inputs

PDF, CSV, and Excel bank statements, from multiple banks. Work only with statements the user has deliberately uploaded or selected. **Never claim live bank connectivity** unless an authorised Account Aggregator or regulated integration is actually wired up in the backend — this skill alone does not provide that.

## Extraction & categorization workflow

1. Extract transactions: date, description, amount, direction (credit/debit), running balance, source account/bank.
2. Identify **transfers between the user's own accounts** and exclude them from both income and expenditure totals — flag them separately.
3. Categorize each transaction:
   - Essential
   - Contractual or unavoidable (EMI, insurance premium, subscriptions with lock-in)
   - Important but adjustable
   - Discretionary
   - Unclassified — user confirmation required
4. Identify recurring payments/subscriptions (same payee, similar amount, regular interval).
5. Detect **probable duplicates** (same amount, payee, and date within a short window) — flag, don't auto-remove.
6. Highlight unusually high expenditure relative to the user's history or stated budget.
7. Compare actual expenditure against stated income and budget (if a `monthly_budget` exists from `household-budgeting.md`).
8. When a transaction can't be categorized confidently, **ask** rather than guess — offer the closest 2-3 candidate categories.
9. Every suggested category is user-correctable. Store confirmed corrections only within that user's own authorised profile — never apply one user's corrections to another user's transactions.

## Language rules

- OK: "This ₹18,400 expense is higher than your average for this category and above your ₹15,000 monthly limit."
- Not OK: any claim that a transaction was "wrong," illegal, or morally poor. The skill has no authority to make that judgment — only relative-to-budget statements.

## Multiple-Bank Financial Overview

Once statements from 2+ accounts are available, produce a consolidated view:

- Each bank account shown separately (opening/closing balance, account label — never show full account numbers, mask to last 4 digits)
- Combined opening and closing balances across accounts
- Total monthly income and total monthly expenditure (own-account transfers excluded per above)
- Cash-flow surplus or deficit
- Major expense categories, ranked
- Recurring liabilities identified from the transaction stream
- Transfers between the user's own accounts (listed, not counted as income/expense)
- Unidentified/unclassified transactions, called out explicitly
- Month-to-month trend (at least 2 months of data required to show a trend; say so if data is insufficient)

## Privacy

Never request or store internet-banking passwords, OTPs, UPI PINs, CVVs, or complete card credentials — statements are uploaded/selected by the user through the backend, not fetched with credentials by this skill.

## Output

Use the `bank_account_metadata` and `normalized_transaction` / `expense_categorization` schemas in `references/output-schemas.md`. Always cite source document(s) for every figure.
