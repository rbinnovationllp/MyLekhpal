import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { persistManagedDocument } from '../_shared/managed-document-storage.ts';

const origins = new Set(['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173']);
const reply = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {}) } });
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map((n) => n.toString(16).padStart(2, '0')).join('');
const encode = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {} });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  try {
    const input = await req.json() as { businessId?: string; entryId?: string; accessToken?: string };
    const authorization = req.headers.get('authorization') || (input.accessToken ? `Bearer ${input.accessToken}` : '');
    const url = Deno.env.get('SUPABASE_URL'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization.startsWith('Bearer ') || !input.businessId || !input.entryId || !url || !service) return reply({ error: 'Invalid archive request.' }, 400, origin);
    const admin = createClient(url, service);
    const { data: { user } } = await admin.auth.getUser(authorization.slice(7));
    const { data: member } = user ? await admin.from('business_memberships').select('role').eq('business_id', input.businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle() : { data: null };
    if (!member || member.role === 'auditor') return reply({ error: 'Your role cannot archive this journal entry.' }, 403, origin);
    const { data: existing } = await admin.schema('private').from('managed_record_archives').select('entry_id').eq('entry_id', input.entryId).maybeSingle();
    if (existing) return reply({ archived: true, existing: true }, 200, origin);
    const { data: entry } = await admin.from('journal_entries').select('id,entry_number,entry_type,transaction_date,financial_year,period,description,source_method,status,created_at,journal_lines(line_no,debit,credit,chart_of_accounts(code,name,type))').eq('id', input.entryId).eq('business_id', input.businessId).single();
    if (!entry) return reply({ error: 'Journal entry not found.' }, 404, origin);
    const payload = JSON.stringify({ schema: 'mylekhpal-journal-entry-v1', archived_at: new Date().toISOString(), entry });
    const contentHash = await hash(payload);
    const stored = await persistManagedDocument(admin, 'business', input.businessId, { name: `journal-entry-${entry.entry_number}.json`, type: 'application/json', base64: encode(payload) }, contentHash);
    const { error } = await admin.schema('private').from('managed_record_archives').insert({ entry_id: input.entryId, business_id: input.businessId, storage_path: stored.path, file_size_bytes: stored.size, content_hash: contentHash });
    if (error) throw error;
    return reply({ archived: true }, 201, origin);
  } catch { return reply({ error: 'The journal entry is saved, but its managed-storage archive is pending.' }, 503, origin); }
});
