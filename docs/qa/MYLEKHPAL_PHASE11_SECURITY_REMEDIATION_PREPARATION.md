# MyLekhpal Phase 11 security remediation preparation

Updated: 30 October 2026 (Asia/Kolkata). All database findings were obtained
through read-only catalog inspection. No helper was invoked, no token/state
row was read, and no permission was changed.

## Severity: Critical

All seven helpers below are in the `public` schema, owned by `postgres`, marked
`SECURITY DEFINER`, configured with `search_path=private, public`, and currently
grant `EXECUTE` to `anon`, `authenticated`, and `service_role`. `anon` and
`authenticated` have `USAGE` on `public` but not on `private`. Because `public`
is the Supabase RPC schema, a caller with the corresponding execute privilege
can reach these helpers through `/rest/v1/rpc/<function-name>`.

The definer bypasses the private-table boundary and RLS policy evaluation for
the function operation. No live exploit was attempted.

| Function | What it does | Unauthorized impact | Intended caller/dependency |
| --- | --- | --- | --- |
| `public.google_oauth_log(uuid,text,text,text,uuid,uuid,text)` | Inserts diagnostic events. | Write misleading/forged operational audit records. | Shared `diagnostic()` helper, called by Google Edge Functions. |
| `public.google_oauth_create_state(text,text,uuid,uuid,uuid,timestamptz)` | Inserts one-time OAuth state linked to a workspace/user. | Create attacker-chosen state rows and attempt callback/workspace confusion or denial of service. | `google-drive-connect` Edge Function. |
| `public.google_oauth_consume_state(text)` | Returns and deletes a non-expired state row. | Read workspace/user association and invalidate a pending OAuth state. Legacy helper; no current source caller. | No current Edge Function caller; retained legacy dependency only. |
| `public.google_oauth_lookup_state(text)` | Returns a non-expired state row without deleting it. | Read workspace/user association for a guessed/obtained state hash. | `google-drive-callback` Edge Function. |
| `public.google_oauth_delete_state(text)` | Deletes a state row. | Invalidate another connection attempt if the state hash is known. | `google-drive-callback` Edge Function. |
| `public.google_oauth_store_secret(uuid,text,text,timestamptz)` | Inserts/overwrites encrypted refresh/access-token ciphertext. | Overwrite token ciphertext for a known connection ID, causing account disconnect/denial of service; attacker-supplied ciphertext is not plaintext but corrupts the record. | Callback and token-refresh Edge Functions. |
| `public.google_oauth_get_secret(uuid)` | Returns encrypted refresh/access-token ciphertext and expiry. | Read ciphertext for a known connection ID. Ciphertext still requires the separate Edge secret to decrypt, but disclosure materially increases token compromise risk and violates the isolation design. | `google-drive-status` Edge Function. |

### Exploitability assessment

**Critical, network-reachable authorization flaw.** A caller does not need a
Google account, workspace membership or valid session to invoke these public
RPCs if PostgREST accepts the role’s normal anon/authenticated credential.
Exploitation of state/token functions requires a valid UUID or state hash, so
enumeration is not trivial; however connection IDs can be exposed indirectly
through other defects, logs or authorized users. The state and diagnostic
helpers accept caller-controlled identifiers. The token getter is the highest
confidentiality risk; the token writer/delete/state functions are integrity and
availability risks.

## Search path, ownership and RLS

- Owner `postgres` is normal for managed Supabase migrations, but it makes the
  `SECURITY DEFINER` privilege boundary highly sensitive.
- `search_path=private, public` avoids placing `public` first, and current helper
  SQL explicitly qualifies private tables. It is not the immediate defect. The
  minimum safe correction leaves function bodies and paths unchanged.
- RLS is enabled on private OAuth/state tables, but does not protect callers of
  an over-granted security-definer function.
- The private schema itself is not usable by anon/authenticated; the exposed
  public wrappers are the bypass.

## Prepared minimum correction

Prepared, unapplied migration:
`supabase/migrations/202610300003_google_oauth_rpc_hardening.sql`.

It revokes all execution from `PUBLIC`, `anon` and `authenticated` for every
helper above, then grants only `service_role`. It changes no table, row,
function body, owner, RLS rule, OAuth redirect, token value or frontend code.
`notify pgrst, 'reload schema'` refreshes RPC metadata after the grant change.

### Expected functionality impact

No intended frontend caller exists. The shared Edge helper creates its admin
client with `SUPABASE_SERVICE_ROLE_KEY`; `google-drive-connect`,
`google-drive-callback`, `google-drive-status` and the diagnostic path therefore
continue under `service_role`. No frontend change is required.

Before approval, verify in the Supabase dashboard that each relevant deployed
Edge Function has `SUPABASE_SERVICE_ROLE_KEY`, and perform an approved
synthetic OAuth-flow test afterward. If this verification fails, do **not**
restore public execution: pause the OAuth flow, correct the Edge configuration
and retest.

## Rollback and execution precautions

1. Complete the 12-migration reconciliation record and obtain approval for this
   security migration only.
2. Capture a read-only privilege snapshot for the seven functions.
3. Confirm Edge Function service-role configuration without displaying secrets.
4. Apply the grant-only migration.
5. Verify catalog privileges: anon/authenticated false; service_role true.
6. Execute the owner-approved fictional-user OAuth negative/positive tests.

There is no automatic rollback that regrants `PUBLIC`, `anon` or
`authenticated`, because that would intentionally restore the vulnerability.
The safe recovery path is configuration correction; only a separately approved,
time-limited rollback may alter grants after incident review.

## Subscription pricing review

### Business Accounting

| Family | Monthly and annual plans | AI limit | Price/GST/entitlements | Trial / Razorpay |
| --- | --- | ---: | --- | --- |
| Micro Vendor | Both configured | 50/month | Missing owner decision | 14-day trial; server-side Razorpay mapping configured. |
| Small Business | Both configured | 150/month | Missing owner decision | Same. |
| Business Plus | Both configured | 500/month | Missing owner decision | Same. |
| Accountant / Bookkeeper | Both configured | 1,000/month | Missing owner decision | Same. |
| CA Practice | Both configured | 3,000/month | Missing owner decision | Same. |

The business plan table has no price, GST or public-entitlement fields and RLS
is currently disabled. The prepared public catalogue migration adds those
fields, keeps `razorpay_plan_id` private, enables RLS and publishes an active
view. It remains unapplied; prices must not be inferred from provider IDs.

### Personal Finance

| Plan | Monthly incl. GST | Annual incl. GST | Base monthly / annual | GST | Trial |
| --- | ---: | ---: | ---: | --- |
| Personal Basic | ₹117 | ₹1,179 | ₹99 / ₹999 | 18% | 3 days after verified authorisation |
| Personal Plus | ₹235 | ₹2,359 | ₹199 / ₹1,999 | 18% | Same |
| Professional | ₹471 | ₹4,719 | ₹399 / ₹3,999 | 18% | Same |
| Premium | ₹825 | ₹8,259 | ₹699 / ₹6,999 | 18% | Same |

Personal entitlements are repository catalogue text; exact plan IDs are
configured locally and intentionally omitted from this report. Owner approval
is still required for all price, GST, entitlement, trial and payment wording.

## Fictional-user QA — awaiting approval

Use two unrelated owners and exactly two businesses:

| Owner placeholder | Business | Role | Allowed test data |
| --- | --- | --- | --- |
| Owner A — controlled test inbox to be approved | `QA Alpha Trading — fictional` | Owner only | Synthetic names, invalid-format identifiers, balanced draft journals. |
| Owner B — controlled test inbox to be approved | `QA Beta Services — fictional` | Owner only | Same; no shared membership. |

Expected normal-flow writes after approval: two Auth users, profiles/memberships,
two businesses, starter accounts and trial/subscription rows, plus limited draft
journals. Do not start Razorpay, Google OAuth, Drive, migration or deployment
flows. The approval must name the deliverable test inboxes, authorize those
writes in this existing project, name a cleanup owner, and define evidence
retention. Cleanup deletes both fictional businesses and users after redacted
evidence is accepted.

## Migration readiness and release decision

- Twelve unrecorded migrations: primary relation/function/RLS markers exist;
  Google OAuth grant statements conflict and must be remedied before recording
  history. No migration history changes are authorized.
- Journal-balance guard: prepared and locally reviewed; apply only after the
  migration record is reconciled and a read-only posted-entry preflight passes.
- Public business catalogue: prepared; requires pricing/legal approval and
  checkout compatibility verification before applying.
- OAuth hardening: prepared grant-only migration; highest priority.

**Production decision: NO-GO.** Required approvals: OAuth hardening migration,
fictional-user QA data operations/test inboxes, price/GST/entitlement/trial
rules, legal terms/privacy, individual journal/catalogue migrations, and final
deployment.

## Local validation evidence

- Static coverage check confirmed each of the seven identified helpers appears
  exactly twice in the hardening migration: once in the revoke list and once in
  the `service_role` grant list.
- `node --test tests/branding.test.mjs`: passed (1/1).
- `npm run lint`: passed with no diagnostics.
- `npm run build`: passed; Hostinger Vite production assets were generated.
- These checks validate repository syntax and build compatibility only. They do
  not validate the unapplied privilege change against the live project.
