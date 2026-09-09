# MyLekhpal

Accounting workspace with a static Hostinger frontend and Supabase authentication/database.

See [Hostinger deployment instructions](docs/HOSTINGER_DEPLOYMENT.md).

Build with npm ci --include=dev followed by npm run build.
Upload only the contents of dist/ into Hostinger public_html.

The build:cloudflare script and server files are legacy source; use the default build for Hostinger.
