import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { publicMetricsAllowedOrigins, publicMetricsCorsHeaders } from '../_shared/public-metrics-cors.ts';
import { recordPublicVisit } from '../_shared/visitor-tracking.ts';

const reply = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...publicMetricsCorsHeaders(origin ?? null) } });
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((n) => n.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: publicMetricsCorsHeaders(origin) });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  if (!origin || !publicMetricsAllowedOrigins.has(origin)) return reply({ error: 'Request origin rejected.' }, 403, origin);
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
    const admin = createClient(url, service);
    const recorded = await recordPublicVisit(admin, hash, bot);
    return reply({ recorded }, 202, origin);
  } catch { return reply({ recorded: false }, 202, origin); }
});
