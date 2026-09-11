---
name: my-journal-entry-preparation
description: Use this skill whenever the user wants to create, draft, import, or review an accounting journal entry — from a manual description of a transaction, an uploaded spreadsheet/CSV of transactions, or an uploaded invoice, receipt, bill, credit/debit note, bank statement, payroll summary, or fixed-asset schedule. Trigger on phrases like "journal entry", "JE", "book this transaction", "debit and credit for...", "how do I record...", "accrual for...", "depreciation entry", "payroll accrual", "GST/TDS entry", "post this invoice", or when the user uploads accounting source documents and wants them turned into entries — even if they don't say the words "journal entry" explicitly. Also use for reviewing draft entries for balance/errors, chart-of-accounts mapping, duplicate-transaction checks, bank/ledger reconciliation, GST/TDS working papers, and CA handover packages. Particularly strong for Indian businesses (GST, TDS/TCS, HSN/SAC, reverse charge) and for Chartered Accountants managing multiple clients, but works generically for any jurisdiction. This skill always outputs an Excel (.xlsx) workbook containing the draft entry, never posts anything automatically, and always states that a qualified accountant must review and approve before posting.
---

# Journal Entry Preparation and Accounting Document Processing

## What this skill does

Given a transaction description, an uploaded spreadsheet of transactions, or an uploaded
source document (invoice, receipt, bill, credit/debit note, bank statement, payroll summary,
fixed-asset schedule, contract), this skill:

1. Extracts the transaction facts.
2. Classifies the transaction and recommends debit/credit accounts.
3. Calculates tax, discount, FX, or withholding adjustments where applicable (including
   India GST/TDS when relevant — see `references/india-tax.md`).
4. Produces a **balanced draft journal entry** as an `.xlsx` workbook.
5. Flags duplicates, low-confidence fields, and anything it had to assume.
6. Clearly labels the output as an unposted **draft requiring professional review**.

## Non-negotiable disclaimer — include in every response that produces an entry

This skill provides accounting **workflow assistance**, not financial, tax, legal, audit, or
investment advice. AI-generated classifications, tax treatment, account selections,
depreciation, revenue-recognition conclusions, GST/TDS estimates, and journal entries may be
incomplete or wrong.

**Every entry is a draft. Never claim or imply an entry has been posted, approved, or
reviewed by a professional.** Claude has no ability to actually post to anyone's accounting
system, run scheduled jobs, or operate a live database — the deliverable is always a draft
workbook for a human to review, correct, and post themselves (or hand to their accountant/ERP).

Do not invent invoice numbers, tax IDs, GSTINs, dates, parties, account codes, tax rates,
exchange rates, or supporting documents. If something is missing or unclear, say so and ask,
rather than guessing silently.

## When NOT to over-trigger

A one-line factual question about accounting concepts ("what's the journal entry for accrued
rent, generically?") can just be answered in chat with a small table — no need to generate a
file unless the user gives a real transaction to record or asks for a downloadable entry.

## First-time use: optional Google connection prompt

The **first time** this skill is used in a conversation (and only if nothing earlier in the
conversation already answered this), ask the user once, before doing any other setup
questions:

> "Would you like to connect your Google Drive, Google Sheets, or Google Docs so your source
> documents and journal-entry exports can be stored and synced there? This is completely
> optional — if you'd rather not, I'll just generate downloadable Excel files instead, and you
> can always connect Google later."

Rules for this prompt:

- **Ask at most once per conversation.** If the user already answered (yes, no, or "skip") at
  any point earlier in this conversation, don't ask again.
- **It's genuinely optional and never blocks work.** If the user doesn't respond, ignores it,
  or says no/skip, proceed immediately with the normal workflow using downloadable `.xlsx`
  files — don't re-prompt or make Google the only path forward.
- **If they say yes**, check whether a Google Drive/Sheets/Docs connector is already available.
  If one is connected and ready, confirm what will be stored there (original source documents,
  exported workbooks, CA Review Packages) versus what stays in this chat, per the storage model
  in `references/review-and-risk.md` §Vendor-Owned Storage. If no connector is available,
  use the standard connector-search-and-suggest flow so the user can connect one — never
  fabricate a Google integration that isn't actually connected.
- **If they say no**, don't treat this as a lesser experience — just proceed with file-based
  output for the rest of the conversation.
- This prompt is about *storage location preference*, not authorization to access anything.
  Never request broader Google permissions than the user explicitly grants, and never assume
  "yes" means unrestricted Drive access — only the files/folders the user selects.

## Core workflow

0. **Identify the client/company** if the user works with more than one (an accounting firm,
   bookkeeper, or consultant). Don't create, import, review, approve, or otherwise touch an
   entry until you know which client it's for — ask if it's not already clear, and never guess
   between similarly named clients. Single-business users can skip this; everything below
   applies either way. See `references/multi-client-management.md` for the full workflow, the
   `client` JSON object, entry ID conventions, wrong-client detection, and how multi-client
   output (one workbook per client + a portfolio dashboard) works.
1. **Identify the input type**: manual description, spreadsheet/CSV upload, source-document
   upload (image/PDF), or a batch of several documents at once (treat this like the "daily
   processing" case — process each item, then give one combined summary).
2. **Extract** transaction facts. For uploaded documents, read them directly (Claude can read
   text/images/PDFs natively — use OCR-style close reading for scanned or photographed
   documents). Show the user what was extracted before finalizing so they can spot mistakes.
3. **Classify** the transaction type (sale, purchase, receipt, payment, accrual, depreciation,
   payroll, revenue recognition, transfer, adjustment, etc.) and note its **source method**
   (Manual / Excel-CSV Import / Invoice Upload / Receipt Upload / Bank Statement / Connected
   System / Automated-Recurring) — see `references/accrual-types-and-templates.md` for the
   standard entry patterns.
4. **Identify** the accounting period and transaction/posting dates.
5. **Match** the party (vendor/customer/employee/bank/ledger) — if the user has given you a
   chart of accounts or prior entries in this conversation, prefer those; otherwise use
   sensible generic account names and say so. See `references/review-and-risk.md` §Chart of
   Accounts for the fallback procedure when no exact account is available. Never create a new
   ledger without the user confirming it.
6. **Recommend debit/credit accounts.** Get the entry balanced — total debits must equal total
   credits before you present it.
7. **Calculate adjustments**: tax (see `references/india-tax.md` when India/GST/TDS is
   relevant — GSTIN, CGST/SGST/IGST, cess, ITC, reverse charge, place of supply, HSN/SAC,
   TDS/TCS — otherwise handle generically and flag tax treatment as needing review), discounts,
   FX, withholding.
8. **Check for duplicates** — both duplicate *entries* (same vendor/date/amount as something
   else in the conversation) and duplicate *documents* (same invoice/file already processed),
   checking invoice number, party, date, amount, tax amount, PO reference, bank reference, and
   file hash where available. Flag possible duplicates rather than silently merging or dropping
   them — see `references/review-and-risk.md` §Duplicate Detection.
9. **Assign an overall confidence level** (High/Medium/Low) per entry, plus field-level detail
   for anything that isn't High, and note *why* — see `references/confidence-and-corrections.md`.
10. **Run the Voucher Completeness Validator** (see below) before building anything.
11. **Build the draft workbook** with `scripts/build_journal_entry.py` (see below).
12. **Present** the entry in chat as a debit/credit table too, so the user doesn't have to open
    the file to sanity-check it, then share the file (and, if Google was connected per the
    first-time prompt, offer to export it there too).
13. **Remind** the user this is a draft pending review — every single time, no exceptions.

## Voucher Completeness Validator

Every voucher — manual, imported, OCR-extracted, recurring, or automatically drafted — must be
checked against the same fields before you present it as finished. Applicable fields include:
Client/Business ID, legal entity name, GSTIN, branch, financial year, accounting period,
voucher type and number, transaction/posting dates, party name and GSTIN, invoice number/date,
place of supply, supply type, reverse-charge applicability, HSN/SAC, item/service description,
quantity/unit, taxable value, discount, GST rate and breakup (CGST/SGST/IGST/cess), TDS/TCS,
gross amount, payment method, cash/bank ledger, debit/credit accounts, cost centre, project,
department, narration, supporting-document link, preparer, reviewer, approval status.

Classify each applicable field as one of: **Complete / Missing / Invalid / Inconsistent / Not
applicable / Pending professional review.** Never mark an entry ready to post when mandatory
information is missing — an override requires the user to record a reason and matches an
authorized approval, which this skill can only *record*, not itself grant (see
`references/mandatory-requirements-checklist.md`).

For spreadsheet/batch uploads: never silently skip a row. Every row must end up classified as
one of: **Draft created successfully / Possible duplicate / Validation failed / Pending
clarification / Excluded by the user**, and the workbook's Exceptions sheet should say which —
one Exceptions row per flagged item, not a paragraph buried in a single cell.

## Building the output workbook

The workbook is a **compact, scalable, normalized register** — designed to stay usable at
hundreds or thousands of entries, not a big visual block per entry. Never build a workbook
that gives each entry its own worksheet or its own large printed block.

Use `scripts/build_journal_entry.py` to generate the `.xlsx`. It takes a JSON description of
entries (plus optional exceptions and source documents) and produces a workbook with:

- **Dashboard** — KPI tiles (total entries, total debit/credit, counts by status, unbalanced
  entries, duplicate/missing-document/tax-review warnings, low-confidence entries), all live
  formulas over the other sheets.
- **Journal Register** — one row per entry: Entry ID, date, period, type, description,
  debit/credit account summaries, debit/credit totals (formula-driven from Journal Lines),
  status (color-coded), source, confidence (color-coded), reversal date, vendor/customer,
  department, cost centre, project, preparer, reviewer, and a "View Details" link. Built as an
  Excel Table with filters.
- **Journal Lines** — normalized: one row per debit/credit line, keyed by Entry ID.
- **Entry Details** — one row per entry (wide, not a block) with balance check, narration,
  calculation method, assumptions, confidence explanation, tax treatment, reversal info,
  preparer/reviewer/approver, every timestamp, change history, rolled-up exceptions/warnings,
  rolled-up supporting-documents summary, and a link back to the Register row.
- **Source Documents** — index of uploaded invoices/receipts/statements, keyed by Entry ID,
  with OCR confidence and verification status.
- **Exceptions** — every duplicate, missing-document flag, tax-uncertainty flag, OCR problem,
  unbalanced entry, unusual amount, etc., one row each, keyed by Entry ID, with risk level,
  required action, assigned reviewer, and resolution status/notes.
- **Review and Approval Status** — compact tracker: status, preparer/reviewer/approver, every
  date (prepared/reviewed/approved/posted), rejection reason, correction/reversal reference.

When a `client` object is supplied (see `references/multi-client-management.md`), the workbook
also gets a **Client Info** cover sheet and an "Active Client: ..." banner on every other sheet.
Register, Journal Lines, and Entry Details also carry **Source Method** and **Branch** columns.

All sheets are joined by **Entry ID**, with real in-workbook hyperlinks between the Register,
Entry Details, Journal Lines, Source Documents, and Exceptions.

```bash
cd /mnt/skills/public/my-journal-entry-preparation  # or wherever this skill is mounted

# Single company, or a single client's workspace:
python scripts/build_journal_entry.py --input entries.json --output /mnt/user-data/outputs/journal_entries.xlsx

# Multiple clients in one pass (top-level "clients" list in the input JSON):
# --output must be a DIRECTORY here -- one workbook per client, plus portfolio_dashboard.xlsx
python scripts/build_journal_entry.py --input entries.json --output /mnt/user-data/outputs/
```

See the module docstring in `scripts/build_journal_entry.py` and its `EXAMPLE_JSON` for the
exact JSON shape. Write the JSON to a temp file first rather than inlining huge JSON on the
command line.

Every entry needs a `status` — default new AI-drafted entries to `"Draft"` or `"Pending
Review"`. Never set `status` to `"Approved"` or `"Posted"` yourself; only set that if the user
tells you it happened outside this conversation.

**Always recalculate after generating**, using the xlsx skill's recalc script:

```bash
python /mnt/skills/public/xlsx/scripts/recalc.py /mnt/user-data/outputs/journal_entries.xlsx
```

Fix anything `recalc.py` reports, then re-run it clean before presenting the file(s).

## India GST/TDS support and the GST Compliance view

When the user's jurisdiction is India, or they mention GST/TDS/GSTIN/HSN by name, pull in
`references/india-tax.md` for CGST/SGST/IGST, cess, ITC, reverse charge, place of supply,
HSN/SAC, TDS/TCS, and e-invoice/e-way-bill references.

For users who want a running GST position (not just per-entry tax), you can produce a
**GST summary view** inside the workbook or in chat, using this indicative formula only:

> Estimated GST payable = Output-tax liability + reverse-charge liability + applicable
> adjustments − eligible and available input-tax credit − applicable ledger balances

Always label this: **"Estimated GST liability — subject to reconciliation and review by an
authorized tax professional."** Never present the GST collected on sales alone as the final
amount payable, and never claim GST has been deposited without an actual payment confirmation
the user has given you. Statutory due dates (e.g., GSTR-1, GSTR-3B) change by notification —
if you state one, say it's subject to official confirmation rather than presenting it as fixed.
This skill can *draft* GST/TDS working papers and flag reverse-charge exposure; it cannot
verify amounts against the actual GST Portal, calculate a legally final liability, or file
anything.

## Books handover and CA Review Package

When the user (business owner or CA) wants to hand a period over for professional review or
filing, offer a **CA Review Package** — a workbook (or set of workbooks) containing whichever
of these are relevant and available from the conversation: Journal Register, general ledger,
trial balance, P&L, balance sheet, cash/bank books, sales/purchase registers, receivables/
payables, inventory report, fixed-asset register, GST summary, TDS/TCS summary, bank
reconciliation, exceptions, missing-document report, source-document index, audit trail,
adjustments/reversals. Only include sections you actually have data for — don't fabricate
placeholder financials.

You can track a period through informal handover stages if useful (records in progress →
documents incomplete → ready for internal review → submitted to accountant → queries raised →
corrections pending → review completed → return ready → filed → period closed), but note that
this is only a status Claude is helping the user *track in this conversation* — it isn't a real
workflow engine with enforcement, notifications, or locking. If the user needs the underlying
platform features (real dashboards, real Google sync, real subscription/data-retention
infrastructure), be clear that's outside anything a chat skill runs — see the section below.

## Standard entry types, templates, and reference files

Don't try to hold all of this in your head — read the reference file for the situation at hand:

- `references/mandatory-requirements-checklist.md` — the master checklist every entry must
  satisfy regardless of source, the exact spreadsheet-import row-classification wording, the
  missing-supporting-document rule for manual entries, and the material-change rule for
  recurring entries. Check this before finishing any entry.
- `references/multi-client-management.md` — for accounting firms/consultants managing more
  than one client: the `client` JSON object, mandatory client confirmation before touching an
  entry, the Client Info sheet and "Active Client" banners, entry ID conventions, wrong-client
  document detection, multi-client spreadsheet imports, the portfolio dashboard, role
  definitions (preparer/reviewer/approver/poster/CA partner/client representative/
  administrator/auditor), and an honest note on what access-control this skill can't actually
  enforce.
- `references/accrual-types-and-templates.md` — accounts-payable accruals, depreciation/
  amortization, prepaid-expense amortization, payroll accruals, revenue recognition, plus the
  full library of common transaction templates (cash/credit sales & purchases, returns,
  advances, bad debt, intercompany, FX revaluation, leases, disposals, deferred revenue, etc.).
- `references/india-tax.md` — CGST/SGST/IGST/UTGST, cess, ITC, reverse charge, place of
  supply, HSN/SAC, TDS/TCS, e-invoice/e-way bill references, and the GST Compliance view
  formula/disclaimer above. Only pull this in when the user's jurisdiction is India or they
  mention GST/TDS/GSTIN/HSN by name. Otherwise treat tax generically and flag it for review.
- `references/review-and-risk.md` — chart-of-accounts fallback procedure, duplicate-detection
  fields, bank/ledger reconciliation matching logic (including partial payments, overpayments,
  bank charges, unmatched transactions — never force a match when several are plausible), the
  reviewer checklist, the approval-matrix concept, the Vendor-Owned Storage model (what stays
  in the user's own Google Drive vs. what this skill needs to track), and common errors/risk
  checks to scan every entry against (unbalanced entries, wrong period, wrong debit/credit
  direction, cut-off errors, round-number estimates, split entries designed to dodge approval
  thresholds, etc.).
- `references/confidence-and-corrections.md` — how to grade and explain confidence, what
  triggers a clarifying question instead of a guess, and how corrections to an *already
  presented* draft should work (new version / reversal note, never silently overwriting figures
  without saying what changed). Posted entries are never silently edited or deleted — only
  reversed or adjusted, with full history.

## Handling the things a chat-based skill genuinely can't do

Whatever surrounding product this skill is embedded in may describe a full accounting
application — persistent multi-tenant database, role-based access control enforced at the
infrastructure level, live dashboards, subscription billing, automated recurring postings on a
schedule, GST-Portal integration, encrypted backups, Google Drive synchronization. Claude,
running in a chat conversation, cannot itself:

- Check a live database for duplicates, prior postings, or account balances — it can only
  compare against what's visible in the current conversation/uploads. Say so plainly rather
  than implying a real duplicate-check ran against the user's actual ledger.
- Enforce role-based access, approval limits, or actually post/file/pay anything.
- Run on a schedule, send automated alerts, or watch a compliance calendar in the background.
  If the user wants "daily processing," treat a batch of uploaded documents in one conversation
  as that batch's processing run, and summarize it the same way (documents received / entries
  drafted / exceptions) rather than claiming an automated job ran.
- Guarantee that a connected Google Sheet/Doc/Drive folder stays in sync outside this
  conversation, or that data is encrypted at rest in a system Claude doesn't operate.
- Provide a real-time dashboard, multi-user login, or subscription/billing system — those are
  application features that live outside this skill entirely.

Be upfront about this rather than pretending the full application exists. It doesn't undercut
the value of a correct, well-organized draft entry or a clear India GST estimate — false claims
of automation, live database verification, or infrastructure this skill doesn't run are worse
than an honest scope note.

## Final reminder

Every deliverable from this skill is a **draft**. State plainly, every time: *"This is a draft
for your review — please have a qualified accountant confirm the accounts, tax treatment, and
figures before posting."* Never soften or drop this, even if the user seems confident or asks
you to "just post it" or "just file the return" — you have no posting or filing capability and
shouldn't imply otherwise.
