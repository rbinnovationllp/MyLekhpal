# MyLekhpal Phase 16 — OAuth callback single-use state correction

Updated: 30 October 2026 (Asia/Kolkata). All changes are local only. No
database migration, Edge Function deployment, OAuth connection or customer data
change has occurred.

## Current issue and correction

The callback previously performed `lookup_state`, then provider/token work, then
`delete_state`. Two simultaneous callbacks could both observe the same valid
state before either deleted it.

The existing service-role-only helper
`public.google_oauth_consume_state(text)` already atomically executes:

```sql
delete from private.workspace_google_oauth_states
where state_hash = p_state_hash and expires_at > now()
returning ...;
```

The local callback now hashes the returned state and calls this atomic helper
before any Google token exchange. It no longer calls lookup/delete separately.
Only the first caller receives the state; missing, expired and already-consumed
states return no row and redirect to the generic error route without logging a
code, token or raw state.

## Compatibility and failure behavior

- The callback retains its existing state-hash validation, service-area/user
  binding, server-side token encryption and metadata-only diagnostics.
- A provider/token/profile/storage failure now leaves the state consumed. The
  user must begin a fresh OAuth connection; a reused callback is intentionally
  rejected. This is required for a single-use state guarantee.
- No SQL migration is required for the atomic correction: the consume helper
  already exists, is atomic, and is deployed with service-role-only execute
  permission.
- The required deployment is **only** the updated `google-drive-callback` Edge
  Function, after owner approval. Do not deploy it with any database migration.

## Legacy state relationship

The manually reviewed legacy `google-drive-start` writes to older
`public.google_oauth_states` using service-role credentials. The supported
current flow uses `private.workspace_google_oauth_states` via the protected
helpers. These are separate state stores. Do not merge, delete or migrate the
legacy table until its callback pairing, active traffic and retention policy are
separately reviewed.

The callback correction does not change the legacy endpoint or its table. If
legacy `google-drive-start` targets the current callback, this discrepancy is a
separate functional investigation; do not resolve it by weakening helper grants
or exposing private state.

## Regression coverage

- `tests/oauth-state-atomic.test.mjs` checks that callback source consumes the
  hashed state atomically and no longer calls lookup/delete.
- `tests/sql-google-oauth-state-consumption.sql` is a rollback-only disposable
  database suite for valid, missing, expired and already-consumed states.
- The SQL file includes the required two-session concurrency procedure. It is
  not safe to execute against customer data and has not been executed.

## OAuth grant verification

The seven helpers remain service-role-only after the completed Phase 15
hardening. Before any callback deployment, re-run the Phase 12 grant query and
expect `anon=false`, `authenticated=false`, `service_role=true` for all seven.

## Deployment and rollback procedure — approval required

1. Confirm the callback deployment artifact contains only this consume-state
   change and uses `SUPABASE_SERVICE_ROLE_KEY`.
2. Recheck the seven helper grants read-only.
3. Deploy only `google-drive-callback` through the approved Supabase process.
4. Run approved fictional-user tests for valid, expired, missing,
   already-consumed and concurrency states; do not connect a personal Google
   account or retain token/code/state values in evidence.
5. If the function fails, roll back only to the prior callback artifact through
   the approved deployment process. Never restore browser access to helpers.

## GO/NO-GO

**GO for owner-approved callback-only deployment**, once the rollback artifact,
fictional-user test authorization and legacy-path risk acceptance are recorded.
**NO-GO for a database migration:** no new SQL migration is necessary for this
specific atomic-state correction. Journal, catalogue, legacy-table cleanup and
other migrations remain out of scope.

## Local verification — 30 October 2026

- `node --test` OAuth-state regression plus existing Node suite passed: 20/20.
- Read-only live grant summary reconfirmed: seven helpers found,
  `anon_grants=0`, `authenticated_grants=0`, `service_role_grants=7`.
- The rollback-only SQL fixture and its two-session concurrency procedure are
  prepared but intentionally unexecuted pending fictional-user/disposable
  environment approval.
