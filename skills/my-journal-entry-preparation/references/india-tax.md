# India-Specific Accounting and Tax Support

Pull this in only when the user's jurisdiction is India, or they mention GST, TDS, TCS,
GSTIN, HSN/SAC, or e-invoicing by name. Don't apply Indian tax rules to a transaction that
hasn't indicated India as the relevant jurisdiction.

## What this skill can help with

- Identifying CGST, SGST, IGST, UTGST, and GST cess components on a transaction
- Distinguishing intra-state (CGST+SGST) vs inter-state (IGST) supply based on place of supply
- Flagging input tax credit (ITC) eligibility as a line item to confirm, not a certainty
- Flagging reverse-charge transactions for review
- Classifying taxable, exempt, nil-rated, and non-GST supplies at a high level
- Noting HSN/SAC codes if the user provides them or they're on the source document
- Flagging TDS deduction and TCS collection as relevant to the transaction type
- Recording vendor/customer advances, credit/debit notes, and referencing e-invoice/e-way bill
  numbers if present on the source document
- Noting partner remuneration/interest entries and statutory payroll deductions at a high level

## What this skill must NOT do

- Make a final legal or tax determination. GST/TDS treatment, ITC eligibility, and reverse-
  charge applicability are judgment calls with real compliance consequences — always flag
  uncertain tax treatment for review by a tax-qualified professional rather than asserting an
  answer.
- Assume current rates or thresholds from memory. GST rates, TDS thresholds, and return/
  filing requirements change over time and vary by good/service category. If the user hasn't
  given you the applicable rate and it matters, ask rather than guessing a rate from training
  data — tax configuration should come from the user's own records or a current official
  source, not be hardcoded here.
- Validate a GSTIN's real-world registration status — you can check the *format* (15
  characters: 2-digit state code + 10-character PAN + entity code + check digit) but can't
  confirm it's actually registered and active.

## Typical entry shape with GST

| Account | Debit | Credit |
|---|---|---|
| Expense/Inventory (taxable value) | ✓ | |
| Input CGST | ✓ | |
| Input SGST | ✓ | |
| Accounts Payable — Vendor (gross) | | ✓ |

For inter-state purchases, replace Input CGST + Input SGST with Input IGST.

For sales, mirror with Output CGST/SGST/IGST on the credit side alongside Revenue, and
Accounts Receivable on the debit side for the gross amount.

## TDS example (payment to a vendor subject to withholding)

| Account | Debit | Credit |
|---|---|---|
| Expense | ✓ | |
| Accounts Payable — Vendor (net of TDS) | | ✓ |
| TDS Payable | | ✓ |

Always show TDS as a separate line so the reviewer can see the withholding was applied, and
flag the applicable section/rate as "needs confirmation" unless the user has told you what it
is.
