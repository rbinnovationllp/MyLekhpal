# MyLekhpal: Hostinger deployment

Build in C:\Users\HP\install-this-skill\outputs\mylekhpal:

    npm ci --include=dev
    npm run build

Use Node 22.13 or later. Output folder: dist. No Node start command is needed on static Hostinger hosting.

## Upload

1. Open Hostinger hPanel > mylekhpal.com > File Manager.
2. Back up the existing public_html files.
3. Upload mylekhpal-hostinger.zip and extract directly into public_html.
4. Confirm public_html contains index.html, .htaccess, assets/ and brand/ (not nested inside dist/).
5. Open https://mylekhpal.com and https://mylekhpal.com/workspace.

Upload only built files. Do not upload .env.local, node_modules or the source repository. A source-code Git push alone does not deploy the built files on ordinary PHP/HTML hosting.

The build reads only the public SUPABASE_URL and SUPABASE_ANON_KEY from the existing ignored .env.local. Payment, AI and database secrets are excluded.

Hostinger index-file guidance: https://www.hostinger.com/tutorials/change-index-page-in-htaccess-with-directoryindex/

## Supabase

The core schema already existed. The new 202609090002_hostinger_workspace.sql migration was applied to the configured database on 9 September 2026. It implements authenticated business onboarding, workspace reading and atomic balanced journal drafts. For a fresh database, apply 202609090001 then 202609090002. Do not rerun the original migration where its policies already exist.

Verify Supabase Authentication URL Configuration:
- Site URL: https://mylekhpal.com
- Redirect URL: https://mylekhpal.com/workspace
- If www is used, also https://www.mylekhpal.com/workspace

Email/password sign-in, sign-up, sign-out and password reset are implemented. Email confirmation and recovery delivery depend on Supabase email-provider and redirect settings, and have not been exercised against a real inbox.

## Verification

Production build and focused TypeScript check passed. Eight validation tests and 23 transactional database checks passed. Tests cover precision, duplicate prevention, financial years, balanced drafts, business isolation, auditor write denial and anonymous denial. All database test records were rolled back.

Supabase REST denies anonymous requests (401). Local homepage and workspace return 200. Seven deployment files were checked; no private environment values were found.

This preserves the existing bookkeeping foundation, including journal drafts and exports. AI document processing, payments, review/posting, team invitations and MFA remain unfinished features. Any old Cloudflare data has not been migrated. The retained legacy/tooling dependencies still have npm audit findings; they are not served as a Node runtime by Hostinger.

Hostinger upload remains pending login. No live deployment is claimed yet.
