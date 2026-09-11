# Mandatory Requirements Checklist (Applies to Every Entry, Every Source)

An entry gets these same controls whether it came from a manual description, an Excel/CSV
upload, an invoice/receipt, a bank statement, or a "batch" of documents processed together.
**No entry method skips this list.** Run through it before presenting any entry as finished.

## Every entry must

1. Have a unique **Entry ID** (`entry_id`). In multi-client mode, prefix it with the client ID
   (see `references/multi-client-management.md`).
2. Record its **source method** (`source_method`) — one of: Manual, Excel/CSV Import, Invoice
   Upload, Receipt Upload, Bank Statement, Connected System, Automated/Recurring. This is
   separate from `source_reference` (which is the specific invoice/PO number etc.) — source
   method is *how* the entry was created, source reference is *what document* backs it.
3. Include transaction date, posting date, and accounting period.
4. Have a clear description and an audit-ready narration.
5. Use accounts consistent with the user's chart of accounts (see
   `references/review-and-risk.md` §Chart of Accounts for the fallback procedure).
6. Have complete debit and credit lines in Journal Lines.
7. Pass the balance check (verify with the actual formula/sum, don't eyeball it).
8. Identify the vendor/customer/employee/counterparty where applicable.
9. Carry invoice/receipt/bank/source-document references.
10. Capture tax, currency, department, cost centre, project, and **branch** where relevant —
    `branch` is a first-class field on each line, not folded into department.
11. Link to the original supporting document (Source Documents sheet) wherever one exists.
12. Never discard or overwrite the original uploaded file/filename — reference it by name in
    Source Documents even if you can't literally store the binary in the workbook.
13. Show the calculation/accounting basis used (`calculation_method`).
14. Display assumptions, confidence level, warnings, and anything unresolved.
15. Pass duplicate-**entry** checks (same vendor/date/amount as another entry) AND
    duplicate-**document** checks (same invoice/file already processed) — these are different
    checks; do both. See `references/review-and-risk.md` §Duplicate Detection.
16. Pass period, account, tax, and mathematical validation, and note if the preparer appears
    to be acting outside their stated authority (see the Reviewer Checklist in
    `references/review-and-risk.md`).
17. Carry a reversal indicator and date where the entry type calls for one.
18. Stay in **Draft** or **Pending Review** status until a human actually approves it — never
    set `status` to Approved/Posted yourself.
19. Respect the user's stated approval matrix in labeling, even though Claude can't enforce
    routing (see `references/multi-client-management.md` for the multi-client version of this).
20. Keep a change history: anything that gets corrected after being shown to the user goes in
    `change_history`, not a silent overwrite.

## Manual entries are not exempt

A manually typed entry gets the *same* validation, duplicate checks, and approval workflow as
an uploaded one — being manual doesn't make it automatically reliable.

If no supporting document exists for a manual entry, ask the preparer for the reason, record it
in `supporting_document_missing_reason`, and add a matching Exceptions row with
`exception_type: "Supporting Document Missing"` so it surfaces in the Dashboard's
Missing-Document Warnings count and gets routed for extra review.

## Excel/CSV imports — exact row classification

Every row in an uploaded spreadsheet must end up as exactly one of:

- **Draft created successfully**
- **Possible duplicate**
- **Validation failed** (say why — missing field, bad date, account not found, math doesn't
  reconcile, etc.)
- **Pending clarification**
- **Excluded by the user**

Never silently skip a row. Before generating entries from a spreadsheet: validate the column
mapping, validate dates/periods, validate account codes, validate debit/credit amounts, validate
tax calculations, check mandatory fields, and check for duplicate rows/documents — then give the
user an import preview and, once entries are generated, a clear error/exception report (the
Exceptions sheet) covering every row that didn't cleanly convert.

## Invoice/receipt uploads

Preserve the original document reference, show extracted fields alongside what the source
document actually says (so the user can compare), highlight low-confidence fields, verify the
invoice total against the sum of line items, validate invoice number/date/parties/taxable
value/tax/gross amount, ask rather than guess when something essential is unclear, check
whether the same document (by number, date, amount, or filename) has already been processed,
and generate only a Draft/Pending Review entry — never anything further along — until it's
actually been reviewed.

## Automated/recurring "batches"

When processing several documents together in one pass (the closest a chat-based skill gets to
"daily automation" — see the scope note in SKILL.md), every control above still applies to each
item individually: balance validation, duplicate detection, period/account/tax validation,
supporting-document requirements, and the audit trail. A batch is not a shortcut around any of
this.

For anything that looks like a recurring entry (rent, subscriptions, depreciation, accruals):
if the amount, account, or calculation method has changed materially from the prior period or
from what the user described as their standing rule, flag it and route it for renewed review
rather than rolling it forward unchanged.

## Standardized output, regardless of source

No matter how an entry was created, it shows up the same way: one row in the Journal Register,
with its Entry ID linking through to the same Entry Details layout (debit/credit lines,
narration, calculations, source documents, assumptions, confidence, validation results, review/
approval evidence, change history). The source method may differ; the controls and the output
shape do not.
