# MyLekhpal migration reconciliation — prepared, not executed

## Actual applied history

The read-only Management API reports seven recorded migrations, ending in
`202609100007_personal_finance_isolation`.

## Repository drift

The repository contains later migrations beginning with
`202609110008_personal_subscription_plan_catalogue` through
`202609150001_google_sheets_delivery_targets` and later public-metrics changes.
They are not recorded in the project migration history. The live catalog does
contain some objects associated with later work (Google journal targets and
triggers), which indicates untracked/manual execution or historical drift.

Do not replay or mark any migration as applied. First compare each migration's
idempotent statements to the catalog and capture an approved reconciliation
mapping.

## Exact reconciliation sequence for the 12 unrecorded migrations

Perform these checks read-only, in this order, and record the result for every
row as **present and compatible**, **absent**, or **present but different**.
Do not use `migration repair`, insert a migration-history row, or execute a
repository migration as part of this exercise.

| Migration | Required catalog markers to compare |
| --- | --- |
| `202609110008_personal_subscription_plan_catalogue` | `personal_subscription_plans`, `personal_subscriptions`, `personal_subscription_events`, `payment_events.household_id`, RLS and the three named select policies. |
| `202609110009_progressive_skill_agent_observability` | `private.skill_agent_runs`, its three indexes and RLS. |
| `202609120001_google_workspace_oauth` | Google connection, secret, state and diagnostics tables; two active-connection unique indexes; RLS and member-read policy. |
| `202609120002_business_trial_and_razorpay_authorisation` | trial columns/defaults, `start_business_trial`, `mylekhpal_write_access`, and `enforce_business_write_access` definitions/triggers. |
| `202609130003_google_journal_background_sync` | Google-connection sync columns, private queue, RLS, queue function and its trigger. |
| `202609130004_public_adoption_metrics` | private visitor/day/payment tables, indexes, `platform_admins`, RLS, and adoption-metrics function grants. |
| `202609130005_company_managed_storage` | storage bucket metadata, allowance/archive tables, document storage columns/checks, RLS and all storage-object policies. |
| `202609130006_personal_multi_document_drafts` | `personal_finance_draft_documents`, RLS/member policy and active-input unique index. |
| `202609130007_google_oauth_private_rpc` | five OAuth RPC definitions, `security definer`/search-path settings and `service_role`-only grants. |
| `202609140001_google_oauth_state_lookup` | lookup/delete RPC definitions, `security definer`/search-path settings and `service_role`-only grants. |
| `202609150001_google_sheets_delivery_targets` | business target and private sync-audit tables, RLS, policies, constraints and indexes. |
| `202610190001_record_public_visit` | `record_public_visit` definition, grants restricted to `service_role`, and its interaction with the public-metrics tables. |

For each compatible row, preserve the catalog evidence (object identity, owner,
definition, columns, constraints, indexes, RLS state, policies and grants) with
the repository file SHA. For any absent or different marker, stop: produce a
separate, reviewed repair proposal rather than treating the source migration as
safe to replay. Only after all twelve rows are approved as compatible may RBIL
approve a separate historical-recording procedure; that decision must not be
combined with a schema change.

## Approved preflight results

There are no `posted` journal entries and no journal entries in any status in
the live catalog, so the approved aggregate balance preflight found zero
unbalanced posted entries. This is compatible with installing a future-posting
guard, but it does not demonstrate the guard against real transactions.

Live catalog objects show that later migration content exists despite the absent
history records: personal subscription plan tables, Google workspace connection
tables, Google journal targets, and Google-sync/trial triggers are present.
Treat this as manual/untracked application until each source migration is
compared statement-by-statement; do not replay it.

## Journal correction

`202610300001_journal_posting_balance_guard.sql` is prepared only. It adds a
deferred constraint-trigger guard for `posted` entries, locks the parent entry
while evaluating totals, and preserves unbalanced drafts. Existing entries are
not scanned or changed by the migration. Before application, run a read-only
preflight query for existing posted entries whose debit and credit totals differ.

## Subscription catalogue risk

`public.subscription_plans` has RLS disabled and includes `razorpay_plan_id`.
Public pricing should remain possible, but a later approved correction should
use a public view exposing only display name, interval, price/entitlement fields
and active status, while enabling RLS on the base table. Confirm grants and the
current public pricing path before changing it.
