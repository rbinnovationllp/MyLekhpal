// @ts-ignore: Deno URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export type ServiceArea = 'business' | 'personal';

export const allowedOrigins = new Set([
  'https://mylekhpal.com',
  'https://www.mylekhpal.com',
  'http://localhost:5173',
]);

export const cors = (origin: string | null, methods = 'POST, OPTIONS'): Record<string, string> => {
  if (origin && allowedOrigins.has(origin)) {
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
      'access-control-allow-methods': methods,
      vary: 'origin',
    };
  }
  return {};
};

export const reply = (body: unknown, status = 200, origin?: string | null): Response => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    ...cors(origin || null),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
};

export const sha256 = async (value: string): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

export const randomState = (): string => base64url(crypto.getRandomValues(new Uint8Array(32)));

const fromBase64 = (value: string): Uint8Array => {
  const sanitized = value.trim().replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(sanitized), (char) => char.charCodeAt(0));
};

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

async function encryptionKey(): Promise<CryptoKey> {
  const encoded = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!encoded) throw new Error('missing_google_token_encryption_key');
  const raw = fromBase64(encoded);
  if (raw.length !== 32) throw new Error('invalid_google_token_encryption_key');
  return crypto.subtle.importKey('raw', raw as unknown as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(token);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      await encryptionKey(),
      data as unknown as BufferSource
    )
  );
  return `v1.${toBase64(iv)}.${toBase64(encrypted)}`;
}

export async function decryptToken(value: string): Promise<string> {
  const [version, ivText, cipherText] = value.split('.');
  if (version !== 'v1' || !ivText || !cipherText) throw new Error('invalid_google_token_ciphertext');
  const iv = fromBase64(ivText);
  const cipher = fromBase64(cipherText);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    await encryptionKey(),
    cipher as unknown as BufferSource
  );
  return new TextDecoder().decode(plain);
}

export function oauthRedirectUri(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('missing_supabase_configuration');

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const expected = `https://${projectRef}.functions.supabase.co/google-drive-callback`;

  const configured = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') || Deno.env.get('GOOGLE_REDIRECT_URI') || expected;
  if (configured.replace(/\/$/, '') !== expected) throw new Error('google_redirect_uri_mismatch');
  return expected;
}

export function appUrl(): string {
  const value = Deno.env.get('MYLEKHAPAL_APP_URL') || 'https://mylekhpal.com';
  if (!['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173'].includes(value)) {
    throw new Error('invalid_mylekhpal_app_url');
  }
  return value;
}

export function adminClient(): ReturnType<typeof createClient> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('missing_supabase_configuration');
  return createClient(url, key);
}

export async function diagnostic(
  admin: ReturnType<typeof createClient>,
  event: {
    requestId: string;
    stage: string;
    outcome: 'started' | 'succeeded' | 'failed';
    serviceArea?: ServiceArea;
    workspaceId?: string;
    userId?: string;
    errorCode?: string;
  }
): Promise<void> {
  try {
    await admin.rpc('google_oauth_log', {
      p_request_id: event.requestId, p_stage: event.stage, p_outcome: event.outcome,
      p_service_area: event.serviceArea || null, p_workspace_id: event.workspaceId || null,
      p_user_id: event.userId || null, p_error_code: event.errorCode || null,
    });
  } catch (err) {
    console.error('Failed to log diagnostic event:', err);
  }
}

export async function requireWorkspaceMember(
  admin: ReturnType<typeof createClient>,
  userId: string,
  serviceArea: ServiceArea,
  workspaceId: string
): Promise<boolean> {
  const table = serviceArea === 'business' ? 'business_memberships' : 'household_memberships';
  const column = serviceArea === 'business' ? 'business_id' : 'household_id';

  const fields = serviceArea === 'business' ? 'role,status' : 'role,status,access_expires_at';

  const { data, error } = await admin
    .from(table)
    .select(fields)
    .eq(column, workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return false;

  if (serviceArea === 'personal' && data.access_expires_at && new Date(data.access_expires_at).valueOf() <= Date.now()) {
    return false;
  }

  return serviceArea === 'business'
    ? ['owner', 'admin'].includes(data.role)
    : ['owner'].includes(data.role);
}
