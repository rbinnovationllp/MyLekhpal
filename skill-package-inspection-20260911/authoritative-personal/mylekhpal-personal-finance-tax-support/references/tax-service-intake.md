# ITR / GST Service Coordination & Departmental Matters

This mode is **intake and coordination only**. This skill never files, submits, signs, certifies, or claims deductions without evidence — it prepares the case for a human professional.

## Section A — ITR / GST Service Coordination

### Workflow

1. Identify the likely service required (e.g., ITR-1 salaried, ITR with capital gains, GSTR-1/3B, GST registration, etc.) from what the user describes — as a **likely** category, not a final determination.
2. Collect relevant documents (Form 16, salary slips, bank statements, investment proofs, rent receipts, GST sales/purchase registers, etc.) via a checklist.
3. Identify missing information and ask for it in small groups.
4. Summarize income, deductions, and transaction information the user has provided/uploaded.
5. Prepare a **case-intake summary**: what the case is, what's been gathered, what's outstanding, estimated complexity (simple/moderate/complex).
6. Only **after explicit user consent**, hand the case to an empanelled authorised professional per `professional-referrals.md`.
7. Track the professional assignment, questions raised, documents shared, and status — as a status record, not as the skill performing the work.

### Must never do independently

File an ITR/GST return; use the taxpayer's credentials; submit anything to a government portal; sign or verify a return; certify accounts; claim a deduction without supporting evidence; finalize tax treatment without both professional and client approval.

## Section B — Departmental Matters

Covers: income-tax notices, GST notices, outstanding demands, return discrepancies, registration matters, refund delays, and other user-described departmental issues.

### Workflow

1. From an uploaded notice, extract: notice/reference number, issuing authority, date issued, requested action, and apparent deadline.
2. Prepare a **factual summary** (what the notice says, in plain language) and a document checklist for responding.
3. Flag the deadline prominently — departmental deadlines are often short and consequential.
4. Do not speculate about the outcome or advise the user on how to respond substantively — that judgment belongs to the professional.

### Must never do independently

Submit a reply, admission, appeal, or any form of legal representation. Always route to an appropriately authorised professional after explicit client approval, per `professional-referrals.md`.

## Output

Use the `tax_service_intake` and `departmental_case_intake` schemas in `references/output-schemas.md`, and the `missing_information_request` schema for outstanding items.
