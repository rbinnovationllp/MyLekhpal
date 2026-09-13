import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const origins = new Set(['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173']);
const reply = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {}) } });
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((n) => n.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {} });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  if (!origin || !origins.has(origin)) return reply({ error: 'Request origin rejected.' }, 403, origin);
  try {
    const input = await req.json() as { visitorId?: string; path?: string };
    const visitorId = String(input.visitorId || '');
    if (!/^[a-f0-9-]{36}$/i.test(visitorId)) return reply({ error: 'Invalid visit identifier.' }, 400, origin);
    const ua = req.headers.get('user-agent') || '';
    const bot = /bot|crawler|spider|headless|curl|wget/i.test(ua) || ua.length < 20;
    const salt = Deno.env.get('VISITOR_HASH_SALT');
    const url = Deno.env.get('SUPABASE_URL'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!salt || !url || !service) throw new Error('missing_configuration');
    const hash = await digest(`${salt}:${visitorId}`);
    const admin = createClient(url, service), now = new Date(), today = now.toISOString().slice(0, 10);
    const { data: known } = await admin.schema('private').from('website_visitors').select('last_seen_at,total_sessions,suspected_bot').eq('visitor_hash', hash).maybeSingle();
    const isNewSession = !known || now.valueOf() - new Date(known.last_seen_at).valueOf() >= 30 * 60 * 1000;
    await admin.schema('private').from('website_visitors').upsert({ visitor_hash: hash, first_seen_at: known ? undefined : now.toISOString(), last_seen_at: now.toISOString(), total_sessions: known ? Number(known.total_sessions) + (isNewSession ? 1 : 0) : 1, suspected_bot: Boolean(known?.suspected_bot || bot) });
    const { data: todayRow } = await admin.schema('private').from('website_visit_days').select('sessions').eq('visitor_hash', hash).eq('visit_date', today).maybeSingle();
    await admin.schema('private').from('website_visit_days').upsert({ visitor_hash: hash, visit_date: today, last_seen_at: now.toISOString(), sessions: todayRow ? Number(todayRow.sessions) + (isNewSession ? 1 : 0) : 1 });
    return reply({ recorded: true }, 202, origin);
  } catch { return reply({ recorded: false }, 202, origin); }
});
