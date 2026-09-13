import { adminClient, allowedOrigins, cors, decryptToken, encryptToken, reply } from '../_shared/google-oauth.ts';

type Input = { businessId?: string; accessToken?: string; limit?: number };
type Connection = { id: string; spreadsheet_id: string | null; spreadsheet_title: string | null };

const sheetName = 'Journal Entries';
const google = async (accessToken: string, url: string, init?: RequestInit) => {
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...(init?.headers || {}) } });
  if (!response.ok) throw new Error(`google_api_${response.status}`);
  return response.status === 204 ? null : await response.json();
};

async function refreshedAccessToken(admin: ReturnType<typeof adminClient>, connectionId: string) {
  const { data: secret } = await admin.schema('private').from('workspace_google_connection_secrets')
    .select('refresh_token_ciphertext').eq('connection_id', connectionId).maybeSingle();
  if (!secret?.refresh_token_ciphertext) throw new Error('missing_google_refresh_token');
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID'), clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('missing_google_client_credentials');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: await decryptToken(secret.refresh_token_ciphertext), client_id: clientId, client_secret: clientSecret }) });
  const token = await response.json();
  if (!response.ok || !token.access_token) throw new Error(`google_token_refresh_${response.status}`);
  await admin.schema('private').from('workspace_google_connection_secrets').update({ access_token_ciphertext: await encryptToken(token.access_token), access_token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(), rotated_at: new Date().toISOString() }).eq('connection_id', connectionId);
  return String(token.access_token);
}

async function ensureSpreadsheet(admin: ReturnType<typeof adminClient>, connection: Connection, accessToken: string, businessId: string) {
  if (connection.spreadsheet_id) return connection.spreadsheet_id;
  const title = `MyLekhapal - Journal Entries ${new Date().getFullYear()}`;
  const created = await google(accessToken, 'https://sheets.googleapis.com/v4/spreadsheets', { method: 'POST', body: JSON.stringify({ properties: { title }, sheets: [{ properties: { title: sheetName } }] }) });
  const spreadsheetId = String(created.spreadsheetId);
  await admin.from('workspace_google_connections').update({ spreadsheet_id: spreadsheetId, spreadsheet_title: title, sync_status: 'connected' }).eq('id', connection.id).eq('business_id', businessId);
  return spreadsheetId;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Request origin rejected.' }, 403, origin);
  try {
    const input = await req.json() as Input;
    const authorization = req.headers.get('authorization') || (input.accessToken ? `Bearer ${input.accessToken}` : '');
    if (!authorization.startsWith('Bearer ') || !input.businessId) return reply({ error: 'Sign in and select a business.' }, 400, origin);
    const admin = adminClient();
    const { data: { user } } = await admin.auth.getUser(authorization.slice(7));
    const { data: member } = user ? await admin.from('business_memberships').select('role').eq('business_id', input.businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle() : { data: null };
    if (!member || member.role === 'auditor') return reply({ error: 'Your role cannot sync this business journal.' }, 403, origin);
    const { data: connection } = await admin.from('workspace_google_connections').select('id,spreadsheet_id,spreadsheet_title').eq('business_id', input.businessId).is('revoked_at', null).eq('sync_status', 'connected').maybeSingle<Connection>();
    if (!connection) return reply({ connected: false, synced: 0, message: 'Google Drive is not connected for this business.' }, 200, origin);
    const accessToken = await refreshedAccessToken(admin, connection.id);
    const spreadsheetId = await ensureSpreadsheet(admin, connection, accessToken, input.businessId);
    const { data: queued } = await admin.schema('private').from('google_journal_sync_queue').select('entry_id').eq('business_id', input.businessId).is('synced_at', null).order('queued_at').limit(Math.min(Math.max(Number(input.limit || 50), 1), 100));
    let synced = 0;
    for (const item of queued || []) {
      try {
        const { data: entry } = await admin.from('journal_entries').select('id,entry_number,transaction_date,description,status,journal_lines(line_no,debit,credit,chart_of_accounts(code,name))').eq('id', item.entry_id).eq('business_id', input.businessId).single();
        if (!entry) throw new Error('journal_entry_not_found');
        const exportKey = String(entry.id);
        const existing = await google(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A:A`)}`) as { values?: string[][] };
        if (!existing.values?.some((row) => row[0] === exportKey)) {
          const rows = entry.journal_lines.map((line: any) => [exportKey, entry.entry_number, entry.transaction_date, entry.description, line.line_no, line.chart_of_accounts?.code || '', line.chart_of_accounts?.name || '', String(line.debit || 0), String(line.credit || 0), entry.status]);
          await google(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A:J`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: rows }) });
        }
        await admin.schema('private').from('google_journal_sync_queue').update({ synced_at: new Date().toISOString(), attempts: 0, last_error_code: null }).eq('entry_id', item.entry_id);
        synced++;
      } catch (error) {
        const code = error instanceof Error ? error.message : 'sync_failed';
        await admin.schema('private').from('google_journal_sync_queue').update({ attempts: 1, last_error_code: code }).eq('entry_id', item.entry_id);
      }
    }
    await admin.from('workspace_google_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', connection.id);
    return reply({ connected: true, spreadsheetId, synced }, 200, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'sync_failed';
    console.error('google_journal_sync_failed', { code });
    return reply({ error: 'Journal sync could not be completed. Your journal entry remains safely saved in MyLekhapal.' }, 503, origin);
  }
});
