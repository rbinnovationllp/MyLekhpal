import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';
import { runLoadedSkillOnce, runProgressiveSkillAgent } from '../_shared/progressive-skill-agent.ts';
import { repositoryFor } from '../_shared/skill-registry.ts';
import { persistManagedDocument } from '../_shared/managed-document-storage.ts';

type DraftInput = { businessId: string; sourceMethod: string; manualText?: string; file?: { name: string; type: string; base64: string }; accessToken?: string };
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

const batchDraftSchema = {
  type: 'object', additionalProperties: false, properties: {
    entries: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      source_row_number: { type: 'number' }, status: { enum: ['draft', 'pending_clarification', 'pending_review'] }, confidence: { enum: ['high', 'medium', 'low'] },
      transaction_date: { type: ['string', 'null'] }, reference: { type: ['string', 'null'] }, party_name: { type: ['string', 'null'] }, narration: { type: 'string' }, total_amount: { type: ['number', 'null'] }, gst_treatment: { type: 'string' },
      lines: { type: 'array', minItems: 2, items: { type: 'object', additionalProperties: false, properties: { account_id: { type: 'string' }, debit: { type: 'number' }, credit: { type: 'number' }, narration: { type: 'string' } }, required: ['account_id', 'debit', 'credit', 'narration'] } },
      clarifications: { type: 'array', items: { type: 'string' } }, exceptions: { type: 'array', items: { type: 'string' } },
    }, required: ['source_row_number', 'status', 'confidence', 'transaction_date', 'reference', 'party_name', 'narration', 'total_amount', 'gst_treatment', 'lines', 'clarifications', 'exceptions'] } },
  }, required: ['entries'],
};

type SpreadsheetRow = { row: number; sheet: string; fields: Record<string, string> };
const normal = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
function spreadsheetRows(file: NonNullable<DraftInput['file']>): SpreadsheetRow[] {
  const workbook = XLSX.read(Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0)), { type: 'array', cellDates: true });
  const results: SpreadsheetRow[] = [];
  for (const sheet of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: '', raw: false, blankrows: false });
    const headerIndex = rows.findIndex((row) => row.some((cell) => normal(cell).includes('date')) && row.some((cell) => normal(cell).includes('amount')));
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map((cell) => String(cell ?? '').trim());
    for (let index = headerIndex + 1; index < rows.length; index++) {
      const values = rows[index];
      if (!values.some((value) => String(value ?? '').trim())) continue;
      const fields = Object.fromEntries(headers.map((header, column) => [header || `Column ${column + 1}`, String(values[column] ?? '').trim()]));
      results.push({ row: index + 1, sheet, fields });
    }
  }
  return results;
}
function rowsText(rows: SpreadsheetRow[]) {
  return rows.map((row) => `Source row ${row.row} on ${row.sheet}: ${JSON.stringify(row.fields)}`).join('\n');
}
function validLines(lines: any[], accountIds: Set<string>) {
  const debit = lines.reduce((total, line) => total + Number(line.debit || 0), 0);
  const credit = lines.reduce((total, line) => total + Number(line.credit || 0), 0);
  return lines.length >= 2 && lines.every((line) => accountIds.has(line.account_id) && ((Number(line.debit || 0) > 0) !== (Number(line.credit || 0) > 0))) && Math.abs(debit - credit) <= 0.01;
}
function canonicalLines(lines: any[], accounts: Account[]) {
  const accountByAlias = new Map<string, string>();
  for (const account of accounts) {
    accountByAlias.set(normal(account.id), account.id);
    accountByAlias.set(normal(account.code), account.id);
    accountByAlias.set(normal(account.name), account.id);
  }
  return lines.map((line) => ({ ...line, account_id: accountByAlias.get(normal(line.account_id)) || line.account_id }));
}
function batchWorkbook(entries: any[], accounts: Account[]) {
  const accountName = new Map(accounts.map((account) => [account.id, account.name]));
  const workbook = XLSX.utils.book_new();
  const register = [['Entry ID', 'Date', 'Source row', 'Party', 'Narration', 'Debit total (INR)', 'Credit total (INR)', 'Status', 'Confidence', 'Review notes']];
  const lines = [['Entry ID', 'Line no.', 'Account', 'Debit (INR)', 'Credit (INR)', 'Narration']];
  const exceptions = [['Entry ID', 'Source row', 'Issue', 'Required action']];
  entries.forEach((entry, index) => {
    const entryId = `DRAFT-${String(index + 1).padStart(3, '0')}`;
    const debit = entry.lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0);
    const credit = entry.lines.reduce((sum: number, line: any) => sum + Number(line.credit || 0), 0);
    register.push([entryId, entry.transaction_date || '', entry.source_row_number, entry.party_name || '', entry.narration, debit, credit, entry.status, entry.confidence, [...entry.clarifications, ...entry.exceptions].join(' | ')]);
    entry.lines.forEach((line: any, lineIndex: number) => lines.push([entryId, lineIndex + 1, accountName.get(line.account_id) || 'Unmapped account', Number(line.debit || 0) || '', Number(line.credit || 0) || '', line.narration]));
    [...entry.clarifications, ...entry.exceptions].forEach((issue: string) => exceptions.push([entryId, entry.source_row_number, issue, 'Client/CA review required']));
  });
  const dashboard = [['Draft Journal Entries', 'Value'], ['Entries prepared', entries.length], ['Draft debit total (INR)', entries.reduce((sum, entry) => sum + entry.lines.reduce((row: number, line: any) => row + Number(line.debit || 0), 0), 0)], ['Review requirement', 'Every entry is a draft and requires client/CA review before posting.']];
  for (const [name, data] of [['Dashboard', dashboard], ['Journal Register', register], ['Journal Lines', lines], ['Exceptions', exceptions]] as const) {
    const sheet = XLSX.utils.aoa_to_sheet(data); sheet['!cols'] = data[0].map(() => ({ wch: 24 })); XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin && origins.has(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {} });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405, undefined, origin);
  if (origin && !origins.has(origin)) return respond({ error: 'Request origin rejected.' }, 403, undefined, origin);
  const operationId = crypto.randomUUID();
  try {
    const input = await req.json() as DraftInput;
    // Some browser/proxy combinations can omit a custom Authorization header on
    // a cross-origin Edge Function invocation. The same short-lived user JWT is
    // supplied by the authenticated frontend body as a controlled fallback.
    const authorization = req.headers.get('authorization') || (input.accessToken ? `Bearer ${input.accessToken}` : '');
    if (!authorization.startsWith('Bearer ')) return respond({ error: 'Your secure sign-in token was not received. Sign out, sign in again, then retry.' }, 401, undefined, origin);
    if (!input.businessId || (!input.manualText && !input.file)) return respond({ error: 'A business and transaction text or document are required.' }, 400, undefined, origin);
    if (input.file && input.file.base64.length > 7_000_000) return respond({ error: 'Maximum file size is 5 MB.' }, 413, undefined, origin);
    const url = Deno.env.get('SUPABASE_URL')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!url || !service) throw new Error('server_auth_configuration_missing');
    const admin = createClient(url, service);
    const { data: { user } } = await admin.auth.getUser(authorization.slice(7));
    if (!user) return respond({ error: 'Your secure sign-in token could not be verified. Sign out, sign in again, then retry.' }, 401, undefined, origin);
    const { data: member } = await admin.from('business_memberships').select('role').eq('business_id', input.businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!member || member.role === 'auditor') return respond({ error: 'Your role cannot prepare drafts.' }, 403, undefined, origin);
    const { data: subscription } = await admin.from('business_subscriptions').select('status,trial_ends_at,payment_due_at').eq('business_id', input.businessId).maybeSingle();
    const now = Date.now(), trialExpired = subscription?.status === 'trial' && subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() <= now;
    const paymentGraceExpired = subscription?.payment_due_at && new Date(subscription.payment_due_at).getTime() + 7 * 24 * 60 * 60 * 1000 <= now;
    if (!subscription || trialExpired || paymentGraceExpired || subscription.status === 'restricted_read_only' || !['trial', 'active', 'payment_due'].includes(subscription.status)) return respond({ error: 'This workspace is currently read-only. You can still view and download your records.' }, 403, undefined, origin);
    const [{ data: accounts }, { data: business }] = await Promise.all([
      admin.from('chart_of_accounts').select('id,code,name,type').eq('business_id', input.businessId).eq('is_active', true),
      admin.from('businesses').select('legal_name,display_name,pan,gstins,workspace_settings').eq('id', input.businessId).single(),
    ]);
    if (!accounts?.length || !business) return respond({ error: 'The active business or its chart of accounts is unavailable.' }, 422, undefined, origin);
    const sourceHash = await hash(input.file?.base64 || input.manualText || '');
    // Raw uploads are retained at the company only after the business explicitly
    // selected the company-managed Google/records destination. Client-owned and
    // local-download workflows remain ephemeral after processing.
    const { data: deliveryTarget } = await admin.from('business_google_journal_targets').select('storage_mode,consent_granted_at').eq('business_id', input.businessId).maybeSingle();
    const companyManagedStorage = deliveryTarget?.storage_mode === 'company_owned' && Boolean(deliveryTarget.consent_granted_at);
    const { data: matchingSource } = await admin.from('source_documents').select('id').eq('business_id', input.businessId).eq('file_hash', sourceHash).limit(1).maybeSingle();
    const spreadsheetInput = Boolean(input.file && /\.(xlsx?|csv)$/i.test(input.file.name));
    const extractedRows = spreadsheetInput && input.file ? spreadsheetRows(input.file) : [];
    if (spreadsheetInput && !extractedRows.length) return respond({ error: 'No transaction table with Date and Amount columns was found in the spreadsheet. No rows were sent for AI analysis.' }, 422, undefined, origin);
    if (spreadsheetInput) {
      // An Edge Function request is terminated after 150 seconds without a
      // response.  Calling the AI serially for every ten spreadsheet rows made
      // even ordinary bank statements exceed that limit.  Keep each model
      // response small enough to validate, but run a deliberately bounded
      // number of independent chunks in parallel.  The bound protects the
      // Anthropic rate limit and avoids an unbounded burst of customer data.
      const chunkSize = 5, parallelChunks = 3, accountIds = new Set(accounts.map((account) => account.id));
      const prepared: any[] = [], batchExceptions: string[] = [];
      const chunks: SpreadsheetRow[][] = [];
      for (let offset = 0; offset < extractedRows.length; offset += chunkSize) chunks.push(extractedRows.slice(offset, offset + chunkSize));
      const analyseChunk = async (chunk: SpreadsheetRow[]) => {
        const entries: any[] = [], exceptions: string[] = [];
        let failure: unknown;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const agent = await runLoadedSkillOnce({
            repository: repositoryFor('my-journal-entry-preparation'), model: Deno.env.get('MYLEKHAPAL_ANTHROPIC_MODEL') || 'claude-sonnet-4-6', apiKey: Deno.env.get('MYLEKHAPAL_ANTHROPIC_API_KEY')!, maxTokens: 5000,
            runtimeContext: `Prepare a separate reviewable DRAFT for every supplied spreadsheet row. Never silently skip a row. The source row number in each output must match exactly. Do not post, approve, delete, file a return, or claim cloud storage/export occurred. Use only source facts; put missing facts in clarifications. Business context: ${JSON.stringify(business)}. Allowed accounts (use only their IDs): ${JSON.stringify(accounts)}. ${matchingSource ? 'An identical source hash exists; flag possible duplicates.' : ''}`,
            userContent: [{ type: 'text', text: `Source method: ${input.sourceMethod}. Rows to process:\n${rowsText(chunk)}` }],
            finalToolName: 'prepare_journal_batch', finalToolDescription: 'Return one balanced reviewable draft for every supplied spreadsheet row.', finalToolSchema: batchDraftSchema,
          });
          const returned = Array.isArray(agent.draft?.entries) ? agent.draft.entries : [];
          const byRow = new Map(returned.map((entry: any) => [entry.source_row_number, entry]));
          for (const sourceRow of chunk) {
            const entry = byRow.get(sourceRow.row);
            if (!entry) { exceptions.push(`Source row ${sourceRow.row}: model did not return a draft; pending clarification.`); continue; }
            entry.lines = canonicalLines(entry.lines || [], accounts);
            if (!validLines(entry.lines || [], accountIds)) { exceptions.push(`Source row ${sourceRow.row}: returned lines were unbalanced or used an unavailable account; pending client/CA review.`); continue; }
            entries.push(entry);
          }
            failure = undefined;
            break;
          } catch (error) {
            failure = error;
            // A short retry handles transient provider throttling without
            // allowing a failed batch to disappear from the client report.
            if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 750));
          }
        }
        if (failure) exceptions.push(`Rows ${chunk[0].row}-${chunk[chunk.length - 1].row}: analysis did not complete after retry; retry this range. (${failure instanceof Error ? failure.message.slice(0, 80) : 'unknown error'})`);
        return { entries, exceptions };
      };
      for (let offset = 0; offset < chunks.length; offset += parallelChunks) {
        const results = await Promise.all(chunks.slice(offset, offset + parallelChunks).map(analyseChunk));
        // Promise.all preserves chunk order, so the generated workbook remains
        // in the same source order even though analysis occurred concurrently.
        for (const result of results) {
          prepared.push(...result.entries);
          batchExceptions.push(...result.exceptions);
        }
      }
      let sourceDocumentId = matchingSource?.id;
      if (!sourceDocumentId) {
        const storedFile = companyManagedStorage ? await persistManagedDocument(admin, 'business', input.businessId, input.file!, sourceHash) : null;
        // Keep the client-owned/local-download path compatible with the base
        // schema.  The managed-storage columns were introduced later and must
        // only be written when company storage was explicitly selected.
        const documentRecord: Record<string, unknown> = { business_id: input.businessId, doc_type: input.sourceMethod, storage_provider: storedFile ? 'supabase_storage' : 'ephemeral_processed_only', file_name: input.file!.name, file_hash: sourceHash, extracted_fields: { rows_found: extractedRows.length, entries_prepared: prepared.length, batch_exceptions: batchExceptions }, ocr_confidence: prepared.length === extractedRows.length ? 'medium' : 'low', uploaded_by: user.id };
        if (storedFile) Object.assign(documentRecord, { storage_path: storedFile.path, file_size_bytes: storedFile.size, retention_status: storedFile.retentionStatus });
        const { data: doc, error } = await admin.from('source_documents').insert(documentRecord).select('id').single();
        if (error || !doc) return respond({ error: `The spreadsheet was analysed, but its draft record could not be saved (${error?.code || 'database_error'}).` }, 500, operationId, origin);
        sourceDocumentId = doc.id;
      }
      const requestId = crypto.randomUUID(), workbookBase64 = batchWorkbook(prepared, accounts);
      await admin.from('usage_records').insert({ business_id: input.businessId, user_id: user.id, event_type: 'ai_document_processed', quantity: 1, estimated_cost: 0 });
      await admin.from('audit_log').insert({ business_id: input.businessId, actor_user_id: user.id, actor_type: 'ai_draft', action: 'claude_journal_batch_prepared', entity_type: 'source_document', entity_id: sourceDocumentId, after_state: { request_id: requestId, model: Deno.env.get('MYLEKHAPAL_ANTHROPIC_MODEL') || 'claude-sonnet-4-6', rows_found: extractedRows.length, entries_prepared: prepared.length, batch_exceptions: batchExceptions.length, skill_path: '/skills/my-journal-entry-preparation/SKILL.md' } });
      return respond({ batch: { entries: prepared, rowsFound: extractedRows.length, exceptions: batchExceptions, workbookBase64, workbookFilename: `Draft_Journal_Entries_${new Date().getFullYear()}.xlsx` }, requestId, sourceDocumentId }, 200, requestId, origin);
    }
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
    let docId = matchingSource?.id;
    if (!docId) {
      const storedFile = input.file && companyManagedStorage ? await persistManagedDocument(admin, 'business', input.businessId, input.file, sourceHash) : null;
      const documentRecord: Record<string, unknown> = { business_id: input.businessId, doc_type: input.sourceMethod, storage_provider: storedFile ? 'supabase_storage' : 'ephemeral_processed_only', file_name: input.file?.name || 'manual-entry.txt', file_hash: sourceHash, extracted_fields: draft, ocr_confidence: draft.confidence, uploaded_by: user.id };
      if (storedFile) Object.assign(documentRecord, { storage_path: storedFile.path, file_size_bytes: storedFile.size, retention_status: storedFile.retentionStatus });
      const { data: doc, error } = await admin.from('source_documents').insert(documentRecord).select('id').single();
      if (error || !doc) return respond({ error: `The draft was analysed, but its source record could not be saved (${error?.code || 'database_error'}).` }, 500, operationId, origin);
      docId = doc.id;
    }
    await admin.from('usage_records').insert([{ business_id: input.businessId, user_id: user.id, event_type: 'ai_document_processed', quantity: 1, estimated_cost: 0 }, { business_id: input.businessId, user_id: user.id, event_type: 'ai_tokens', quantity: agent.inputTokens + agent.outputTokens, estimated_cost: 0 }]);
    const skillAudit = {
      name: 'my-journal-entry-preparation',
      skill_path: '/skills/my-journal-entry-preparation/SKILL.md',
      source: 'generated registry from the authoritative /skills package directory',
      full_skill_loaded: agent.skillLoaded,
    };
    await admin.from('audit_log').insert({ business_id: input.businessId, actor_user_id: user.id, actor_type: 'ai_draft', action: 'claude_journal_draft_prepared', entity_type: 'source_document', entity_id: docId, after_state: { request_id: requestId, model: agent.model, source_method: input.sourceMethod, skill: skillAudit, source_hash_duplicate: Boolean(matchingSource), progressive_agent: { skill_loaded: agent.skillLoaded, references_loaded: agent.referencesLoaded, tool_calls: agent.toolCalls, input_tokens: agent.inputTokens, output_tokens: agent.outputTokens } } });
    await admin.from('private.skill_agent_runs').insert({ request_id: requestId, service: 'business_accounting', skill_name: 'my-journal-entry-preparation', skill_path: '/skills/my-journal-entry-preparation/SKILL.md', skill_loaded: agent.skillLoaded, references_loaded: agent.referencesLoaded, tool_calls: agent.toolCalls, model: agent.model, input_tokens: agent.inputTokens, output_tokens: agent.outputTokens, status: 'completed', business_id: input.businessId });
    return respond({ draft, requestId, sourceDocumentId: docId }, 200, requestId, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unexpected_error';
    console.error('journal_draft_failed', { operationId, code });
    return respond({ error: `Unable to prepare the journal draft. Reference: ${operationId}` }, 500, operationId, origin);
  }
});
