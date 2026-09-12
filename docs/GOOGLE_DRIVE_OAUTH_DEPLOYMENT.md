# Google Drive connection deployment

This deployment adds distinct Google Drive connections for Business Accounting and Personal Finance & Tax Support. It does not use browser-held Google secrets or tokens.

## 1. Apply the database migration

In Supabase Dashboard → SQL Editor, run the full contents of:

`supabase/migrations/202609120001_google_workspace_oauth.sql`

It is safe to run once. If it reports an existing object, stop and share the exact error rather than deleting any Google or workspace data.

## 2. Configure Supabase Edge Function secrets

Set these secrets in Supabase Dashboard → Edge Functions → Secrets (or with the Supabase CLI). Do not put them in Hostinger or browser `VITE_` variables.

| Secret | Required value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth web-client ID |
| `GOOGLE_CLIENT_SECRET` | Matching OAuth web-client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://xmotjwexpieudlbqpyno.functions.supabase.co/google-drive-callback` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | a newly generated 32-byte random value encoded in Base64 |
| `MYLEKHAPAL_APP_URL` | `https://mylekhpal.com` |

`GOOGLE_REDIRECT_URI` is accepted only as a temporary backwards-compatible alias. Configure the `GOOGLE_OAUTH_REDIRECT_URI` name above going forward.

Generate the encryption-key value locally in PowerShell; store it in a password manager and Supabase only:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

## 3. Google Cloud Console

For the exact OAuth client referenced above, add this **Authorized redirect URI** exactly:

```text
https://xmotjwexpieudlbqpyno.functions.supabase.co/google-drive-callback
```

There is no trailing slash. Do not substitute `mylekhpal.com`, `www.mylekhpal.com`, HTTP, or a different Supabase project reference. Publish the OAuth consent screen for the intended users and add test users while the Google app remains in Testing.

The connection requests: `openid`, `email`, and `https://www.googleapis.com/auth/drive.file`. It deliberately does not request broad Drive access. Google Sheets files created or explicitly opened by this app are covered by the Drive file permission; separate Sheets API features must request a separately reviewed scope before they are added.

## 4. Deploy Edge Functions

Deploy these three functions after Step 1/2:

```powershell
npx supabase functions deploy google-drive-connect --project-ref xmotjwexpieudlbqpyno --no-verify-jwt
npx supabase functions deploy google-drive-callback --project-ref xmotjwexpieudlbqpyno --no-verify-jwt
npx supabase functions deploy google-drive-status --project-ref xmotjwexpieudlbqpyno --no-verify-jwt
```

Because this repository's `.env.local` contains non-environment plan notes, run the commands from a temporary folder containing only `supabase/`, or use the established staging-copy deployment method. Do not run `npm audit fix` for this deployment.

## 5. Deploy Hostinger frontend

Upload and extract the latest release ZIP into `public_html`, so `index.html`, `.htaccess` and `assets/` are directly in `public_html`. No Hostinger Web Terminal command is required for the static frontend.

## 6. Verify the live flow

1. Sign in at `https://mylekhpal.com` and open a Business or Personal workspace.
2. Choose **Connect Google Drive / Sheets**.
3. Complete the Google consent screen.
4. Confirm return to `/workspace?google_drive=connected` and that the selected workspace says **Google Drive connected**.
5. In Supabase Edge Function logs, inspect only stage/outcome/error-code diagnostics for `google-drive-*`; do not copy tokens into a ticket or chat.

The `google-drive-status` function refreshes an expired access token through the encrypted refresh token. If Google returns an invalid refresh grant it marks the connection as requiring re-authorisation instead of falsely showing it as connected.
