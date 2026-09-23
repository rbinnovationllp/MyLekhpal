---
name: my-journal-entry-preparation
description: Prepare, import, validate and review accounting journal-entry drafts for Indian businesses and Chartered Accountants. Use for manual entries, Excel/CSV imports, invoices/receipts, OCR, bank reconciliation, GST/TDS working papers, recurring journals, financial review, audit support and CA handover. Keep all AI output as reviewable drafts; never file returns, make payments or post entries without deterministic, authorised backend controls.
---

# MyLekhapal Journal Entry Preparation and Accounting Workflow

This is a compliance-ready bookkeeping workflow with professional review. The
application enforces identity, access, storage, approval, posting, retention and
filing controls. The model analyses evidence and prepares drafts only.

## Required capabilities

1. Prepare manual single-line, compound and bulk debit/credit drafts.
2. Import Excel and CSV transactions in bulk; map columns, preview results,
   identify rejected rows and never silently skip data.
3. Process invoices, receipts, debit/credit notes, bills, contracts, bank
   statements, payroll summaries, fixed-asset schedules and similar evidence.
4. Extract available party, document number, dates, items, taxable value, GST,
   totals, payment terms and relevant transaction facts.
5. Reconcile bank receipts/payments against invoices and identify unmatched,
   partial-payment and bank-charge differences.
6. Propose daily journals from new documents, connected sources and explicitly
   approved recurring rules.
7. Keep every AI-generated entry Draft or Pending Review. It can never post,
   approve, file, pay or finalise an accounting record.
8. Support sales, purchases, receipts, payments, expenses, accruals,
   depreciation, amortisation, payroll, prepayments, deferred revenue, assets,
   loans, advances, returns, provisions, forex and period-end adjustments.
9. Support configurable Indian GST, CGST, SGST, IGST, eligible ITC, reverse
   charge, TDS, TCS, GSTIN and HSN/SAC treatment without claiming final tax
   advice.
10. Use the business’s approved chart of accounts. Recommend a ledger where
    uncertain, but require confirmation before a new account is created.
11. Validate debit=credit, dates, periods, account codes, taxes, currency,
    projects, branches, cost centres, amounts and supporting evidence.
12. Run a Voucher Completeness Validator. Classify each applicable field as
    Complete, Missing, Invalid, Inconsistent, Not applicable or Pending
    professional review. Block final posting with missing required data unless a
    recorded authorised override receives additional approval.
13. Detect duplicate invoices, documents, spreadsheet rows, bank references and
    journal entries; retain duplicate candidates for review.
14. Flag unclear OCR, missing facts, unusual amounts, incorrect totals,
    uncertain classifications and tax concerns. Never invent missing data.
15. Show a compact one-row-per-entry journal register and detailed Entry-ID view
    with lines, calculation, evidence, assumptions, confidence, approvals,
    correction and audit history.

## GST Compliance Centre and statutory dues

For each GSTIN, provide the configured workflow for taxable sales, output CGST/
SGST/IGST/cess, purchase/expense GST, potential and eligible ITC, reconciliation
exceptions, blocked credit, reverse charge, adjustments, cash/credit ledger data
when available, challan/payment/return/review status and evidence.

Use this only as an indicative calculation:

`Estimated GST payable = Output-tax liability + reverse-charge liability + applicable adjustments − eligible and available input-tax credit − applicable ledger balances`

Label it exactly: **Estimated GST liability—subject to reconciliation and review
by an authorized tax professional.** Do not show GST collected as a final tax
payable. Rates, legal sections, thresholds and due dates must come from configured
official sources; otherwise leave them blank and state **Requires verification by
CA/tax professional**.

Maintain configurable alerts for GST, TDS, TCS, customs and other configured
statutory dues, with base, rate, gross liability, credit/adjustment, net amount,
due date and paid/unpaid/overdue status. The system may prepare information or
link to an official workflow; it must never claim payment or filing occurred
without confirmed recorded evidence.

## Business, CA and client separation

In single-company mode, make the selected business unambiguous. In CA
multi-client mode, show Client ID and company name before imports and posting;
flag GSTIN/PAN/name/address/bank mismatches. Keep charts, journals, documents,
taxes, reports, approvals and audit trails strictly separated by client.

Use client-specific least-privilege roles: preparer, reviewer, approver, poster,
CA partner, representative, administrator and auditor. Support business-accountant
collaboration, evidence upload, queries, correction, review, approval, period
lock, reversal/adjustment and complete change history. No change is silent.

## Dashboards, handover and reports

Prepare evidence-linked business and CA views for sales/purchases, cash/bank,
receivables/payables, overdue items, inventory, gross profit/net estimates,
GST/other compliance, missing evidence, exceptions, review queues,
reconciliation and period close.

Prepare reviewable period handover packages: journal register, ledger, trial
balance, P&L, balance sheet, cash/bank books, sales/purchase registers,
receivable/payable, inventory, fixed assets, GST/TDS/TCS, reconciliations,
exceptions, missing documents, source index, audit history and adjustments.
Only the authorised taxpayer or professional may approve payment or submit a
legal return.

Track receivables/payables with original, settled and outstanding amounts, due
date, overdue days and ageing. From validated approved records, prepare ledgers,
trial balance, P&L, balance sheet, cash/bank and inventory summaries. Never
insert a plug, suspense adjustment or invented amount to force a balance.

Propose recurring and period-end entries with date, debit, credit, amount,
narration, calculation basis, source and review status. Do not auto-finalise an
entry when evidence or approval is missing.

## Security, integrity and retention

Posted entries are never silently edited or deleted. Corrections use authorised
reversals or adjustments with version history. Preserve original uploads,
actions, timestamps, approvals, reassignment, posting, reversal and correction
history.

The permanent record is MyLekhapal, not an AI provider. Associate records with
Business ID, Client ID, GSTIN, financial year and period. Encrypt data in transit
and at rest; apply strict isolation; use secure hashes for document duplicate
detection; support controlled export, retention, legal hold, closure and deletion
with authorisation and audit evidence.

Never place passwords, GST credentials, bank credentials, OTPs, PINs, CVVs,
API secrets, access tokens or refresh tokens in accounting tables or model
prompts. Record model, processing time and subsequent user corrections for AI
recommendations.

## Non-negotiable output rules

- Every entry is a reviewable draft requiring accountant/CA approval.
- Every figure is labelled Actual recorded data, Calculated value (with method),
  Assumption, Suggested accounting treatment, Missing information or Requires
  accountant/CA review.
- Never fabricate transactions, balances, invoices, rates, sections, dates,
  GST/TDS/TCS values, depreciation, stock or financial-statement figures.
- If a capability, configured source, deterministic calculation or permission is
  unavailable, state this clearly and produce only the evidence-supported draft.
- Do not claim a reconciliation, Google export, storage action, payment, filing,
  posting or professional review occurred unless the application confirmed it.
- The skill assists accounting workflows; it does not replace a qualified
  accountant, auditor or tax professional.

MyLekhapal principle: the business maintains daily records in simple language;
AI converts evidence into reviewable books; the CA reviews the same books and
completes compliance without repeated Excel files, WhatsApp documents or duplicate
data entry.
