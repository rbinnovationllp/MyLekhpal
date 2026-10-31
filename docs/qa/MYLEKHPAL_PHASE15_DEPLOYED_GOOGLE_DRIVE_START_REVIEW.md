# MyLekhpal Phase 15 — deployed `google-drive-start` review

Updated: 30 October 2026 (Asia/Kolkata). This records owner-supplied manual
inspection evidence plus read-only repository/catalog verification. No
function, token, user, record, grant, migration or deployment was changed.

## Manual deployed-source evidence accepted

RBIL supplied the following inspection findings for deployed
`google-drive-start`:

1. It authenticates the caller using Supabase `auth.getUser()`.
2. It checks active Business owner/representative membership.
3. It creates its administrative client using `SUPABASE_SERVICE_ROLE_KEY`.
4. It writes OAuth state through that administrative client to the legacy
   `google_oauth_states` table.
5. It does not call any of the seven `google_oauth_*` RPC helpers.

This removes the Phase 13 grant-migration blocker. The legacy function is not
proven unused, but the prepared grant migration does not alter its direct
service-role table write or any function it calls.

## Supported deployed workflow review

The reviewed repository source for the active supported workflow shows:

| Function | Server-side credential / authorization | Protected helper use |
| --- | --- | --- |
| `google-drive-connect` | Creates service-role admin client; validates bearer session with `auth.getUser()` and owner/admin workspace membership. | Creates a hashed, 10-minute OAuth state with `google_oauth_create_state`. |
| `google-drive-callback` | Creates service-role admin client; hashes returned state before lookup. | Looks up state, encrypts returned tokens before storage, stores token ciphertext, then deletes state. |
| `google-drive-status` | Creates service-role admin client; validates bearer session and workspace membership. | Retrieves ciphertext only through `google_oauth_get_secret`; decrypts/refreshes server-side; overwrites ciphertext through `google_oauth_store_secret`. |
| Diagnostic path | Uses same service-role admin client. | Writes metadata-only events through `google_oauth_log`. |

No browser source directly invokes any of the seven protected helpers. The
current Hostinger build invokes `google-drive-connect`, not
`google-drive-start`.

### Callback state handling

The callback hashes the browser-returned state, requires a matching unexpired
row, derives the service area/workspace/user from that row, and encrypts tokens
before storage. It deletes the state only after a successful connection save,
which avoids losing the state on an earlier provider/storage failure.

The lookup and later delete are not one atomic consume operation: two concurrent
callbacks carrying the same valid state could both pass lookup before either
deletes it. This is a follow-up reliability/security hardening candidate (use
an atomic consume after a carefully designed connection write), but it does not
require nor justify public execution of token/state helper RPCs. It is not a
blocker for the grant-only migration.

## `google-drive-start` follow-up scope

The manual evidence states that the legacy endpoint writes to the older
`google_oauth_states` table rather than calling the seven protected RPC helpers.
That legacy state path should be reconciled with the current
`workspace_google_oauth_states` callback path in a separately approved legacy
OAuth cleanup. It is a functional-maintenance item, not a dependency of
`202610300003_google_oauth_rpc_hardening.sql`.

## Hardening migration review

`202610300003_google_oauth_rpc_hardening.sql` exactly covers these signatures:

- `google_oauth_log(uuid,text,text,text,uuid,uuid,text)`
- `google_oauth_create_state(text,text,uuid,uuid,uuid,timestamptz)`
- `google_oauth_consume_state(text)`
- `google_oauth_store_secret(uuid,text,text,timestamptz)`
- `google_oauth_get_secret(uuid)`
- `google_oauth_lookup_state(text)`
- `google_oauth_delete_state(text)`

For each signature, it revokes execution from `PUBLIC`, `anon` and
`authenticated`, then grants only `service_role`, within one transaction. A
static local coverage check confirmed one revoke and one service-role grant for
each of the seven helpers. No database-object dependent was found in the
read-only catalog preflight.

## Preflight and post-migration grant checks

Run the queries in
`docs/qa/MYLEKHPAL_PHASE12_OAUTH_PREDEPLOYMENT_VERIFICATION.md` immediately
before and after execution. Expected post-migration result for every signature:

```text
anon_execute=false
authenticated_execute=false
service_role_execute=true
```

If the transaction fails, PostgreSQL rolls back all grant changes. If a
supported function later fails, correct/redeploy its server-side service-role
configuration; do not regrant browser/public execution. The safe regression
test uses only separately approved fictional accounts and must not connect a
personal Google Drive.

## Final decision: GO for only OAuth hardening

**GO**, subject to explicit owner approval, for executing only
`202610300003_google_oauth_rpc_hardening.sql`.

This decision does not authorize: legacy-function deletion/redeployment,
journal-balance or public-catalogue migration, migration-history changes,
fictional-user creation, payment, Google OAuth initiation, or application
deployment.

After approval: apply the one grant-only migration; run the post-grant query;
then schedule the separate approved fictional-user regression plan. Keep the
legacy `google-drive-start` endpoint unchanged until its older state path is
reviewed in a separate task.

## Approved execution attempt — 30 October 2026

RBIL approved execution of only `202610300003_google_oauth_rpc_hardening.sql`.
Preflight reconfirmed all seven exact signatures, their `postgres` ownership,
`SECURITY DEFINER` setting, current grants, service-role retention, absence of
non-function database-object dependents, and the local migration's single
`begin`/`commit` transaction boundary.

The configured Supabase Management API database-query endpoint rejected the
write before any grant changed:

```text
HTTP 400
ERROR: 25006: cannot execute REVOKE in a read-only transaction
```

The post-failure read-only grant query confirmed every function is unchanged:
`anon_execute=true`, `authenticated_execute=true`, and
`service_role_execute=true` for all seven signatures. No rollback was needed,
and no insecure permission was restored.

The next action requires a separately available **writable** Supabase migration
channel (Dashboard SQL Editor in a write-enabled session, Supabase CLI linked
to this project, or an approved deployment pipeline). Reuse the same reviewed
migration unchanged, then run the documented post-grant query immediately. Do
not retry through the read-only Management API database-query endpoint.

## Dashboard execution verification — 30 October 2026

RBIL subsequently executed the reviewed SQL through Supabase Dashboard. A
read-only live-catalog verification found all seven expected signatures and
confirmed the completed security state for each:

```text
PUBLIC execute        false
anon execute          false
authenticated execute false
service_role execute  true
owner                 postgres
security definer      true
search_path           private, public
ACL                   postgres and service_role only
```

No unexpected helper signature, owner, ACL, security-definer flag or search-path
change was found. The OAuth helper permission hardening is complete.
