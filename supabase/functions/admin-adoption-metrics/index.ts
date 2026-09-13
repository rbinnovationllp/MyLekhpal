import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const origins = new Set(['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173']);
const reply = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {}) } });

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {} });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  try {
    const authorization = req.headers.get('authorization') || '';
    const url = Deno.env.get('SUPABASE_URL'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization.startsWith('Bearer ') || !url || !service) return reply({ error: 'Sign in as an administrator.' }, 401, origin);
    const admin = createClient(url, service);
    const { data: { user } } = await admin.auth.getUser(authorization.slice(7));
    if (!user) return reply({ error: 'Sign in as an administrator.' }, 401, origin);
    const { data: adminRow } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!adminRow) return reply({ error: 'Administrator access is required.' }, 403, origin);
    const { data, error } = await admin.schema('private').rpc('admin_adoption_metrics');
    if (error) throw error;
    return reply(data, 200, origin);
  } catch { return reply({ error: 'Analytics are temporarily unavailable.' }, 503, origin); }
});
