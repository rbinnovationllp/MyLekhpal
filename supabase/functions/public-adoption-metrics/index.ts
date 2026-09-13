import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const origins = new Set(['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173']);
const response = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60, s-maxage=60', ...(origin && origins.has(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}) } });

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, OPTIONS', vary: 'origin' } : {} });
  if (!['GET', 'POST'].includes(req.method)) return response({ error: 'Method not allowed.' }, 405, origin);
  if (origin && !origins.has(origin)) return response({ error: 'Request origin rejected.' }, 403, origin);
  try {
    const url = Deno.env.get('SUPABASE_URL'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !service) throw new Error('missing_configuration');
    const admin = createClient(url, service);
    const { data, error } = await admin.schema('private').rpc('public_adoption_metrics');
    if (error || !data?.[0]) throw new Error('metrics_unavailable');
    const metrics = data[0];
    return response({ totalVisitors: Number(metrics.total_visitors), uniqueVisitors: Number(metrics.unique_visitors), registeredUsers: Number(metrics.registered_users), activeAdopters: Number(metrics.active_adopters) }, 200, origin);
  } catch { return response({ error: 'Public metrics are temporarily unavailable.' }, 503, origin); }
});
