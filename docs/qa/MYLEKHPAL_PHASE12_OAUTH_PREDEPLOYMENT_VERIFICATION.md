# MyLekhpal Phase 12 OAuth security pre-deployment verification

Updated: 30 October 2026 (Asia/Kolkata). All live checks were read-only. No
function was invoked, no secret/token/state row was accessed, and no grant,
record, function or deployment was changed.

## Verification result

### Database helpers

All seven target helpers are present in `public`, owned by `postgres`, marked
`SECURITY DEFINER`, and use `search_path=private, public`:

1. `public.google_oauth_log(uuid,text,text,text,uuid,uuid,text)`
2. `public.google_oauth_create_state(text,text,uuid,uuid,uuid,timestamp with time zone)`
3. `public.google_oauth_consume_state(text)`
4. `public.google_oauth_store_secret(uuid,text,text,timestamp with time zone)`
5. `public.google_oauth_get_secret(uuid)`
6. `public.google_oauth_lookup_state(text)`
7. `public.google_oauth_delete_state(text)`

Read-only preflight confirms each currently grants execution to `anon`,
`authenticated` and `service_role`. No helper has a non-function database-object
dependent, so the grant-only correction cannot break a trigger, view, policy or
stored database caller.

### Intended callers and frontend exposure

Repository source confirms that the current `google-drive-connect`,
`google-drive-callback`, `google-drive-status` and diagnostic paths construct
their RPC client with `SUPABASE_SERVICE_ROLE_KEY`. The frontend source has no
direct reference to any of the seven helper names. Therefore the current source
does not require a frontend change and its intended Edge Function paths should
retain access after service-role-only grants.

### Deployed function inventory limitation

The Management API shows active deployments for `google-drive-connect`,
`google-drive-callback`, `google-drive-status`, `sync-google-journal` and
`configure-google-journal-target`. It also shows an active
`google-drive-start` deployment that has no matching local source directory.
Management metadata does not expose the deployed source or secret use. Its
service-role behavior is therefore **not proven**.

This is the only identified unverified breakage path. It may be a legacy
endpoint; if it calls the protected helpers using a browser/anon credential,
the hardening migration will correctly deny it. That is secure behavior, but it
could interrupt an existing Google-connect flow until the endpoint is retired
or redeployed with the service-role client.

## Prepared migration review

`supabase/migrations/202610300003_google_oauth_rpc_hardening.sql`:

- revokes all execution from `PUBLIC`, `anon` and `authenticated` for every
  target signature;
- grants execute only to `service_role` for every target signature;
- changes no function body, owner, search path, RLS policy, token/state row,
  Google credential, frontend asset or Edge deployment;
- executes within one `begin`/`commit` transaction and requests PostgREST schema
  metadata reload only after the grant statements.

The migration correctly preserves `service_role` access. It also removes role-
specific grants that may persist independently of a `PUBLIC` revoke.

## Read-only pre-migration query

Run with the approved database-management read-only connection and retain only
the boolean result rows; do not return OAuth table data.

```sql
with f as (
  select p.oid,
         n.nspname || '.' || p.proname || '(' ||
         pg_get_function_identity_arguments(p.oid) || ')' as signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'google_oauth_log', 'google_oauth_create_state',
      'google_oauth_consume_state', 'google_oauth_store_secret',
      'google_oauth_get_secret', 'google_oauth_lookup_state',
      'google_oauth_delete_state'
    )
)
select signature,
       has_function_privilege('anon', oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', oid, 'EXECUTE') as service_role_execute
from f
order by signature;
```

Expected pre-apply state: `anon_execute=true`, `authenticated_execute=true`,
`service_role_execute=true` for all seven functions.

## Read-only post-migration verification query

Run the same query immediately after commit. Expected result for every row:

```text
anon_execute=false
authenticated_execute=false
service_role_execute=true
```

Also verify the exact deployed Google-connect endpoint set in the Supabase
dashboard or deployment audit: identify whether `google-drive-start` receives
traffic; if yes, inspect/redeploy its source so it uses
`SUPABASE_SERVICE_ROLE_KEY` before applying the migration.

## Safe execution procedure — only after separate approval

1. Take the preflight privilege snapshot above and record deployment versions.
2. Confirm the deployed `google-drive-start` status: retire it if unused, or
   inspect/redeploy it with the service-role client if used.
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is configured for all deployed Google
   OAuth Edge Functions without displaying its value.
4. Temporarily avoid beginning new Google OAuth connections while the change is
   applied; no customer record migration or token change is involved.
5. Apply **only** `202610300003_google_oauth_rpc_hardening.sql` as one
   transaction. If any statement fails, PostgreSQL rolls the entire transaction
   back; stop and preserve the error identifier.
6. Run the post-migration grant query. If it differs from the expected state,
   stop; do not issue compensating public grants.
7. With separately approved fictional users only, test an OAuth start/callback
   path and a disconnected-status path. Do not access a personal Google Drive
   or use a real customer account.

## Failure handling and safe rollback

If an intended Edge Function fails after the change, do not restore `PUBLIC`,
`anon` or `authenticated` execution. First correct the Edge Function’s
service-role configuration/source and redeploy it under separate approval. A
time-limited exception, if ever required, must be a separately reviewed
incident decision with a named expiry and remediation plan; it is not part of
this migration rollback.

## Final GO/NO-GO for OAuth hardening execution

**NO-GO at this moment.** The migration itself is minimal, internally
consistent, transaction-safe, and ready. However, the active deployed
`google-drive-start` endpoint cannot be matched to reviewed local source or
confirmed to use service-role credentials. Applying the migration before that
endpoint is classified or retired could break a live Google OAuth entry point.

Once RBIL confirms `google-drive-start` is unused/retired or verifies and
redeploys it with the service-role client, the recommendation becomes **GO for
this OAuth hardening migration only**, followed immediately by the post-grant
query and fictional-user verification. Journal-balance, public-pricing,
subscription, migration-history and application deployment changes remain
explicitly out of scope.
