import { adminClient, allowedOrigins, cors, decryptToken, diagnostic, encryptToken, reply, requireWorkspaceMember, ServiceArea } from '../_shared/google-oauth.ts';

type Input = { serviceArea?: ServiceArea; workspaceId?: string; accessToken?: string };

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Request origin rejected.' }, 403, origin);
  const requestId = crypto.randomUUID();
  try {
    const input = await req.json() as Input;
    const authorization = req.headers.get('authorization') || (input.accessToken ? `Bearer ${input.accessToken}` : '');
    if (!authorization.startsWith('Bearer ') || !input.workspaceId || !['business', 'personal'].includes(input.serviceArea || '')) return reply({ error: 'Sign in and select a workspace.' }, 400, origin);
    const admin = adminClient(), { data: { user } } = await admin.auth.getUser(authorization.slice(7));
    if (!user) return reply({ error: 'Your sign-in session has expired. Please sign in again.' }, 401, origin);
    const serviceArea = input.serviceArea!, workspaceId = input.workspaceId;
    if (!await requireWorkspaceMember(admin, user.id, serviceArea, workspaceId)) return reply({ error: 'You do not have access to this workspace.' }, 403, origin);
    const target = serviceArea === 'business' ? { business_id: workspaceId } : { household_id: workspaceId };
    const { data: connection } = await admin.from('workspace_google_connections').select('id,google_account_email,sync_status').match(target).is('revoked_at', null).maybeSingle();
    if (!connection) return reply({ connected: false }, 200, origin);
    const { data: secret } = await admin.schema('private').from('workspace_google_connection_secrets').select('*').eq('connection_id', connection.id).maybeSingle();
    if (!secret) return reply({ connected: false, needsReauthorization: true }, 200, origin);
    if (new Date(secret.access_token_expires_at).valueOf() <= Date.now() + 60_000) {
      const refreshToken = await decryptToken(secret.refresh_token_ciphertext), clientId = Deno.env.get('GOOGLE_CLIENT_ID'), clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      if (!clientId || !clientSecret) throw new Error('missing_google_client_credentials');
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
      const token = await response.json();
      if (!response.ok || !token.access_token) {
        await admin.from('workspace_google_connections').update({ sync_status: 'needs_reauthorization' }).eq('id', connection.id);
        await diagnostic(admin, { requestId, stage: 'token_refresh', outcome: 'failed', serviceArea, workspaceId, userId: user.id, errorCode: `refresh_${response.status}` });
        return reply({ connected: false, needsReauthorization: true }, 200, origin);
      }
      await admin.schema('private').from('workspace_google_connection_secrets').update({ access_token_ciphertext: await encryptToken(token.access_token), access_token_expires_at: new Date(Date.now() + Math.max(60, Number(token.expires_in || 3600)) * 1000).toISOString(), rotated_at: new Date().toISOString() }).eq('connection_id', connection.id);
      await admin.from('workspace_google_connections').update({ sync_status: 'connected', last_token_refresh_at: new Date().toISOString() }).eq('id', connection.id);
      await diagnostic(admin, { requestId, stage: 'token_refresh', outcome: 'succeeded', serviceArea, workspaceId, userId: user.id });
    }
    return reply({ connected: true, email: connection.google_account_email }, 200, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unexpected_error';
    console.error('google_oauth_status_failed', { requestId, code });
    return reply({ error: 'Unable to check Google Drive connection status.' }, 503, origin);
  }
});
