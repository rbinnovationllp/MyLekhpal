# MyLekhpal Phase 14 release preparation

Updated: 30 October 2026 (Asia/Kolkata). No production schema, permission,
function, record, payment, Google account or deployment was changed.

## Legacy Google Drive endpoint

Status: **unknown legacy usage**.

The current Hostinger entrypoint and built assets contain no
`google-drive-start` reference; supported current paths use
`google-drive-connect`, `google-drive-callback` and `google-drive-status`.
The root-level legacy `supabase.ts` still has a caller, but it is outside the
current Hostinger entry graph. Supabase still reports `google-drive-start` as
an active deployed function. The Management API exposes metadata, not deployed
source. Aggregate-only logs queries could not be used because the logs endpoint
returned HTTP 500; this is not evidence of no traffic.

### Manual dashboard steps for RBIL

1. Sign in to the Supabase Dashboard and choose project `xmotjwexpieudlbqpyno`.
2. Open **Edge Functions**, select **google-drive-start**, and inspect the
   invocation/log views across the full available retention window. Record only
   aggregate counts, dates and status classes; do not copy bodies, headers,
   OAuth state values or tokens.
3. If a **Code** or deployment-source view is available, inspect whether it
   creates its database client with `SUPABASE_SERVICE_ROLE_KEY` before calling
   any `google_oauth_*` RPC. Do not display secret values.
4. If no source view is available, obtain the deployed function source or
   deployment artifact from its original deployment owner. Do not infer safety
   from an empty repository directory.
5. Check served legacy hostnames, release archives, redirect rules and older
   static assets for `google-drive-start` before declaring it unused.

Do not disable, delete, invoke or redeploy the function as part of this review.

## 13-issue status

| Status | Issues |
| --- | --- |
| Verified locally/existing | ML-03/13, ML-05, ML-07, ML-08, ML-09, ML-11 |
| Partial — legal or authenticated QA required | ML-01, ML-02, ML-06, ML-10, ML-12 |
| Blocked — security/legacy investigation | ML-04 |

ML-01 and ML-02 have non-binding local `/privacy` and `/terms` drafts, but
need legal approval and deployed-route review. ML-06/10 have browser and
deployed-RPC definition validation evidence, but need fictional-user behavioral
tests. ML-12 has native-submit source evidence but needs authenticated keyboard,
focus and persisted-onboarding testing.

## Safe QA evidence

- Node regression suite: **18/18 passed**.
- Hostinger deployment-file check: passed; anonymous protected-books request
  returned expected HTTP 401.
- Hostinger production build: passed.
- Full `npm run lint`: **not clean**. It reports pre-existing mixed Deno/Node,
  Next/Vite, generated-artifact and shared-component diagnostics. No lint rule
  was disabled and no unrelated code was changed.

## Twelve unrecorded migrations

Read-only catalog reconciliation found all primary relation/function markers,
expected public-table RLS/policy markers, and all reviewed index/trigger markers
for these migrations:

`202609110008`, `202609110009`, `202609120001`, `202609120002`,
`202609130003`–`202609130007`, `202609140001`, `202609150001`, and
`202610190001`.

The record remains **partial**, not historical proof: exact definition/owner/
grant checks are still required before any migration-history procedure. The
known conflict is that OAuth helper functions retain anon/authenticated execute
grants contrary to repository intent. Do not replay the twelve files or repair
history.

## Prepared SQL awaiting separate approval

| Migration | Purpose | Approval prerequisites |
| --- | --- | --- |
| `202610300003_google_oauth_rpc_hardening.sql` | Restrict seven OAuth helper RPCs to `service_role`. | Classify/verify the active legacy function; confirm deployed service-role configuration; approve fictional-user regression. |
| `202610300001_journal_posting_balance_guard.sql` | Require posted journals to balance at transaction end. | Approved reconciliation record, read-only posted-entry preflight, synthetic regression and concurrency protocol. |
| `202610300002_public_subscription_plan_catalog.sql` | Add public business price/GST/entitlement view and protect provider IDs. | RBIL pricing/legal decisions and checkout compatibility review. |

## Fictional-user QA setup — ready but not authorized

Create only after written approval of the actual controlled test inboxes and a
cleanup owner:

| User | Sole business | Test scope |
| --- | --- | --- |
| Owner A — approved controlled inbox | `QA Alpha Trading — fictional` | Sign-in/out, onboarding keyboard flow, invalid PAN/GSTIN, balanced/unbalanced drafts, isolation checks. |
| Owner B — approved controlled inbox | `QA Beta Services — fictional` | Cross-tenant denial checks; no shared membership. |

Expected normal-flow writes are two Auth users, profiles/memberships, two
businesses, starter accounts/trial rows and limited draft journals. Exclude
Razorpay, Google OAuth/Drive, real identifiers, migrations, payment methods and
production deployment. Preserve only redacted evidence, then delete both users
and businesses under the named cleanup owner.

## Pricing, GST and entitlement decisions awaiting RBIL

### Business Accounting

| Family | Monthly/annual | AI allowance | Price/GST/entitlement decision |
| --- | --- | ---: | --- |
| Micro Vendor | Both configured | 50/month | Missing |
| Small Business | Both configured | 150/month | Missing |
| Business Plus | Both configured | 500/month | Missing |
| Accountant / Bookkeeper | Both configured | 1,000/month | Missing |
| CA Practice | Both configured | 3,000/month | Missing |

Business trial: 14 days from business creation; Razorpay mapping is server-side.
The live business-plan schema does not yet store price/GST/public entitlement
fields, so do not infer them from provider mappings.

### Personal Finance

| Plan | Monthly incl. GST | Annual incl. GST | Base price | GST | Trial |
| --- | ---: | ---: | ---: | --- |
| Personal Basic | ₹117 | ₹1,179 | ₹99 / ₹999 | 18% | 3 days after verified authorisation |
| Personal Plus | ₹235 | ₹2,359 | ₹199 / ₹1,999 | 18% | Same |
| Professional | ₹471 | ₹4,719 | ₹399 / ₹3,999 | 18% | Same |
| Premium | ₹825 | ₹8,259 | ₹699 / ₹6,999 | 18% | Same |

RBIL must approve price, GST treatment, entitlement wording, annual-plan terms,
trial copy and payment rules before public release.

## OAuth hardening evidence required for GO

1. Dashboard/manual evidence that `google-drive-start` is unused, or deployed
   source demonstrating it authenticates callers and uses
   `SUPABASE_SERVICE_ROLE_KEY` for protected RPCs.
2. Confirmation that all supported deployed Google OAuth functions have the
   service-role secret configured, without revealing it.
3. Approved fictional-user regression plan for supported initiation, callback,
   status and reauthorisation-failure handling—without a personal Google Drive.
4. Separate owner approval for **only** the OAuth hardening migration.

## Production decision

**NO-GO.** Independent local work is complete, but production remains blocked
by legacy OAuth uncertainty, exposed OAuth helper grants, unresolved migration
history, unapproved business pricing/legal decisions, incomplete authenticated
QA and lint-scope debt. Do not deploy or execute any migration yet.
