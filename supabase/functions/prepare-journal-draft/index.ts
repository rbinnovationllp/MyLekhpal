import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';
import { runProgressiveSkillAgent } from '../_shared/progressive-skill-agent.ts';
import { repositoryFor } from '../_shared/skill-registry.ts';
import { persistManagedDocument } from '../_shared/managed-document-storage.ts';

type DraftInput = { businessId: string; sourceMethod: string; manualText?: string; file?: { name: string; type: string; base64: string } };
type Account = { id: string; code: string; name: string; type: string };
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const origins = new Set(['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173']);
const respond = (body: unknown, status = 200, requestId?: string, origin?: string | null) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...(origin && origins.has(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}), ...(requestId ? { 'x-mylekhpal-request-id': requestId } : {}) } });
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map((x) => x.toString(16).padStart(2, '0')).join('');

function contentFor(file?: DraftInput['file']) {
  if (!file) return [];
  const type = file.type || 'application/octet-stream';
  if (type.startsWith('image/')) return [{ type: 'image', source: { type: 'base64', media_type: type, data: file.base64 } }];
  if (type === 'application/pdf') return [{ type: 'document', source: { type: 'base64', media_type: type, data: file.base64 } }];
  if (type.includes('csv') || file.name.toLowerCase().endsWith('.csv')) return [{ type: 'document', source: { type: 'text', media_type: 'text/plain', data: atob(file.base64) } }];
  if (/\.xlsx?$/.test(file.name.toLowerCase())) {
    const wb = XLSX.read(Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0)), { type: 'array' });
    return [{ type: 'document', source: { type: 'text', media_type: 'text/plain', data: wb.SheetNames.map((name) => `--- SHEET: ${name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`).join('\n\n') } }];
  }
  throw new Error('Use a PDF, image, CSV, XLS or XLSX file.');
}

const draftSchema = {
  type: 'object', additionalProperties: false, properties: {
    status: { enum: ['draft', 'pending_clarification', 'pending_review'] },
    confidence: { enum: ['high', 'medium', 'low'] },
    transaction_date: { type: ['string', 'null'] }, reference: { type: ['string', 'null'] }, party_name: { type: ['string', 'null'] }, party_gstin: { type: ['string', 'null'] },
    narration: { type: 'string' }, taxable_amount: { type: ['number', 'null'] }, gst_amount: { type: ['number', 'null'] }, total_amount: { type: ['number', 'null'] }, gst_treatment: { type: 'string' },
    lines: { type: 'array', minItems: 2, items: { type: 'object', additionalProperties: false, properties: { account_id: { type: 'string' }, debit: { type: 'number' }, credit: { type: 'number' }, narration: { type: 'string' } }, required: ['account_id', 'debit', 'credit', 'narration'] } },
    clarifications: { type: 'array', items: { type: 'string' } }, exceptions: { type: 'array', items: { type: 'string' } },
    field_confidence: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { field: { type: 'string' }, level: { enum: ['high', 'medium', 'low'] }, reason: { type: 'string' } }, required: ['field', 'level', 'reason'] } },
    completeness: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { field: { type: 'string' }, status: { enum: ['complete', 'missing', 'invalid', 'inconsistent', 'not_applicable', 'pending_professional_review'] }, note: { type: 'string' } }, required: ['field', 'status', 'note'] } },
  }, required: ['status', 'confidence', 'narration', 'lines', 'clarifications', 'exceptions', 'field_confidence', 'completeness'],
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {} });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405, undefined, origin);
  if (origin && !origins.has(origin)) return respond({ error: 'Request origin rejected.' }, 403, undefined, origin);
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) return respond({ error: 'Sign in to continue.' }, 401, undefined, origin);
    const input = await req.json() as DraftInput;
    if (!input.businessId || (!input.manualText && !input.file)) return respond({ error: 'A business and transaction text or document are required.' }, 400, undefined, origin);
    if (input.file && input.file.base64.length > 7_000_000) return respond({ error: 'Maximum file size is 5 MB.' }, 413, undefined, origin);
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userDb = createClient(url, anon, { global: { headers: { authorization } } });
    const { data: { user } } = await userDb.auth.getUser();
    if (!user) return respond({ error: 'Sign in to continue.' }, 401, undefined, origin);
    const { data: member } = await userDb.from('business_memberships').select('role').eq('business_id', input.businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!member || member.role === 'auditor') return respond({ error: 'Your role cannot prepare drafts.' }, 403, undefined, origin);
    const { data: writeAllowed } = await userDb.rpc('mylekhpal_write_access', { target_business: input.businessId });
    if (!writeAllowed) return respond({ error: 'This workspace is currently read-only. You can still view and download your records.' }, 403, undefined, origin);
    const [{ data: accounts }, { data: business }] = await Promise.all([
      userDb.from('chart_of_accounts').select('id,code,name,type').eq('business_id', input.businessId).eq('is_active', true),
      userDb.from('businesses').select('legal_name,display_name,pan,gstins,workspace_settings').eq('id', input.businessId).single(),
    ]);
    if (!accounts?.length || !business) return respond({ error: 'The active business or its chart of accounts is unavailable.' }, 422, undefined, origin);
    const admin = createClient(url, service), sourceHash = await hash(input.file?.base64 || input.manualText || '');
    const { data: matchingSource } = await admin.from('source_documents').select('id').eq('business_id', input.businessId).eq('file_hash', sourceHash).limit(1).maybeSingle();
    const agent = await runProgressiveSkillAgent({
      repository: repositoryFor('my-journal-entry-preparation'), model: Deno.env.get('MYLEKHAPAL_ANTHROPIC_MODEL') || 'claude-sonnet-4-6', apiKey: Deno.env.get('MYLEKHAPAL_ANTHROPIC_API_KEY')!, maxTokens: 3500,
      runtimeContext: `Prepare one reviewable journal DRAFT only. Do not post, approve, delete, edit a finalised record, file a return, or claim a Google Drive upload. Use only source facts; missing facts must be clarifications. The application enforces permissions, locks, voucher numbering and saving. Business context: ${JSON.stringify(business)}. Allowed accounts: ${JSON.stringify(accounts)}. ${matchingSource ? 'An identical source hash exists; flag a possible duplicate.' : 'No source-hash match was found; that is not proof there is no duplicate.'} The Python workbook resource is available only to the isolated report-job worker; do not claim an XLSX was created in this request.`,
      userContent: [...contentFor(input.file), { type: 'text', text: `Source method: ${input.sourceMethod}. Manual context: ${input.manualText || '(none)'}. Prepare the journal draft now.` }],
      finalToolName: 'prepare_journal_draft', finalToolDescription: 'Return one reviewable accounting draft only.', finalToolSchema: draftSchema,
    });
    const requestId = agent.requestId, draft = agent.draft;
    if (!draft?.lines?.length) return respond({ error: 'No valid journal draft was returned.', requestId }, 502, requestId);
    const accountIds = new Set(accounts.map((a) => a.id));
    const debit = draft.lines.reduce((n: number, x: { debit?: number }) => n + Number(x.debit || 0), 0), credit = draft.lines.reduce((n: number, x: { credit?: number }) => n + Number(x.credit || 0), 0);
    if (draft.lines.some((x: { account_id: string; debit?: number; credit?: number }) => !accountIds.has(x.account_id) || (Number(x.debit || 0) > 0) === (Number(x.credit || 0) > 0)) || Math.abs(debit - credit) > 0.01) return respond({ error: 'The proposed draft did not pass account or balance validation.', requestId }, 422, requestId, origin);
    const storedFile = input.file ? await persistManagedDocument(admin, 'business', input.businessId, input.file, sourceHash) : null;
    const { data: doc, error } = await admin.from('source_documents').insert({ business_id: input.businessId, doc_type: input.sourceMethod, storage_provider: storedFile ? 'supabase_storage' : 'ephemeral_processed_only', storage_path: storedFile?.path || null, file_size_bytes: storedFile?.size || null, retention_status: storedFile?.retentionStatus || 'active', file_name: input.file?.name || 'manual-entry.txt', file_hash: sourceHash, extracted_fields: draft, ocr_confidence: draft.confidence, uploaded_by: user.id }).select('id').single();
    if (error) throw new Error('Could not record the processed source.');
    await admin.from('usage_records').insert([{ business_id: input.businessId, user_id: user.id, event_type: 'ai_document_processed', quantity: 1, estimated_cost: 0 }, { business_id: input.businessId, user_id: user.id, event_type: 'ai_tokens', quantity: agent.inputTokens + agent.outputTokens, estimated_cost: 0 }]);
    const skillAudit = {
      name: 'my-journal-entry-preparation',
      skill_path: '/skills/my-journal-entry-preparation/SKILL.md',
      source: 'generated registry from the authoritative /skills package directory',
      full_skill_loaded: agent.skillLoaded,
    };
    await admin.from('audit_log').insert({ business_id: input.businessId, actor_user_id: user.id, actor_type: 'ai_draft', action: 'claude_journal_draft_prepared', entity_type: 'source_document', entity_id: doc.id, after_state: { request_id: requestId, model: agent.model, source_method: input.sourceMethod, skill: skillAudit, source_hash_duplicate: Boolean(matchingSource), progressive_agent: { skill_loaded: agent.skillLoaded, references_loaded: agent.referencesLoaded, tool_calls: agent.toolCalls, input_tokens: agent.inputTokens, output_tokens: agent.outputTokens } } });
    await admin.from('private.skill_agent_runs').insert({ request_id: requestId, service: 'business_accounting', skill_name: 'my-journal-entry-preparation', skill_path: '/skills/my-journal-entry-preparation/SKILL.md', skill_loaded: agent.skillLoaded, references_loaded: agent.referencesLoaded, tool_calls: agent.toolCalls, model: agent.model, input_tokens: agent.inputTokens, output_tokens: agent.outputTokens, status: 'completed', business_id: input.businessId });
    return respond({ draft, requestId, sourceDocumentId: doc.id }, 200, requestId, origin);
  } catch (_e) { return respond({ error: 'Unable to prepare the journal draft. Please retry shortly.' }, 500, undefined, origin); }
});
