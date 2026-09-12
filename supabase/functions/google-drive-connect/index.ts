import { adminClient, allowedOrigins, cors, diagnostic, oauthRedirectUri, randomState, reply, requireWorkspaceMember, ServiceArea, sha256 } from '../_shared/google-oauth.ts';

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
    if (!authorization.startsWith('Bearer ') || !input.workspaceId || !['business', 'personal'].includes(input.serviceArea || '')) return reply({ error: 'Sign in and select a workspace to connect Google Drive.' }, 400, origin);
    const admin = adminClient();
    const { data: { user } } = await admin.auth.getUser(authorization.slice(7));
    if (!user) return reply({ error: 'Your sign-in session has expired. Please sign in again.' }, 401, origin);
    const serviceArea = input.serviceArea!;
    if (!await requireWorkspaceMember(admin, user.id, serviceArea, input.workspaceId)) return reply({ error: 'Only the workspace owner can connect Google Drive.' }, 403, origin);
    await diagnostic(admin, { requestId, stage: 'authorization_started', outcome: 'started', serviceArea, workspaceId: input.workspaceId, userId: user.id });
    const target = serviceArea === 'business' ? { business_id: input.workspaceId } : { household_id: input.workspaceId };
    const { data: connection } = await admin.from('workspace_google_connections').select('id,sync_status,revoked_at').match(target).is('revoked_at', null).maybeSingle();
    if (connection?.sync_status === 'connected') return reply({ connected: true }, 200, origin);
    const state = randomState();
    const { error: stateError } = await admin.schema('private').from('workspace_google_oauth_states').insert({
      state_hash: await sha256(state), service_area: serviceArea, ...target, user_id: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (stateError) throw new Error('oauth_state_save_failed');
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    if (!clientId) throw new Error('missing_google_client_id');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: oauthRedirectUri(), response_type: 'code', scope: 'openid email https://www.googleapis.com/auth/drive.file', state, access_type: 'offline', include_granted_scopes: 'true' }).toString();
    await diagnostic(admin, { requestId, stage: 'authorization_url_created', outcome: 'succeeded', serviceArea, workspaceId: input.workspaceId, userId: user.id });
    return reply({ authorizationUrl: url.toString() }, 200, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unexpected_error';
    console.error('google_oauth_connect_failed', { requestId, code });
    try { await diagnostic(adminClient(), { requestId, stage: 'authorization_start', outcome: 'failed', errorCode: code }); } catch { /* configuration may itself be absent */ }
    return reply({ error: 'Unable to start the secure Google Drive connection. Please contact support if this continues.' }, 503, origin);
  }
});
