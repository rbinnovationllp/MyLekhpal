# MyLekhpal QA remediation tracker

Audit reviewed: 28 October 2026. Local remediation only; no production data, Supabase secrets, Razorpay configuration or deployment was changed.

## Phase 3 evidence and safety boundary

The existing project is linked to Supabase project `xmotjwexpieudlbqpyno` and contains live-capable Supabase, Razorpay and Google OAuth configuration variables. Their values were not displayed or changed. Record provenance cannot be technically established from schema/configuration alone, so no database mutations, account creation, payment attempts or authenticated external tests were performed. The user must confirm that the linked project contains only fictional records before those tests can proceed.

The development-only `$RefreshSig$` failure was corrected by removing the incompatible React-refresh transform from the static Hostinger Vite configuration. `npm run build` passed afterwards.

## Phase 6 read-only Supabase inspection

Management API connectivity is verified for `xmotjwexpieudlbqpyno`; the public anon key reaches Auth settings (HTTP 200), while the protected books RPC correctly returns HTTP 401 without a signed user JWT. Catalog inspection verified RLS on all financial tables except `subscription_plans`, a business-trial insert trigger, and a write-access trigger on `journal_entries`. The catalog has no aggregate debit=credit constraint or deferred balance trigger across `journal_lines`; row-level debit/credit exclusivity alone does not prevent an unbalanced entry. This is a P1 accounting-integrity correction requiring an approved migration.

Applied migration history ends at `202609100007_personal_finance_isolation`, while later repository migrations are not recorded as applied. This blocks verification of later OAuth, plan catalogue, retention and Google-connection protections. No database records or schema were changed.

## Phase 7 prepared correction

Prepared but unapplied: `202610300001_journal_posting_balance_guard.sql` and `tests/sql-journal-posting-balance.sql`. The guard uses deferred constraint triggers and a parent-row lock to reject unbalanced `posted` entries at commit while allowing incomplete drafts. It must be applied only after migration-history reconciliation, a read-only check of existing posted entries, and approval to execute against confirmed synthetic records.

Approved aggregate preflight found zero posted entries and zero unbalanced posted entries. The configured anon key is valid for Auth settings; the HTTP 401 observed on `mylekhpal_books` is the expected result of calling the protected RPC without a signed user JWT. Ordinary-user authentication/RLS verification still requires the owner-approved fictional-user QA setup.

## Phase 10 controlled read-only evidence — 30 October 2026

- The public anon key is valid: `GET /auth/v1/settings` returned HTTP 200. The earlier HTTP 401 is expected because `POST /rest/v1/rpc/mylekhpal_books` was made with the anon key but without a signed user JWT; that protected RPC rejects anonymous callers. The Management API project-metadata request returned HTTP 200 using the management access token. No credential values or response bodies were recorded.
- All primary relation/function markers for the twelve unrecorded migrations exist in the live catalog. RLS is enabled on every inspected migration-created table, and the expected select-policy names were present on the public plan, subscription, Google connection, storage allowance, personal-draft and Google-target tables.
- **Security conflict:** the live Google OAuth helper functions are `SECURITY DEFINER` and have execute privilege for `anon` and `authenticated`, although repository migrations `202609130007` and `202609140001` intend service-role-only execution. Do not treat those migrations as reconciled or modify grants without separate approval.

| ID | Status | Evidence / action |
| --- | --- | --- |
| ML-01 | PARTIAL — local only | Draft `/privacy` route and footer link are present. The copy explicitly says it is non-binding pending RBIL/legal approval. Deployed-route availability and legal sufficiency are unverified. |
| ML-02 | PARTIAL — local only | Draft `/terms` route is present and explicitly non-binding; no acceptance requirement was activated. Legal approval must determine the final terms and any acceptance/version-recording requirement. |
| ML-03 / ML-13 | VERIFIED (local build) | Public `/personal` and `/pricing` marketing view now shows catalogue-derived prices before sign-in. Protected workspace remains at `/workspace?service=personal`. |
| ML-04 | VERIFIED — deployed permission hardening | RBIL executed the reviewed hardening SQL in Supabase Dashboard. Read-only verification confirms all seven helpers deny `PUBLIC`, `anon` and `authenticated`, while `service_role` retains execute; ownership, `SECURITY DEFINER` and search-path configuration remain as reviewed. A local callback change now uses existing atomic state consumption; its separate Edge Function deployment remains approval-gated. Legacy-state cleanup is a separate follow-up. |
| ML-05 | VERIFIED — local source/test only | `node --test tests/branding.test.mjs` passed (1/1) after correcting all test-listed customer-facing sources, including workspace/account copy. A focused local source check also corrected the legal-page brand header. No deployed-site crawl or deployed asset verification was performed. |
| ML-06 | PARTIAL — deployed definition verified | The UI restricts entity type and state to controlled selections. Read-only inspection of live `mylekhpal_books(jsonb)` confirmed field-length, membership, active-business account and onboarding-confirmation validation markers. Authenticated behaviour remains untested. |
| ML-07 | VERIFIED (local build) | Hostinger rewrite list now covers the specified valid routes while unknown paths remain 404s. |
| ML-08 | VERIFIED (existing) | Existing homepage has an illustrative product dashboard; it is explicitly labelled illustrative. |
| ML-09 | VERIFIED (existing) | `public/favicon.svg` is referenced by `index.html`. |
| ML-10 | PARTIAL — deployed definition verified | Browser PAN/GSTIN checks are present and read-only inspection of live `mylekhpal_books(jsonb)` confirmed both PAN-format and GSTIN/PAN-match validation markers. Authenticated boundary behaviour remains untested; the unrelated Cloudflare/D1 test was not run. |
| ML-11 | VERIFIED (local build) | 44px native mobile disclosure menu added for the public header. |
| ML-12 | PARTIAL — local source review | The onboarding form uses a native `onSubmit` handler with required legal-name/year fields and a controlled submit path. No authenticated keyboard, focus-order, or persisted-onboarding test was run against the active site. |

## Phase 14 verification update — 30 October 2026

- Safe local regression evidence: 18 Node tests passed; Hostinger deployment-file verification passed; `npm run build` passed.
- `npm run lint` is **not** a clean release gate: it reports pre-existing mixed-runtime issues in Deno Edge Function files, generated deployment-stage artifacts, and shared UI components. Those diagnostics were not suppressed or changed in this release-preparation pass.
- ML-01, ML-02 and ML-12 remain legal/authenticated-QA dependent. ML-06 and ML-10 retain deployed-definition evidence but require fictional-user behavioral tests. ML-04 remains blocked by OAuth helper grants and unknown legacy `google-drive-start` usage.
