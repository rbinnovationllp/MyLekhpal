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
