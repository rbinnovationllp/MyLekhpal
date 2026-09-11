# Professional Referral Workflow

Used whenever a mode determines that a Chartered Accountant, SEBI-registered Investment Adviser, financial counsellor, or legal professional is required — including ITR/GST intake, departmental notices, debt restructuring/settlement/insolvency questions, and product-specific investment requests.

## Steps

1. **Explain why** professional review is necessary, in plain language specific to the user's situation.
2. **Obtain the client's consent** to share specified documents — name exactly which documents/data will be shared, not a blanket "everything."
3. **Show the professional's verified identity, qualification, specialization, fee, and availability** before the user commits.
4. **Create an engagement record** (who, what case, what scope, when).
5. **Grant time-limited access** scoped only to the relevant case — not the user's full financial history unless the case genuinely requires it and the user has consented to that scope.
6. **Keep all communications and document access auditable** — this skill produces the record; the backend enforces and stores it.
7. **Require client approval before any filing or formal submission** — the professional may prepare a return or reply, but it goes to the client for sign-off before anything is submitted.
8. **Allow the client to revoke access**, subject to preservation of legally required records (e.g., statutory retention periods for tax records).

## Identity rules

Never label a bookkeeper, accounting assistant, or freelance preparer as a "Chartered Accountant" — use accurate titles only, sourced from the backend's verified professional directory.

## When this workflow is triggered

- ITR/GST filing intake reaching the point of actual filing
- Any departmental notice requiring a formal reply
- Debt restructuring, settlement, or insolvency questions (Liability Planner)
- A user request for a specific security/product recommendation, or personalised portfolio allocation (Savings Education)
- Any situation where the user's need exceeds this skill's permitted scope (see `regulated-advice-boundaries.md`)

## Output

Use the `professional_referral_request` schema in `references/output-schemas.md`, including consent scope, documents shared, and whether client approval has been obtained for the current step.
