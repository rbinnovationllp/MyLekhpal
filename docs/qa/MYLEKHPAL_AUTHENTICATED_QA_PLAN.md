# MyLekhpal minimal authenticated QA plan — approval required

This plan is intentionally limited to the existing Supabase project. It does
not authorize a new project, database, hosting environment, migration, payment
attempt, Google OAuth connection or production deployment.

## Preconditions

1. RBIL confirms in writing that the existing Supabase project is approved for
   synthetic QA and contains no customer or production financial data.
2. RBIL supplies or authorizes creation of two fictional user accounts and two
   fictional businesses owned separately by those users (for example, `QA A`
   and `QA B`). Use clearly synthetic names, email addresses and identifiers.
3. A named operator confirms the active Hostinger/Supabase deployment URL,
   valid public authentication configuration and a defined cleanup owner.
4. The migration-reconciliation record is approved before any test depends on
   an unrecorded server-side function or policy.

## Safe test matrix after approval

| Test | Synthetic data used | Expected result |
| --- | --- | --- |
| Sign in/out and protected-route redirect | One fictional user | Unauthenticated requests cannot open the workspace. |
| Business isolation | Both fictional users/businesses | User A cannot list, read or mutate User B's business, accounts, journals, documents or Google-target metadata. |
| Onboarding keyboard path | User A / Business A | Required fields, focus order, validation messages and submit feedback work without a mouse; the resulting business remains an onboarding draft. |
| PAN/GSTIN validation | User A / Business A | Invalid formats and PAN/GSTIN mismatches are rejected by both browser and server; no real identifier is used. |
| Journal draft integrity | User A / Business A | A balanced draft can be saved; unbalanced/wrong-business/duplicate-reference attempts are rejected. Do not post an entry unless the separately approved journal-guard test procedure is used. |
| Google disconnected state | User A / Business A | UI accurately states that no connection exists. Do not complete OAuth or grant Drive access. |
| Pricing/read-only catalogue | Either user, no payment method | Public/authenticated price display is consistent with approved catalogue data; do not start a trial or payment authorisation. |

## Explicitly excluded without further approval

- Creating or applying migrations, repairing migration history or changing RLS.
- Razorpay authorisation, trial creation, payment methods, webhooks or refunds.
- Google OAuth consent, token storage, Google Drive/Sheets writes or background sync.
- Testing with real PAN, GSTIN, bank, invoice, customer or employee data.
- Production deployment, DNS, hosting or secret changes.

## Cleanup and evidence

The named cleanup owner removes the two fictional accounts and both fictional
businesses only after preserving a redacted result log. Capture request IDs,
test date/time, application build SHA, user/business aliases, expected versus
actual result, and any error code. Never place credentials, tokens, PAN/GSTIN
or financial payloads in the QA record.
