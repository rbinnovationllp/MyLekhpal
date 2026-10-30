# MyLekhpal QA remediation tracker

Audit reviewed: 28 October 2026. Local remediation only; no production data, Supabase secrets, Razorpay configuration or deployment was changed.

## Phase 3 evidence and safety boundary

The existing project is linked to Supabase project `xmotjwexpieudlbqpyno` and contains live-capable Supabase, Razorpay and Google OAuth configuration variables. Their values were not displayed or changed. Record provenance cannot be technically established from schema/configuration alone, so no database mutations, account creation, payment attempts or authenticated external tests were performed. The user must confirm that the linked project contains only fictional records before those tests can proceed.

The development-only `$RefreshSig$` failure was corrected by removing the incompatible React-refresh transform from the static Hostinger Vite configuration. `npm run build` passed afterwards.

## Phase 6 read-only Supabase inspection

Management API connectivity is verified for `xmotjwexpieudlbqpyno`; the configured public API key is still rejected with HTTP 401 and must be replaced before normal browser authentication can be tested. Catalog inspection verified RLS on all financial tables except `subscription_plans`, a business-trial insert trigger, and a write-access trigger on `journal_entries`. The catalog has no aggregate debit=credit constraint or deferred balance trigger across `journal_lines`; row-level debit/credit exclusivity alone does not prevent an unbalanced entry. This is a P1 accounting-integrity correction requiring an approved migration.

Applied migration history ends at `202609100007_personal_finance_isolation`, while later repository migrations are not recorded as applied. This blocks verification of later OAuth, plan catalogue, retention and Google-connection protections. No database records or schema were changed.

## Phase 7 prepared correction

Prepared but unapplied: `202610300001_journal_posting_balance_guard.sql` and `tests/sql-journal-posting-balance.sql`. The guard uses deferred constraint triggers and a parent-row lock to reject unbalanced `posted` entries at commit while allowing incomplete drafts. It must be applied only after migration-history reconciliation, a read-only check of existing posted entries, and approval to execute against confirmed synthetic records.

Approved aggregate preflight found zero posted entries and zero unbalanced posted entries. `SUPABASE_ANON_KEY` remains invalid (HTTP 401), so no ordinary-user authentication/RLS verification could be performed.

| ID | Status | Evidence / action |
| --- | --- | --- |
| ML-01 | PARTIAL | Draft `/privacy` route and footer link added. RBIL/legal approval remains required. |
| ML-02 | PARTIAL | Draft `/terms` route added; no acceptance requirement was activated. |
| ML-03 / ML-13 | VERIFIED (local build) | Public `/personal` and `/pricing` marketing view now shows catalogue-derived prices before sign-in. Protected workspace remains at `/workspace?service=personal`. |
| ML-04 | PARTIAL | Code review confirms per-user OAuth, token refresh and a truthful disconnected state. Live Edge Function logs/configuration were not accessed. |
| ML-05 | PARTIAL | Public homepage typo corrected; legacy/internal occurrences require a separately approved content sweep. |
| ML-06 | PARTIAL | Active Hostinger workspace has controlled entity/state selections. Supabase RPC server validation needs a migration/code review before it can be marked verified. |
| ML-07 | VERIFIED (local build) | Hostinger rewrite list now covers the specified valid routes while unknown paths remain 404s. |
| ML-08 | VERIFIED (existing) | Existing homepage has an illustrative product dashboard; it is explicitly labelled illustrative. |
| ML-09 | VERIFIED (existing) | `public/favicon.svg` is referenced by `index.html`. |
| ML-10 | PARTIAL | Browser PAN/GSTIN format validation added; existing Cloudflare API validates formats, but active Supabase RPC validation needs live-schema review. |
| ML-11 | VERIFIED (local build) | 44px native mobile disclosure menu added for the public header. |
| ML-12 | PARTIAL | Active onboarding submit button is explicit. No live authenticated keyboard test was run. |
