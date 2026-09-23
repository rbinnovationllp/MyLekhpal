import { adminClient, allowedOrigins, cors, reply } from '../_shared/google-oauth.ts';

type Input = { businessId?: string; mode?: 'client_owned' | 'company_owned'; spreadsheetId?: string; consent?: boolean; accessToken?: string };
const validId = (value: string | undefined) => !value || /^[A-Za-z0-9_-]{20,}$/.test(value);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  try {
    const input = await req.json() as Input, authorization = req.headers.get('authorization') || (input.accessToken ? `Bearer ${input.accessToken}` : '');
    if (!authorization.startsWith('Bearer ') || !input.businessId || !input.mode || !input.consent || !validId(input.spreadsheetId)) return reply({ error: 'Choose a storage location and explicitly consent before continuing.' }, 400, origin);
    const admin = adminClient(), { data: { user } } = await admin.auth.getUser(authorization.slice(7));
    if (!user) return reply({ error: 'Sign in to continue.' }, 401, origin);
    const { data: member } = await admin.from('business_memberships').select('role').eq('business_id', input.businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!member || !['owner', 'admin'].includes(member.role)) return reply({ error: 'Only the business owner or admin can configure journal delivery.' }, 403, origin);
    const target = input.mode === 'client_owned'
      ? { business_id: input.businessId, storage_mode: input.mode, client_spreadsheet_id: input.spreadsheetId || null, client_journal_sheet_id: null, client_journal_sheet_title: null, company_folder_id: null, company_spreadsheet_id: null, company_journal_sheet_id: null, company_journal_sheet_title: null, consent_granted_at: new Date().toISOString(), consent_granted_by: user.id, updated_at: new Date().toISOString() }
      : { business_id: input.businessId, storage_mode: input.mode, client_spreadsheet_id: null, client_journal_sheet_id: null, client_journal_sheet_title: null, company_folder_id: null, company_spreadsheet_id: null, company_journal_sheet_id: null, company_journal_sheet_title: null, consent_granted_at: new Date().toISOString(), consent_granted_by: user.id, updated_at: new Date().toISOString() };
    const { error } = await admin.from('business_google_journal_targets').upsert(target, { onConflict: 'business_id' });
    if (error) throw new Error('target_save_failed');
    return reply({ ok: true, mode: input.mode, needsGoogleAuthorisation: input.mode === 'client_owned' }, 200, origin);
  } catch (error) { console.error('google_journal_target_failed', { code: error instanceof Error ? error.message : 'unknown' }); return reply({ error: 'Unable to save Google journal delivery settings.' }, 503, origin); }
});
