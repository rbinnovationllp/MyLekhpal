# MyLekhpal Phase 10 controlled QA report

Updated: 30 October 2026 (Asia/Kolkata). This report records read-only checks
only. No user, business, subscription, payment, OAuth, database, migration or
deployment state was changed.

## Authentication HTTP 200 versus 401

| Endpoint | Credential type | Result | Finding |
| --- | --- | --- | --- |
| `GET /auth/v1/settings` | Public anon key, no user JWT | 200 | The configured public key is valid for anonymous Auth configuration access. |
| `POST /rest/v1/rpc/mylekhpal_books` | Public anon key, no user JWT | 401 | Expected: the RPC requires `auth.uid()` and is not an anonymous endpoint. This is not evidence of an invalid anon key. |
| `GET /v1/projects/{project-ref}` | Management access token | 200 | Management API connectivity is valid. |

Normal browser authentication cannot be proven until a fictional user signs in
and supplies a signed session JWT; that requires the owner-approved QA setup.

## Subscription review — owner decision required

### Business Accounting

The live schema has plan code, display name, interval, Razorpay plan mapping and
monthly AI limit, but **no price, GST or public-entitlement columns**. Price and
GST must not be inferred from Razorpay IDs.

| Plan family | Monthly/annual variants | Monthly AI limit | Razorpay mapping | Price/GST/entitlements |
| --- | --- | ---: | --- | --- |
| Micro Vendor | monthly, yearly | 50 | repository mapping present | Not stored/approved |
| Small Business | monthly, yearly | 150 | repository mapping present | Not stored/approved |
| Business Plus | monthly, yearly | 500 | repository mapping present | Not stored/approved |
| Accountant / Bookkeeper | monthly, yearly | 1,000 | repository mapping present | Not stored/approved |
| CA Practice | monthly, yearly | 3,000 | repository mapping present | Not stored/approved |

Business trial rule: 14 days from business creation. Only the business owner can
start secure Razorpay authorisation; the Edge Function schedules the first
charge at the stored trial end. Payment/trial behaviour was not invoked.

### Personal Finance

Repository catalogue values are GST-inclusive. Base price implies 18% GST for
every listed plan; live price records were not read.

| Plan | Monthly | Annual | Base monthly/annual | GST | Entitlement summary |
| --- | ---: | ---: | ---: | --- |
| Personal Basic | ₹117 | ₹1,179 | ₹99 / ₹999 | 18% inclusive | Income, expenses, budgeting, tax estimates, checklist. |
| Personal Plus | ₹235 | ₹2,359 | ₹199 / ₹1,999 | 18% inclusive | Basic plus goals, planning and tax-regime comparison. |
| Professional | ₹471 | ₹4,719 | ₹399 / ₹3,999 | 18% inclusive | Multiple income, capital gains and advance-tax planning support. |
| Premium | ₹825 | ₹8,259 | ₹699 / ₹6,999 | 18% inclusive | Advanced scenarios, priority support and professional-review workflow. |

Personal trial rule: three days after verified Razorpay authorisation; the
first recurring charge is scheduled at trial end. All plan IDs remain in
repository configuration and are intentionally omitted from this report.

**Owner decisions needed:** approve every business price, GST treatment,
public entitlement, personal-catalogue value, trial wording, payment rule and
Razorpay mapping before public release or catalogue migration execution.

## SQL readiness

### Journal-balance guard

The prepared migration is compatible with its intended PostgreSQL use after the
local correction to use deferred row-level `INSERT/UPDATE/DELETE` constraint
triggers. It covers direct insertion of `posted` entries and changes to posted
lines, while allowing incomplete drafts. Its security-definer function has an
empty search path and fully qualified table names. It is not executed.

Execution order, if separately approved: (1) complete migration reconciliation;
(2) run the approved read-only preflight for existing posted balances; (3) apply
only the guard migration; (4) run the rollback-only SQL regression suite with
explicit synthetic IDs; (5) run the documented two-session concurrency test;
(6) preserve results. Existing unbalanced posted rows are not repaired by the
migration, so preflight is mandatory. Rollback drops only the two guard triggers
and guard function after confirming no dependent migration/function exists.

### Public business subscription catalogue

The prepared migration adds nullable business price/GST/entitlement columns,
keeps provider identifiers in the base table, enables RLS, revokes base-table
access from public roles and exposes only approved active pricing fields through
a security-barrier view. It excludes `razorpay_plan_id` and operational fields.

Compatibility risks requiring approval: current business plan rows lack the
new approved values; public UI pricing is not yet bound to the proposed view;
and the Razorpay business Edge Function currently reads the base table using a
server-side client. Verify its service-role access and checkout behaviour before
revoking public base-table grants. Do not apply this migration yet.

## Twelve unrecorded migrations — read-only reconciliation

All twelve migrations have their primary catalog markers present. RLS was
enabled on every inspected migration-created table; expected public select
policies were present. This proves neither migration-history provenance nor a
statement-for-statement checksum match.

| Migration group | Read-only result |
| --- | --- |
| Personal catalogue and observability (`202609110008`–`009`) | Primary tables, indexes/functions and RLS markers present. |
| Google OAuth/trial (`202609120001`–`002`) | Primary tables/functions present; **OAuth function grants conflict** with repository service-role-only intent. |
| Sync, metrics, storage and multi-document (`202609130003`–`006`) | Primary queue/metrics/storage/draft markers present; storage policy/definition checksum remains a statement-level follow-up. |
| OAuth private RPC and state lookup (`202609130007`, `202609140001`) | **Conflicting:** helper functions exist as `SECURITY DEFINER`, but `anon` and `authenticated` retain execute privilege. |
| Google targets and public visit (`202609150001`, `202610190001`) | Primary target/audit markers and `record_public_visit` service-role-only privilege match. |

Do not replay migrations, repair migration history or revoke grants as part of
reconciliation. First obtain a reviewed remediation proposal for the OAuth
privilege conflict, then approve a historical-recording procedure separately.

## Exact fictional-user QA setup — not yet created

Minimum accounts: two unrelated fictional owners, `qa-owner-a@invalid.test`
and `qa-owner-b@invalid.test`, with no shared membership. Each owns exactly one
fictional business: `QA Alpha Trading — fictional` and `QA Beta Services —
fictional`. Do not use real PAN/GSTIN, documents, payment methods or Google
accounts. No accountant/CA role is required for the minimum isolation test.

Expected writes after owner approval: two Auth users, two profile/membership
rows, two businesses, starter chart/subscription rows produced by normal
onboarding, and only test journal drafts. Risks: accidental delivery of auth
email, trial/subscription trigger creation, and leaving test data behind. Use a
controlled test domain/inbox, disable payment/OAuth actions, label every record
`QA`, capture only redacted evidence, and have the named cleanup owner delete
both users and both businesses after sign-off.

Approval required before creating anything: the exact email domain/inbox,
confirmation that this existing project is approved for synthetic writes, the
named cleanup owner, and permission to exercise normal onboarding. Payment,
Razorpay, Google OAuth, migrations, deployment and real-data tests remain out
of scope.

## Local QA evidence

- Branding test passed: 1/1.
- Self-contained Node tests passed: 17/17.
- Hostinger deployment-file check passed; protected anonymous books RPC returned expected HTTP 401.
- Lint passed. The build command completed; a prior fully logged Phase 9 Hostinger build completed successfully, and Phase 10 source changes were documentation/migration-review only.
- The Cloudflare/D1 integration test was not run because it is unrelated to the active Hostinger/Supabase deployment.

## Release decision

**NO-GO.** Blockers are the live OAuth function-grant conflict, unrecorded
migration history, unapplied/uncertified accounting and catalogue migrations,
missing owner-approved pricing/legal rules, and absent authenticated fictional
user QA. Required approvals are: pricing/GST/entitlements/trial decisions;
privacy and terms approval; QA account setup; OAuth grant-remediation plan;
each SQL migration; and final production deployment.
