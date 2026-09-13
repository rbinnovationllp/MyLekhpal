-- Company-managed document storage. One private bucket, logically isolated by workspace path.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mylekhpal-documents', 'mylekhpal-documents', false, 26214400,
  array['application/pdf','image/jpeg','image/png','image/webp','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.storage_plan_allowances (
  plan_code text primary key,
  service_area text not null check (service_area in ('business','personal')),
  included_bytes bigint not null check (included_bytes > 0),
  max_file_bytes integer not null check (max_file_bytes > 0),
  updated_at timestamptz not null default now()
);

create table if not exists private.managed_record_archives (
  entry_id uuid primary key references public.journal_entries(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null unique,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  content_hash text not null,
  retention_status text not null default 'active' check (retention_status in ('active','scheduled_for_deletion','deleted')),
  archived_at timestamptz not null default now()
);
alter table private.managed_record_archives enable row level security;

alter table public.source_documents drop constraint if exists source_documents_storage_provider_check;
alter table public.source_documents add constraint source_documents_storage_provider_check check (storage_provider in ('google_drive','internal_temp','ephemeral_processed_only','supabase_storage'));
alter table public.source_documents add column if not exists storage_path text, add column if not exists file_size_bytes bigint, add column if not exists retention_status text not null default 'active' check (retention_status in ('active','scheduled_for_deletion','deleted'));
alter table public.personal_documents drop constraint if exists personal_documents_storage_provider_check;
alter table public.personal_documents add constraint personal_documents_storage_provider_check check (storage_provider in ('google_drive','internal_temp','ephemeral_processed_only','supabase_storage'));
alter table public.personal_documents add column if not exists storage_path text, add column if not exists file_size_bytes bigint, add column if not exists retention_status text not null default 'active' check (retention_status in ('active','scheduled_for_deletion','deleted'));

-- Included in the existing subscription price. No separate storage charge is created here.
insert into public.storage_plan_allowances(plan_code, service_area, included_bytes, max_file_bytes) values
  ('micro_vendor_monthly', 'business', 104857600, 10485760), ('micro_vendor_yearly', 'business', 104857600, 10485760),
  ('small_business_monthly', 'business', 524288000, 26214400), ('small_business_yearly', 'business', 524288000, 26214400),
  ('business_plus_monthly', 'business', 2147483648, 26214400), ('business_plus_yearly', 'business', 2147483648, 26214400),
  ('accountant_bookkeeper_monthly', 'business', 5368709120, 26214400), ('accountant_bookkeeper_yearly', 'business', 5368709120, 26214400),
  ('ca_practice_monthly', 'business', 10737418240, 26214400), ('ca_practice_yearly', 'business', 10737418240, 26214400),
  ('personal_basic_monthly', 'personal', 262144000, 10485760), ('personal_basic_yearly', 'personal', 262144000, 10485760),
  ('personal_plus_monthly', 'personal', 524288000, 26214400), ('personal_plus_yearly', 'personal', 524288000, 26214400),
  ('professional_monthly', 'personal', 1073741824, 26214400), ('professional_yearly', 'personal', 1073741824, 26214400),
  ('premium_monthly', 'personal', 2147483648, 26214400), ('premium_yearly', 'personal', 2147483648, 26214400)
on conflict (plan_code) do update set included_bytes = excluded.included_bytes, max_file_bytes = excluded.max_file_bytes, updated_at = now();

alter table public.storage_plan_allowances enable row level security;
drop policy if exists "authenticated users read storage allowances" on public.storage_plan_allowances;
create policy "authenticated users read storage allowances" on public.storage_plan_allowances for select to authenticated using (true);

drop policy if exists "business members read their managed documents" on storage.objects;
create policy "business members read their managed documents" on storage.objects for select to authenticated using (
  bucket_id = 'mylekhpal-documents' and (storage.foldername(name))[1] = 'business'
  and public.is_active_business_member(((storage.foldername(name))[2])::uuid)
);
drop policy if exists "business members upload their managed documents" on storage.objects;
create policy "business members upload their managed documents" on storage.objects for insert to authenticated with check (
  bucket_id = 'mylekhpal-documents' and owner_id = auth.uid()::text and (storage.foldername(name))[1] = 'business'
  and public.is_active_business_member(((storage.foldername(name))[2])::uuid)
);
drop policy if exists "business members update their managed documents" on storage.objects;
create policy "business members update their managed documents" on storage.objects for update to authenticated using (
  bucket_id = 'mylekhpal-documents' and (storage.foldername(name))[1] = 'business'
  and public.is_active_business_member(((storage.foldername(name))[2])::uuid)
) with check (
  bucket_id = 'mylekhpal-documents' and owner_id = auth.uid()::text and (storage.foldername(name))[1] = 'business'
  and public.is_active_business_member(((storage.foldername(name))[2])::uuid)
);
drop policy if exists "business members delete their managed documents" on storage.objects;
create policy "business members delete their managed documents" on storage.objects for delete to authenticated using (
  bucket_id = 'mylekhpal-documents' and (storage.foldername(name))[1] = 'business'
  and public.is_active_business_member(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "household members read their managed documents" on storage.objects;
create policy "household members read their managed documents" on storage.objects for select to authenticated using (
  bucket_id = 'mylekhpal-documents' and (storage.foldername(name))[1] = 'personal'
  and public.is_active_household_member(((storage.foldername(name))[2])::uuid)
);
drop policy if exists "household members upload their managed documents" on storage.objects;
create policy "household members upload their managed documents" on storage.objects for insert to authenticated with check (
  bucket_id = 'mylekhpal-documents' and owner_id = auth.uid()::text and (storage.foldername(name))[1] = 'personal'
  and public.is_active_household_member(((storage.foldername(name))[2])::uuid)
);
drop policy if exists "household members delete their managed documents" on storage.objects;
create policy "household members delete their managed documents" on storage.objects for delete to authenticated using (
  bucket_id = 'mylekhpal-documents' and (storage.foldername(name))[1] = 'personal'
  and public.is_active_household_member(((storage.foldername(name))[2])::uuid)
);

commit;
