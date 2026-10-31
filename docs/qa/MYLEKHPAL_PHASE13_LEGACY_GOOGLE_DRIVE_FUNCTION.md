# MyLekhpal Phase 13 — legacy `google-drive-start` investigation

Updated: 30 October 2026 (Asia/Kolkata). Investigation was read-only. No Edge
Function, database grant, record, OAuth flow or Google Drive account was changed.

## Conclusion: unknown legacy usage; not safe to retire or harden around yet

`google-drive-start` is active in the Supabase deployment inventory (version
31), but no matching deployed source can be retrieved through the available
Management API metadata. Its current invocation history also could not be
verified: the supported read-only aggregate logs endpoint returned HTTP 500 for
two minimal aggregate queries, including a one-hour capability check. No logs
were read or disclosed.

It is therefore not proven unused. Do not delete, disable or assume it is
service-role-safe.

## Evidence

| Finding | Evidence | Interpretation |
| --- | --- | --- |
| Legacy source remains in repository | Root `supabase.ts` exports `startGoogleDriveConnection()` and invokes `google-drive-start`. | A legacy caller existed. |
| Legacy module is outside current Hostinger entry graph | `index.html` loads `hostinger/main.tsx`; that route uses `hostinger/account.tsx` and `hostinger/supabase.ts`. The root `account.tsx` imports root `supabase.ts`, but is not the Hostinger entrypoint. | Current build path does not import the legacy helper. |
| Current bundle excludes legacy endpoint | Read-only scan of `dist/` after `npm run build` found no `google-drive-start` string. | Current built Hostinger assets do not call it. |
| Supported initiation endpoint | `app/workspace/workspace.tsx` and `app/personal-workspace.tsx` call `googleDriveRequest('google-drive-connect', ...)`; deployment guide deploys `google-drive-connect`, `google-drive-callback`, and `google-drive-status`. | The supported Business and Personal OAuth workflow is `google-drive-connect` → `google-drive-callback` → `google-drive-status`. |
| Active deployed legacy endpoint | Supabase Management API lists active `google-drive-start` in addition to active `google-drive-connect`, callback and status functions. | The endpoint could serve old clients, old pages, external links or an untracked deployment. |
| Deployment logs | Aggregate-only Management API log requests returned HTTP 500. | No conclusion about use can be drawn from the unavailable logs. |

## Security configuration findings

The supported local OAuth Edge Functions create an admin client using
`SUPABASE_SERVICE_ROLE_KEY` and call the protected helpers only through that
client. No browser source directly calls the helpers. The unknown legacy
function cannot be verified to follow this pattern.

If it calls protected helpers with an anonymous/browser credential, the prepared
OAuth hardening migration will deny those calls. That is the correct security
result but could interrupt an existing legacy connection/reconnection path.

## Safe next steps — owner approval required

### Path A: prove legacy endpoint unused

1. In the Supabase dashboard, inspect Function invocation history for
   `google-drive-start` across the available retention window, without copying
   request bodies, headers, states, tokens or account information.
2. Search every served/legacy hostname, CDN/static artifact, redirect rule and
   release archive for `google-drive-start`.
3. Record a dated no-traffic/no-reference finding and identify the owner who
   accepts the residual retention-window limitation.
4. Keep the function active initially; apply OAuth hardening only after the
   record is approved. Retirement/deletion is a separate later change.

### Path B: legacy endpoint is used or cannot be proven unused

1. Obtain the deployed source from the deployment owner or Supabase dashboard;
   do not use a personal Google account to test it.
2. Verify it authenticates the calling user, checks workspace membership, and
   creates its RPC client with `SUPABASE_SERVICE_ROLE_KEY` before calling any
   protected OAuth helper.
3. If any point fails, create/review a replacement using the supported
   `google-drive-connect` behavior, deploy it only under separate approval, and
   retain compatibility until traffic is migrated.
4. Run approved fictional-user regression tests before retiring the legacy
   endpoint or applying the hardening migration.

## OAuth hardening decision and sequence

**NO-GO** for `202610300003_google_oauth_rpc_hardening.sql` while
`google-drive-start` remains unclassified.

Once Path A or B is approved and completed:

1. Correct or document the legacy endpoint; do not delete it in the same
   change as privilege hardening.
2. Capture the documented read-only pre-grant snapshot.
3. Apply only `202610300003_google_oauth_rpc_hardening.sql` in its transaction.
4. Verify `anon=false`, `authenticated=false`, `service_role=true` for all
   seven helper signatures.
5. With approved fictional accounts only, test supported OAuth initiation,
   callback/connection status and reconnection failure handling—without opening
   personal Google Drive or creating real customer connections.
6. Retire the legacy endpoint only in a separately approved change after the
   supported workflow remains stable.

The journal-balance and public subscription-catalogue migrations remain out of
scope and must not be applied in this sequence.
