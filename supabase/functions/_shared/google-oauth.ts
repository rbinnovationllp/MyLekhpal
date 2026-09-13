import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type ServiceArea = 'business' | 'personal';

export const allowedOrigins = new Set(['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173']);
export const cors = (origin: string | null, methods = 'POST, OPTIONS') => origin && allowedOrigins.has(origin)
  ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': methods, vary: 'origin' }
  : {};
export const reply = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(origin || null) },
});
export const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
export const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
export const randomState = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

async function encryptionKey() {
  const encoded = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!encoded) throw new Error('missing_google_token_encryption_key');
  const raw = fromBase64(encoded);
  if (raw.length !== 32) throw new Error('invalid_google_token_encryption_key');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(token)));
  return `v1.${toBase64(iv)}.${toBase64(encrypted)}`;
}

export async function decryptToken(value: string) {
  const [version, ivText, cipherText] = value.split('.');
  if (version !== 'v1' || !ivText || !cipherText) throw new Error('invalid_google_token_ciphertext');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivText) }, await encryptionKey(), fromBase64(cipherText));
  return new TextDecoder().decode(plain);
}

export function oauthRedirectUri() {
  // GOOGLE_REDIRECT_URI is retained as a temporary compatibility alias for
  // the existing deployment. New deployments must use GOOGLE_OAUTH_REDIRECT_URI.
  const configured = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') || Deno.env.get('GOOGLE_REDIRECT_URI');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!configured || !supabaseUrl) throw new Error('missing_google_oauth_configuration');
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const expected = `https://${projectRef}.functions.supabase.co/google-drive-callback`;
  if (configured !== expected) throw new Error('google_redirect_uri_mismatch');
  return configured;
}

export function appUrl() {
  const value = Deno.env.get('MYLEKHAPAL_APP_URL') || 'https://mylekhpal.com';
  if (!['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173'].includes(value)) throw new Error('invalid_mylekhpal_app_url');
  return value;
}

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('missing_supabase_configuration');
  return createClient(url, key);
}

export async function diagnostic(admin: ReturnType<typeof createClient>, event: { requestId: string; stage: string; outcome: 'started' | 'succeeded' | 'failed'; serviceArea?: ServiceArea; workspaceId?: string; userId?: string; errorCode?: string }) {
  // Diagnostics intentionally record only stage/error codes, never auth codes or tokens.
  await admin.schema('private').from('google_oauth_diagnostics').insert({
    request_id: event.requestId, stage: event.stage, outcome: event.outcome,
    service_area: event.serviceArea || null, workspace_id: event.workspaceId || null,
    user_id: event.userId || null, error_code: event.errorCode || null,
  });
}

export async function requireWorkspaceMember(admin: ReturnType<typeof createClient>, userId: string, serviceArea: ServiceArea, workspaceId: string) {
  const table = serviceArea === 'business' ? 'business_memberships' : 'household_memberships';
  const column = serviceArea === 'business' ? 'business_id' : 'household_id';
  // business_memberships has no access_expires_at column; only household
  // memberships support time-limited access.
  const fields = serviceArea === 'business' ? 'role,status' : 'role,status,access_expires_at';
  const { data } = await admin.from(table).select(fields).eq(column, workspaceId).eq('user_id', userId).eq('status', 'active').maybeSingle();
  if (!data || (serviceArea === 'personal' && data.access_expires_at && new Date(data.access_expires_at).valueOf() <= Date.now())) return false;
  return serviceArea === 'business' ? ['owner', 'admin'].includes(data.role) : ['owner'].includes(data.role);
}
