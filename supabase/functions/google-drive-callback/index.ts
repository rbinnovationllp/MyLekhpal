import { adminClient, appUrl, diagnostic, encryptToken, oauthRedirectUri, ServiceArea, sha256 } from '../_shared/google-oauth.ts';

const redirect = (status: 'connected' | 'error', serviceArea: ServiceArea = 'business') =>
  Response.redirect(`${appUrl()}${serviceArea === 'personal' ? '/personal' : '/workspace'}?google_drive=${status}`, 302);

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  let admin: ReturnType<typeof adminClient> | null = null;
  let callbackServiceArea: ServiceArea = 'business';
  try {
    const url = new URL(req.url), providerError = url.searchParams.get('error'), code = url.searchParams.get('code'), state = url.searchParams.get('state');
    if (providerError || !code || !state) throw new Error(providerError ? `provider_${providerError}` : 'missing_callback_parameters');
    admin = adminClient();
    const stateHash = await sha256(state);
    const { data: states, error: stateError } = await admin.rpc('google_oauth_lookup_state', { p_state_hash: stateHash });
    const stateRow = states?.[0];
    if (stateError || !stateRow || new Date(stateRow.expires_at).valueOf() < Date.now()) throw new Error('invalid_or_expired_state');
    const serviceArea = stateRow.service_area as ServiceArea, workspaceId = (stateRow.business_id || stateRow.household_id) as string;
    callbackServiceArea = serviceArea;
    await diagnostic(admin, { requestId, stage: 'callback_received', outcome: 'started', serviceArea, workspaceId, userId: stateRow.user_id });
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID'), clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('missing_google_client_credentials');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: oauthRedirectUri(), grant_type: 'authorization_code' }) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) throw new Error(`token_exchange_${tokenResponse.status}`);
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email || !profile.email_verified) throw new Error(`profile_lookup_${profileResponse.status}`);
    const target = serviceArea === 'business' ? { business_id: stateRow.business_id } : { household_id: stateRow.household_id };
    const { data: existing } = await admin.from('workspace_google_connections').select('id').match(target).is('revoked_at', null).maybeSingle();
    const expiresAt = new Date(Date.now() + Math.max(60, Number(token.expires_in || 3600)) * 1000).toISOString();
    const connectionData = { service_area: serviceArea, ...target, connected_by_user_id: stateRow.user_id, google_account_email: profile.email, scope_granted: String(token.scope || 'openid email https://www.googleapis.com/auth/drive.file'), connected_at: new Date().toISOString(), last_token_refresh_at: new Date().toISOString(), sync_status: 'connected', revoked_at: null };
    const connectionResult = existing ? await admin.from('workspace_google_connections').update(connectionData).eq('id', existing.id).select('id').single() : await admin.from('workspace_google_connections').insert(connectionData).select('id').single();
    if (connectionResult.error || !connectionResult.data) throw new Error('connection_save_failed');
    const refreshToken = token.refresh_token;
    if (!refreshToken && !existing) throw new Error('missing_refresh_token');
    if (refreshToken) {
      const secret = { connection_id: connectionResult.data.id, refresh_token_ciphertext: await encryptToken(refreshToken), access_token_ciphertext: await encryptToken(token.access_token), access_token_expires_at: expiresAt, encryption_version: 1, rotated_at: new Date().toISOString() };
      const { error: secretError } = await admin.rpc('google_oauth_store_secret', { p_connection_id: secret.connection_id, p_refresh: secret.refresh_token_ciphertext, p_access: secret.access_token_ciphertext, p_expires_at: secret.access_token_expires_at });
      if (secretError) throw new Error('token_secret_save_failed');
    }
    await admin.rpc('google_oauth_delete_state', { p_state_hash: stateHash });
    await diagnostic(admin, { requestId, stage: 'connection_saved', outcome: 'succeeded', serviceArea, workspaceId, userId: stateRow.user_id });
    return redirect('connected', serviceArea);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unexpected_error';
    console.error('google_oauth_callback_failed', { requestId, code });
    if (admin) await diagnostic(admin, { requestId, stage: 'callback', outcome: 'failed', errorCode: code });
    return redirect('error', callbackServiceArea);
  }
});
