# Phase 17: Google OAuth callback deployment preflight

Status: CONDITIONAL NO-GO pending confirmation of deployed Edge Function secret names.

## Verified locally

- `google-drive-callback` uses `adminClient()` and invokes `google_oauth_consume_state` before exchanging the Google code.
- `google_oauth_consume_state(text)` is a `SECURITY DEFINER` helper that atomically deletes and returns only an unexpired row from `private.workspace_google_oauth_states`.  Its returned context is `service_area`, `business_id`, `household_id`, `user_id`, and `expires_at`.
- The hardening migration grants the helper only to `service_role`; the prior live verification recorded no effective `PUBLIC`, `anon`, or `authenticated` access.
- The expected redirect URL is `https://xmotjwexpieudlbqpyno.functions.supabase.co/google-drive-callback`; the local non-secret configuration agrees.
- The patch is confined to `google-drive-callback`; it does not change `google-drive-start`.

## Required dashboard preflight before deployment

In Supabase Dashboard, open Project Settings > Edge Functions > Secrets and confirm the names (not values) `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_TOKEN_ENCRYPTION_KEY` are present. Confirm Google Cloud OAuth authorized redirect URI exactly equals the expected redirect URL above. The local `.env.local` uses `SUPABASE_SECRET_KEY`, but the deployed function source requires `SUPABASE_SERVICE_ROLE_KEY`; do not infer deployed configuration from that local alias.

## Rollback artifact

To roll back only this callback change, redeploy the immediately preceding source revision whose callback uses `google_oauth_lookup_state` before the provider call and `google_oauth_delete_state` after token persistence. This is intentionally not an automatic rollback: it restores replay exposure and requires a separate owner decision. Do not alter database grants.

## Approved-command candidate after owner confirmation

`npx supabase functions deploy google-drive-callback --project-ref xmotjwexpieudlbqpyno --no-verify-jwt`

`--no-verify-jwt` is required because Google's browser redirect does not include a Supabase bearer token. The deployment must be followed by an isolated fictional-user OAuth regression test and a metadata/error-log review that does not reveal tokens, codes, or state values.
