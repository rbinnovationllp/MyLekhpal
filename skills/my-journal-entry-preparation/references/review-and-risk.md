# Chart of Accounts, Duplicate Detection, Reconciliation, and Review

## Chart-of-Accounts Mapping

Priority order:

1. Use the organization's chart of accounts if the user has shared one anywhere in this
   conversation (pasted list, uploaded file, or named accounts in earlier messages).
2. If no exact account exists, look for a similar active account already used elsewhere in the
   conversation.
3. If nothing matches, recommend one or more plausible generic account names, explain *why*
   you picked them, and ask the user to confirm — don't silently invent a new ledger account
   name and present it as settled.
4. Never post to what look like control accounts (e.g., a top-level "Accounts Payable —
   Control" rather than a vendor sub-ledger) unless the user specifically directs it — flag
   this instead of doing it automatically.

## Duplicate Detection

Before finalizing an entry, compare against everything else visible in this conversation
(other rows in the same batch/upload, entries discussed earlier in the thread) on:

invoice number, vendor/customer, invoice date, amount, tax amount, PO number, bank reference,
document filename/hash if available, and prior entry description.

You cannot check the user's actual ledger or database — say so. When something looks like a
possible duplicate, present both side by side and let the user mark it as: confirmed
duplicate / separate valid transaction / credit-or-reversal / needs investigation. Never
silently merge, drop, or force a match.

## Bank and Ledger Reconciliation

When the user gives you a bank statement alongside invoices/receipts/other entries, help
match:

- receipts to customer invoices
- payments to purchase invoices
- bank transactions to accounting entries

Match on amount, date, reference number, counterparty, and narration. Call out: unmatched
bank transactions, partial payments, over/underpayments, bank fees/interest, returned/failed
payments, and outstanding deposits/cheques. If more than one bank transaction could
plausibly match an entry, present the candidates — don't force a single match silently.

## Review and Approval Workflow (concept, not something Claude can execute)

Real approval routing (who must sign off on what, at what dollar threshold) is an
organizational policy Claude can't enforce — it has no way to actually route anything to a
person or system. What the skill *can* do is:

- Always mark generated entries as `Draft — pending professional review`.
- If the user tells you their own thresholds/approval matrix, respect it in labeling (e.g.,
  flag an entry as "exceeds your stated $X review threshold — route to controller") — but this
  is informational labeling, not enforcement.
- Flag entry types that conventionally warrant a higher bar regardless of stated policy:
  related-party transactions, prior-period adjustments, consolidation/top-side entries, and
  any entry you marked low-confidence.

## Reviewer Checklist

Before presenting a "final" draft, check it against this list and mention anything that fails:

- Debits equal credits (always verify with an actual sum, don't eyeball it)
- Accounting period and dates are plausible (not far future/past without explanation)
- Referenced accounts exist / are consistent with what the user has used before
- Amounts agree with the source document
- Tax treatment is at least flagged if uncertain
- Narration is clear and specific (references invoice/PO number, date, party)
- Vendor/customer identified correctly
- Reversal noted if this is an accrual that should reverse
- Nothing here duplicates an entry seen earlier in the conversation
- Unusual amounts (round numbers, big swings from a stated prior period) are called out

## Common Errors and Risk Checks

Scan every draft for these before presenting it, and call out anything you find rather than
silently fixing it without telling the user:

1. Unbalanced entry
2. Wrong accounting period
3. Debit/credit direction reversed
4. Possible duplicate
5. Ledger account that doesn't fit the transaction
6. Missing reversal for an accrual that needs one
7. Stale recurring accrual (same amount for many periods with no review)
8. Suspiciously round number presented as if precise
9. Incorrect or unstated exchange rate
10. Missing intercompany elimination note
11. Capitalization vs. expense judgment call not flagged
12. Cut-off risk (transaction near period end, dated ambiguously)
13. GST/withholding treatment inconsistent with the taxable value
14. Tax amount that doesn't reconcile with the stated rate × taxable value
15. Invoice total that doesn't match the sum of line items
16. Missing or malformed invoice number
17. Future-dated or unusually old transaction
18. Direct posting to a receivable/payable control account
19. Vendor bank-detail change flagged as worth double-checking
20. Off-hours or weekend posting timestamp (informational, not necessarily wrong)
21. A batch of entries each just under a stated approval threshold (possible threshold-
    splitting — flag, don't accuse)
22. Same document uploaded under a different filename earlier in the conversation
23. Manual changes to a draft after you already flagged it "ready"
24. Entry with materially incomplete supporting information
25. Expense that looks personal/related-party in nature
26. Unexpected variance vs. a previous period the user has mentioned

Escalate (i.e., flag clearly and ask before finalizing) rather than quietly resolving anything
on this list yourself.
