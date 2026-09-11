# Skill parity test cases

Run each case once in the original skill surface and once in the authenticated MyLekhapal service. Compare functional results, not wording. The private `skill_agent_runs` row must show `skill_loaded = true` and the expected reference paths.

## Business Accounting — `/my-journal-entry-preparation`

1. Cash sale with GST: validate sales/cash and CGST/SGST or IGST lines, balance, narration and India-tax reference use.
2. Supplier invoice with eligible ITC: validate expense/creditor/input-GST split, mandatory field flags and professional-review wording.
3. Bank transfer between own accounts: validate that it is not classified as income or expense and duplicate/transfer warnings are considered.
4. Depreciation/accrual: validate the correct template/reference, period treatment and draft-only status.
5. Re-upload the same invoice: validate possible-duplicate handling, no automatic merge and audit evidence.

Expected references vary by facts: `india-tax.md` for GST/TDS, `accrual-types-and-templates.md` for accrual/depreciation, `review-and-risk.md` for duplicate/reconciliation, `mandatory-requirements-checklist.md` for every completed voucher, and `confidence-and-corrections.md` for uncertainty/correction work.

## Personal Finance & Tax Support — `/mylekhpal-personal-finance-tax-support`

1. One monthly bank statement: validate categorisation, recurring payment detection and budget output.
2. Two own-bank statements with a transfer: validate internal-transfer detection and no double-counted spending.
3. Credit-card/EMI details: validate liability, debt and goal-planning output without a named investment recommendation.
4. Retirement facts: validate retirement assumptions, calculations, caveats and `retirement-planning.md` use.
5. ITR document checklist or notice intake: validate tax-intake/referral safeguards; no filing or departmental reply is performed.

Expected references are `bank-statement-analysis.md`, `household-budgeting.md`, `liabilities-and-goals.md`, `retirement-planning.md`, `tax-service-intake.md`, `professional-referrals.md`, `regulated-advice-boundaries.md` and `output-schemas.md`, only where relevant.

## Acceptance evidence

For every successful MyLekhapal run, an authorised administrator checks the matching private log row for:

- selected skill name and exact path;
- `skill_loaded: true`;
- only same-skill reference paths;
- tool call sequence beginning with `load_skill`;
- provider model and token totals; and
- `completed` status.

Do not copy raw financial documents or model prompts into the test report.
