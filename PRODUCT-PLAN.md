# Mylekhpal — product and delivery specification

Domain: mylekhpal.com. Tagline: Daily Business Records to CA-Ready Books.

## Product requirements
Indian business owners record everyday activity; authorized staff prepare books; Chartered Accountants review, correct and approve. AI output remains provisional. No tax payment or filing is represented as completed without verified evidence. English and Hindi interfaces, mobile layouts, keyboard access and clear status labels are required.

Each accounting screen retains business name, Client ID, GSTIN, financial year and period. One-business users enter their business directly; CA users select a client. Switching clients clears unsaved client-specific operations after warning. Every total drills into source entries.

## Architecture and tenant isolation
Production target: TypeScript web frontend, server-only APIs, PostgreSQL with row-level security, private encrypted object storage, background processing queue and isolated development/staging/production environments. Sites can host a foundation preview; its SQLite/D1 storage is an architectural deviation from the recommended PostgreSQL target and must not be described as PostgreSQL RLS.

Authenticate each request and resolve active membership on the server. Never accept a submitted user identity or role. Require business_id on every accounting row and object metadata record. Composite foreign keys prevent cross-business references. Use PostgreSQL transaction-local tenant context with FORCE ROW LEVEL SECURITY and a non-owner runtime role. Application authorization additionally checks action permissions, assigned branches and period lock. Workers use explicit scoped service identities. Never infer access from possession of a record UUID.

## Roles and permissions
| Role | Scope | Allowed actions |
|---|---|---|
| Owner | Assigned business | Setup, memberships, prepare, submit, authorized approvals |
| Representative | Delegated business/branch | Upload and respond within delegation |
| Accounts staff | Assigned business | Prepare vouchers, reconciliation and reports |
| Entry preparer | Assigned business | Create/edit drafts; no posting |
| Reviewer | Assigned business | Review, query and return drafts |
| Approver | Assigned business | Approve complete balanced entries; post when permitted |
| Chartered Accountant | Invited businesses | Review books, adjustments, tax working papers and handover |
| CA partner | Firm assignments | Allocate staff and approve professional review |
| CA employee | Explicit client assignments | Prepare/review as delegated |
| Auditor | Granted periods | Read records and audit evidence |
| Read-only | Assigned business | Read; export only with explicit permission |
| Platform administrator | Platform metadata | Operate service; no implicit financial-data access |

Prevent self-approval where the configured workflow requires separation of duties. Require step-up MFA for sensitive roles and operations.

## Database schema design
All amounts are integer paise or exact decimal, never binary floating-point. All timestamps are UTC; business dates use the business timezone.

- users(id, external_subject, status); businesses(id, client_id UNIQUE, legal_name, trade_name, entity_type, pan, base_currency, timezone).
- memberships(business_id, user_id, role, branch_scope, status), UNIQUE(business_id,user_id,role).
- gst_registrations(id,business_id,gstin,state); financial_years(id,business_id,start_date,end_date); periods(id,business_id,financial_year_id,status,locked_at).
- branches(id,business_id,name,address); accounts(id,business_id,code,name,type,active), UNIQUE(business_id,code).
- parties(id,business_id,name,gstin,address); products(id,business_id,hsn_sac,unit); opening_balances(id,business_id,account_id,amount).
- entries(id,business_id,registration_id,period_id,voucher_number,type,transaction_date,posting_date,status,narration,source,version,prepared_by,reviewed_by,approved_by,reverses_entry_id), UNIQUE(business_id,period_id,voucher_number).
- journal_lines(id,business_id,entry_id,account_id,debit_paise,credit_paise,branch_id,cost_centre_id), CHECK nonnegative and exactly one debit/credit side.
- documents(id,business_id,entry_id,object_key,sha256,mime,bytes,scan_status,retention_until,legal_hold); extraction_runs(id,business_id,document_id,model_version,status,confidence,output,created_at).
- import_batches(id,business_id,mapping,status); import_rows(id,business_id,batch_id,row_number,status,errors,entry_id), UNIQUE(batch_id,row_number).
- reviews(id,business_id,entry_id,actor_id,decision,reason); queries(id,business_id,entry_id,question,response,status); handovers(id,business_id,period_id,status).
- bank_transactions(id,business_id,account_id,reference,date,amount_paise); matches(id,business_id,bank_transaction_id,entry_id,amount_paise).
- tax_workings(id,business_id,registration_id,period_id,version,status,components); obligations(id,business_id,period_id,type,due_date,revised_date,responsible_user,status); evidence(id,business_id,obligation_id,document_id,reference,verified_by).
- audit_events(id,business_id,actor_id,role,action,record_id,before_json,after_json,reason,created_at,previous_hash,event_hash); usage(id,business_id,period,storage_bytes,document_count); plans(id,limits); subscriptions(business_id,plan_id,status).

Database constraints plus a single transactional posting function enforce balanced compound entries, active accounts, completeness, reviewed status and unlocked periods. Posted entries are immutable; corrections use linked reversals or adjustments. Export jobs retain tenant scope and short-lived download authorization.

## Page map and wireframes
Public: hero → how it works → owner/CA benefits → start setup.
Authenticated: onboarding → business dashboard → journal register → entry audit view; documents → processing/clarification; bank reconciliation; GST centre; compliance calendar; CA review/handover; reports; settings.

Desktop: top identity strip / left navigation / main summaries / compact register / detail drawer. Mobile: sticky business identity / menu / stacked summaries / horizontally scrollable register / full-width details. Hero: clear promise left, illustrative books dashboard right, primary setup action and secondary product preview.

## API design
Versioned /api/v1 endpoints. Authentication required except public content and health. Validate schemas, tenant membership, role, period and optimistic version before mutations. Return structured 400/401/403/404/409/422 errors; do not reveal inaccessible records. Paginate lists and impose request limits.

- POST /businesses; GET/PATCH /businesses/:id; POST /businesses/:id/invitations.
- GET/POST /businesses/:id/entries; GET/PATCH /businesses/:id/entries/:entryId.
- POST entry actions /submit, /review, /approve, /post, /reverse with reason and idempotency key.
- POST /businesses/:id/documents/initiate; POST /documents/:id/finalize; GET authorized document download.
- POST /imports/preview and /imports/:id/commit; every input row receives an explicit result.
- GET /reports/:type; POST /exports; GET /exports/:id/status.
- POST /periods/:id/handover and /lock; GET /gst/workings; POST /obligations/:id/evidence.

## Storage and AI workflow
Quarantine uploads; validate extension, detected MIME, size and archive expansion; hash and scan before processing. Private object keys include opaque tenant/document IDs; downloads require fresh authorization. Never expose storage directly. Track quotas atomically. Legal hold blocks deletion. Encryption, retention, regional residency and backup controls require provider configuration and verification.

Upload → tenant identity confirmation → quarantine/scan → duplicate check → OCR → structured extraction with field confidence → wrong-client comparison → clarification → approved ledger suggestions → balanced journal draft → completeness validator → independent review. Never fabricate missing values. AI requests execute server-side, exclude credentials, use minimized scoped documents and record model/version. Extraction cannot authorize posting. Provider integration remains disabled until configured and tested.

## Security model
Least privilege, MFA, short-lived sessions, CSRF/origin validation, parameterized SQL, output escaping, CSP, rate limits, secure cookies, secret manager, rotation and dependency checks. Append-only audit with chained hashes and externally retained checkpoints; hashes alone do not prevent a privileged operator rewriting history. Monitor errors without financial document contents. Encrypted backups with scheduled isolated restoration exercises. Export consent, account closure, retention and deletion require auditable workflows.

## Development phases and release gates
1. Foundation: identity, onboarding drafts, Client IDs, memberships, tenant isolation, chart of accounts, quarantined storage.
2. Bookkeeping: compound vouchers, imports, extraction, duplicate checks, shared validator and audit view.
3. Collaboration: owner/CA dashboards, queries, approvals, handover and reports.
4. GST: reviewed indicative workings, configurable deadlines, evidence and reconciliation exceptions.
5. Automation: bank matching, recurring drafts, scoped jobs and authorized notifications.
6. Production: security, accounting, accessibility, performance and restoration validation; legal policies and monitored deployment.

## Test plan
Unit: exact amounts, balanced/unbalanced compound entries, required fields, GST working components and duplicate signals. Integration: cross-tenant reads/writes/document downloads/exports, forged roles, revoked membership, wrong-client uploads, oversized/malformed files, period locking, concurrent edits, reversal links, complete import row outcomes, idempotent retries and quota races. Workflow: blurred OCR clarification, reviewer corrections, owner responses, CA handover, evidence-gated filing status. Operational: backup restoration, queue retries, alerting, load and accessibility at mobile widths/200% zoom. A planned test is not a passing test; record actual results separately.

## Deployment and administrator guide
Use isolated staging with synthetic data first. Configure identity provider/MFA, production relational database, private object storage, scanner, queue, AI secret, notifications and monitoring. Apply reviewed migrations; run isolation and restore tests; obtain accounting/legal review; deploy with rollback and incident procedures. Connect mylekhpal.com only after validating the release and obtaining required DNS access. Domain purchase alone does not configure DNS or TLS. No direct GST filing/payment integration is authorized by this specification.

Administrators manage assignments and quotas without implicit access to books. Review failed jobs and security alerts; revoke compromised sessions; rotate secrets; rehearse restoration; retain incident and change records.

## Business-user guide
Create your business and confirm PAN/GSTIN, year and opening balances. Select the correct business before each upload. Resolve missing details, review drafts and submit the period to your accountant. Estimates are provisional. Do not interpret a draft, handover or uploaded receipt as proof of statutory filing.

## CA-user guide
Select an explicitly assigned client. Inspect source documents and journal lines, resolve queries and correct ledger/tax mappings. Approve only complete balanced entries under the business workflow. Reconcile tax workings, attach verified external payment/filing evidence where applicable, then lock a completed period. Use linked reversals for posted corrections.
