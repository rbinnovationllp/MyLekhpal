import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';
import { SKILL_PACKAGE } from './skill-package.ts';

type DraftInput = { businessId: string; sourceMethod: string; manualText?: string; file?: { name: string; type: string; base64: string } };
type Account = { id: string; code: string; name: string; type: string };
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const respond = (body: unknown, status = 200, requestId?: string) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...(requestId ? { 'x-mylekhpal-request-id': requestId } : {}) } });
const permittedOrigin = (req: Request) => !req.headers.get('origin') || ['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173'].includes(req.headers.get('origin')!);
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

function runtimeInstructions(accounts: Account[], business: Record<string, unknown>, duplicateSource: boolean) {
  const references = Object.entries(SKILL_PACKAGE.references).map(([name, text]) => `\n\n===== ${name} =====\n${text}`).join('');
  return `${SKILL_PACKAGE.skill}${references}

===== MYLEKHAPAL RUNTIME BOUNDARIES (take precedence where implementation differs) =====
You are executing the exact ${SKILL_PACKAGE.name} guidance in an authenticated MyLekhapal workflow. Prepare ONE reviewable DRAFT only. Do not post, approve, delete, edit a finalized record, create a ledger, file a return, claim a live reconciliation, or claim a Google Drive upload.
Use only facts supported by the source. If absent, mark it missing and add a clarification; do not guess. The application, not you, enforces permissions, financial-period locks, voucher numbering, storage, and final saving.
Business context: ${JSON.stringify(business)}. The only permitted account IDs are ${JSON.stringify(accounts)}. Select only those accounts. ${duplicateSource ? 'An identical source-file hash already exists: flag a possible duplicate.' : 'No matching source-file hash was found; that is not proof that no duplicate entry exists.'}
The application cannot run the skill's Python workbook script inside this Edge Function. Do not claim an XLSX workbook was created. Return the complete structured draft required by the tool schema. The user must review and explicitly save it; every response is a draft pending qualified accounting review.`;
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
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  if (!permittedOrigin(req)) return respond({ error: 'Request origin rejected.' }, 403);
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) return respond({ error: 'Sign in to continue.' }, 401);
    const input = await req.json() as DraftInput;
    if (!input.businessId || (!input.manualText && !input.file)) return respond({ error: 'A business and transaction text or document are required.' }, 400);
    if (input.file && input.file.base64.length > 7_000_000) return respond({ error: 'Maximum file size is 5 MB.' }, 413);
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userDb = createClient(url, anon, { global: { headers: { authorization } } });
    const { data: { user } } = await userDb.auth.getUser();
    if (!user) return respond({ error: 'Sign in to continue.' }, 401);
    const { data: member } = await userDb.from('business_memberships').select('role').eq('business_id', input.businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!member || member.role === 'auditor') return respond({ error: 'Your role cannot prepare drafts.' }, 403);
    const [{ data: accounts }, { data: business }] = await Promise.all([
      userDb.from('chart_of_accounts').select('id,code,name,type').eq('business_id', input.businessId).eq('is_active', true),
      userDb.from('businesses').select('legal_name,display_name,pan,gstins,workspace_settings').eq('id', input.businessId).single(),
    ]);
    if (!accounts?.length || !business) return respond({ error: 'The active business or its chart of accounts is unavailable.' }, 422);
    const admin = createClient(url, service), sourceHash = await hash(input.file?.base64 || input.manualText || '');
    const { data: matchingSource } = await admin.from('source_documents').select('id').eq('business_id', input.businessId).eq('file_hash', sourceHash).limit(1).maybeSingle();
    const api = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': Deno.env.get('MYLEKHAPAL_ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: Deno.env.get('MYLEKHAPAL_ANTHROPIC_MODEL') || 'claude-sonnet-4-6', max_tokens: 3500, system: runtimeInstructions(accounts, business, Boolean(matchingSource)), messages: [{ role: 'user', content: [...contentFor(input.file), { type: 'text', text: `Source method: ${input.sourceMethod}. Manual context: ${input.manualText || '(none)'}. Prepare the journal draft now.` }] }], tools: [{ name: 'prepare_journal_draft', description: 'Return one reviewable accounting draft only.', input_schema: draftSchema }], tool_choice: { type: 'tool', name: 'prepare_journal_draft' } }),
    });
    const requestId = api.headers.get('request-id') || crypto.randomUUID(), result = await api.json();
    if (!api.ok) return respond({ error: 'Journal draft preparation is temporarily unavailable.', requestId }, 502, requestId);
    const draft = result.content?.find((b: { type: string }) => b.type === 'tool_use')?.input;
    if (!draft?.lines?.length) return respond({ error: 'No valid journal draft was returned.', requestId }, 502, requestId);
    const accountIds = new Set(accounts.map((a) => a.id));
    const debit = draft.lines.reduce((n: number, x: { debit?: number }) => n + Number(x.debit || 0), 0), credit = draft.lines.reduce((n: number, x: { credit?: number }) => n + Number(x.credit || 0), 0);
    if (draft.lines.some((x: { account_id: string; debit?: number; credit?: number }) => !accountIds.has(x.account_id) || (Number(x.debit || 0) > 0) === (Number(x.credit || 0) > 0)) || Math.abs(debit - credit) > 0.01) return respond({ error: 'The proposed draft did not pass account or balance validation.', requestId }, 422, requestId);
    const { data: doc, error } = await admin.from('source_documents').insert({ business_id: input.businessId, doc_type: input.sourceMethod, storage_provider: 'ephemeral_processed_only', file_name: input.file?.name || 'manual-entry.txt', file_hash: sourceHash, extracted_fields: draft, ocr_confidence: draft.confidence, uploaded_by: user.id }).select('id').single();
    if (error) throw new Error('Could not record the processed source.');
    await admin.from('usage_records').insert([{ business_id: input.businessId, user_id: user.id, event_type: 'ai_document_processed', quantity: 1, estimated_cost: 0 }, { business_id: input.businessId, user_id: user.id, event_type: 'ai_tokens', quantity: Number(result.usage?.input_tokens || 0) + Number(result.usage?.output_tokens || 0), estimated_cost: 0 }]);
    const skillAudit = {
      name: 'my-journal-entry-preparation',
      retained_skill_name: SKILL_PACKAGE.manifest.retained_skill_name,
      manifest_package: SKILL_PACKAGE.manifest.package,
      skill_sha256: SKILL_PACKAGE.manifest.files['my-journal-entry-preparation/SKILL.md'].sha256,
      package_content_sha256: SKILL_PACKAGE.packageHash,
      provenance_note: 'The consolidated SKILL.md is the retained runtime skill. journal-entry-preparation is superseded provenance only for copied scripts and references.',
    };
    await admin.from('audit_log').insert({ business_id: input.businessId, actor_user_id: user.id, actor_type: 'ai_draft', action: 'claude_journal_draft_prepared', entity_type: 'source_document', entity_id: doc.id, after_state: { request_id: requestId, model: result.model, source_method: input.sourceMethod, skill: skillAudit, source_hash_duplicate: Boolean(matchingSource) } });
    return respond({ draft, requestId, model: result.model, sourceDocumentId: doc.id, skill: skillAudit }, 200, requestId);
  } catch (e) { return respond({ error: e instanceof Error ? e.message : 'Unable to prepare draft.' }, 500); }
});
