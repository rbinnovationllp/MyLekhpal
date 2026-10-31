# MyLekhpal project status

Updated: 30 October 2026 (Asia/Kolkata)

## QA verification — 30 October 2026

- Corrected customer-facing brand spelling to `MyLekhpal` in the workspace and account views; technical identifiers were not changed.
- `node --test tests/branding.test.mjs`: passed (1/1).
- `npm run lint`: passed with no diagnostics.
- `npm run build`: passed; the skill registry generated successfully and the Hostinger Vite build completed.
- Self-contained Node QA batch passed (17/17): validation, visitor tracking, public-metrics CORS, and progressive-skill-agent tests.
- `node tests/hostinger-build.mjs`: passed; 7 deployment-file checks passed and anonymous Supabase access was denied with HTTP 401.
- API integration test was not run: it requires an isolated local D1 worker at port 3000 and writes synthetic records. No database, migration, or production action was performed.

## Phase 9 preparation

- Prepared, not applied: journal balance guard and public business subscription catalogue migrations. The journal guard was locally corrected to use compatible deferred row triggers and to cover direct insertion of a `posted` entry; it has not been executed against a database.
- The exact read-only reconciliation sequence for the twelve unrecorded migrations is documented in `docs/qa/MYLEKHPAL_MIGRATION_RECONCILIATION.md`. No migration history or catalog was changed.
- The repeated local branding test, lint and Hostinger build all pass. The unrelated Cloudflare/D1 API integration test remains out of scope for the active Hostinger/Supabase deployment.
- No production database, payment, Google OAuth, deployment, or account changes were made.

## Final QA and release assessment — 30 October 2026

- **Production decision: NO-GO.** Local code quality is verified, but deployed-site, authenticated and database-integrity evidence is incomplete.
- **Technical blockers:** protected Supabase books RPC correctly returns HTTP 401 without a signed user JWT; live OAuth helper-function grants conflict with the repository's service-role-only intent; unrecorded-migration history requires approved, statement-level reconciliation; prepared journal-balance and public subscription-catalogue migrations are not approved/applied; no authenticated cross-tenant/onboarding test; no verified live OAuth configuration.
- **Business decisions required:** approved business-plan prices, GST treatment and public entitlement text; trial eligibility and payment/authorisation rules; final subscription-catalogue contract.
- **Legal/security approvals required:** Indian legal approval of the privacy and terms drafts; Google OAuth consent-screen copy, scopes and production redirect URL; written approval of the synthetic-user/two-fictional-business QA protocol and named cleanup owner.
- **Evidence boundary:** ML-05 is verified only by local source checks and the branding test. All tracker statements labelled “local” remain unverified on the deployed site.

## Dependencies before production execution

1. RBIL-approved business prices, GST treatment, and public entitlement summaries.
2. Approval of a statement-level reconciliation record and historical migration-recording procedure.
3. Written authorization for fictional-user/two-fictional-business authenticated QA in the existing project, including cleanup ownership.
4. Legal approval for the privacy and terms text, plus Google OAuth configuration approval.
5. Explicit approval for each production migration separately.

## Phase 10 controlled QA — 30 October 2026

- Read-only endpoint checks confirmed that the anon key reaches Auth settings (HTTP 200), while an anonymous request to the protected books RPC returns the expected HTTP 401. Management API project metadata also returned HTTP 200. No credentials were displayed.
- Read-only catalog inspection found primary markers for all twelve unrecorded migrations and RLS enabled on inspected migration-created tables. It also found a release-blocking OAuth privilege conflict: `anon` and `authenticated` can execute live OAuth helper functions that repository migrations intend to restrict to `service_role`.
- Business subscription plans have provider mappings and AI limits but no price, GST or public-entitlement columns; personal-plan repository prices are GST-inclusive at 18%. Pricing, GST, entitlement, trial and payment decisions remain owner approval items.
- The exact fictional-user QA proposal, SQL readiness review and release decision are recorded in `docs/qa/MYLEKHPAL_PHASE10_CONTROLLED_QA_REPORT.md`. No fictional accounts or records were created.

## Phase 11 security remediation preparation — 30 October 2026

- Read-only catalog inspection confirmed that seven public Google OAuth helpers are `SECURITY DEFINER`, owned by `postgres`, and executable by `anon`, `authenticated` and `service_role`. This is a critical authorization flaw because those helpers bridge to private state/token-ciphertext tables.
- Prepared but unapplied `202610300003_google_oauth_rpc_hardening.sql` revokes public/browser execution and grants only `service_role`. Edge Function source uses `SUPABASE_SERVICE_ROLE_KEY`; no frontend caller or change is expected.
- The complete function-by-function impact, rollback precautions, pricing comparison, fictional-user QA gate and NO-GO assessment are in `docs/qa/MYLEKHPAL_PHASE11_SECURITY_REMEDIATION_PREPARATION.md`.
- Phase 11 local validation passed: all seven helper signatures are covered by the prepared migration, branding test passed (1/1), lint passed and the Hostinger production build passed. The grant change remains unapplied and untested against live Edge Functions.

## Phase 12 OAuth pre-deployment verification — 30 October 2026

- Read-only database preflight reconfirmed all seven helper signatures, current grants and absence of non-function database-object dependents.
- Repository callers use `SUPABASE_SERVICE_ROLE_KEY`; frontend code has no direct protected-helper RPC calls.
- **OAuth hardening execution is NO-GO until the active deployed `google-drive-start` function is classified as unused/retired or verified and redeployed with service-role credentials.** Its deployed source is not available from Management API metadata, so breakage risk cannot be excluded.
- Exact pre/post grant queries and the approval-gated transaction procedure are in `docs/qa/MYLEKHPAL_PHASE12_OAUTH_PREDEPLOYMENT_VERIFICATION.md`.

## Phase 13 legacy Google Drive endpoint investigation — 30 October 2026

- Current Hostinger source and built assets use `google-drive-connect`; they contain no `google-drive-start` reference. A root-level legacy module still references `google-drive-start`, but it is outside the current Hostinger entry graph.
- The deployed legacy function remains active and its source/traffic could not be verified through available Management API metadata; aggregate-only log queries returned HTTP 500. Legacy usage is therefore **unknown**, not assumed unused.
- OAuth hardening remains **NO-GO** until the deployment owner confirms the legacy function is unused or verifies/corrects it to use the service-role client. Full evidence and the safe sequence are in `docs/qa/MYLEKHPAL_PHASE13_LEGACY_GOOGLE_DRIVE_FUNCTION.md`.

## Phase 14 independent release preparation — 30 October 2026

- The 18-test local regression suite, Hostinger deployment-file check and Hostinger production build passed. Full repository lint is not clean because it reports pre-existing mixed-runtime, generated-artifact and shared-component diagnostics; it is not treated as a passing release gate.
- Primary catalog, RLS/policy, index and trigger markers for all twelve unrecorded migrations are now read-only reconciled. The OAuth execute-grant conflict and lack of statement-level provenance remain blockers; no migration history was changed.
- The final consolidated status, manual legacy-function dashboard procedure, fictional-user protocol, pricing approval table and pending SQL approvals are in `docs/qa/MYLEKHPAL_PHASE14_RELEASE_PREPARATION.md`.

## Phase 15 deployed legacy OAuth review — 30 October 2026

- RBIL-supplied source inspection confirms deployed `google-drive-start` authenticates users, checks active Business owner/representative membership, uses `SUPABASE_SERVICE_ROLE_KEY`, writes legacy state through that server-side client and does not call the seven protected helper RPCs.
- This resolves the grant-migration compatibility blocker. The OAuth hardening migration is **GO pending explicit owner approval**, for that migration only. The legacy state-table path and the callback's non-atomic lookup/delete sequence are tracked as separate follow-up hardening items.
- The detailed review, exact signatures and post-grant procedure are in `docs/qa/MYLEKHPAL_PHASE15_DEPLOYED_GOOGLE_DRIVE_START_REVIEW.md`.
- Approved execution through the configured Management API was rejected before any change with `SQLSTATE 25006: cannot execute REVOKE in a read-only transaction`. Post-failure checks confirmed all seven grants remain unchanged. ML-04 now requires an approved writable Supabase migration channel; do not retry through this read-only endpoint.
- RBIL then executed the approved grant-only hardening migration through Supabase Dashboard. Read-only verification confirms all seven helpers deny `PUBLIC`, `anon` and `authenticated`, retain `service_role`, and preserve reviewed ownership, `SECURITY DEFINER`, search path and ACL shape. **ML-04 permission hardening is complete.**

## Phase 16 OAuth callback security — 30 October 2026

- Local callback correction replaces lookup-then-delete with existing atomic `google_oauth_consume_state` before token exchange. No SQL migration is required; only a separately approved `google-drive-callback` Edge Function deployment would be needed.
- Added local atomic-state regression coverage and a rollback-only disposable SQL fixture for valid, expired, missing, already-consumed and two-session concurrency states. Local Node suite passed 20/20.
- Live grant summary remains hardened: zero anon/authenticated grants and seven service-role grants. The detailed procedure and GO/NO-GO assessment are in `docs/qa/MYLEKHPAL_PHASE16_OAUTH_CALLBACK_SECURITY.md`.
