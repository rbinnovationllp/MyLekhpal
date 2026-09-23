-- Explicit, business-scoped Google Sheets delivery targets.
-- Never identify a target by a client name at sync time.
begin;

create table if not exists public.business_google_journal_targets (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  storage_mode text not null check (storage_mode in ('client_owned','company_owned')),
  client_spreadsheet_id text,
  client_journal_sheet_id bigint,
  client_journal_sheet_title text,
  company_folder_id text,
  company_spreadsheet_id text,
  company_journal_sheet_id bigint,
  company_journal_sheet_title text,
  consent_granted_at timestamptz not null,
  consent_granted_by uuid not null references auth.users(id),
  consent_version text not null default 'google-sheets-delivery-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (storage_mode = 'client_owned' and company_folder_id is null and company_spreadsheet_id is null)
    or (storage_mode = 'company_owned' and client_spreadsheet_id is null)
  )
);

create table if not exists private.google_journal_sync_audit (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_id uuid references public.journal_entries(id) on delete set null,
  target_mode text not null check (target_mode in ('client_owned','company_owned')),
  spreadsheet_id text not null,
  worksheet_id bigint,
  action text not null check (action in ('configured','created','appended','already_present','failed')),
  entry_reference text,
  error_code text,
  created_at timestamptz not null default now()
);

alter table public.business_google_journal_targets enable row level security;
alter table private.google_journal_sync_audit enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'business_google_journal_targets' and policyname = 'members read Google journal target') then
    create policy "members read Google journal target" on public.business_google_journal_targets for select to authenticated using (public.is_active_business_member(business_id));
  end if;
end $$;

commit;
