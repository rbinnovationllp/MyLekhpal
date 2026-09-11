-- Personal Finance & Tax Support is deliberately separate from business accounting.
-- This migration is additive: it does not alter the business journal workflow or data.
begin;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  preferred_language text not null default 'en-IN' check (preferred_language in ('en-IN','hi-IN')),
  retention_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member','professional_viewer')),
  status text not null default 'active' check (status in ('active','invited','revoked','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, user_id, role)
);

create table if not exists public.household_consents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('statement_analysis','tax_intake','professional_sharing')),
  status text not null default 'granted' check (status in ('granted','revoked')),
  scope jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.personal_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('bank_statement','tax_document','department_notice','income_proof','expense_record','other')),
  storage_provider text not null check (storage_provider in ('google_drive','internal_temp','ephemeral_processed_only')),
  file_name text not null,
  file_hash text not null,
  google_file_id text,
  masked_metadata jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received' check (processing_status in ('received','processing','ready_for_review','failed','deleted')),
  created_at timestamptz not null default now(),
  unique (household_id, file_hash)
);

create table if not exists public.personal_finance_drafts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_document_id uuid references public.personal_documents(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  service_mode text not null check (service_mode in ('household_budget','statement_analysis','liability_planning','goal_planning','retirement_planning','savings_education','tax_intake','department_notice','journal_handoff')),
  status text not null default 'draft' check (status in ('draft','pending_clarification','pending_professional_review','client_approved','rejected','superseded')),
  confidence text not null check (confidence in ('high','medium','low')),
  structured_output jsonb not null,
  revision_no integer not null default 1 check (revision_no > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_finance_usage_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('ai_document_processed','ai_tokens','professional_referral')),
  quantity bigint not null check (quantity >= 0),
  estimated_cost numeric(18,6) not null default 0 check (estimated_cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.personal_service_entitlements (
  household_id uuid primary key references public.households(id) on delete cascade,
  personal_finance_enabled boolean not null default false,
  professional_assistance_enabled boolean not null default false,
  monthly_ai_limit integer check (monthly_ai_limit is null or monthly_ai_limit > 0),
  source text not null default 'pending_commercial_mapping' check (source in ('trial','subscription','admin_grant','pending_commercial_mapping')),
  updated_at timestamptz not null default now()
);

create table if not exists private.personal_ai_processing_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  draft_id uuid references public.personal_finance_drafts(id) on delete set null,
  request_id text not null unique,
  skill_name text not null,
  skill_version text not null,
  provider text not null,
  model text,
  status text not null check (status in ('started','completed','failed','rejected')),
  input_hash text not null,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists household_memberships_user_active_idx on public.household_memberships(user_id, household_id) where status = 'active';
create index if not exists personal_documents_household_created_idx on public.personal_documents(household_id, created_at desc);
create index if not exists personal_drafts_household_created_idx on public.personal_finance_drafts(household_id, created_at desc);
create index if not exists personal_usage_household_created_idx on public.personal_finance_usage_records(household_id, created_at desc);

create or replace function public.is_active_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_memberships m
    where m.household_id = target_household and m.user_id = auth.uid()
      and m.status = 'active' and (m.access_expires_at is null or m.access_expires_at > now())
  );
$$;

revoke all on function public.is_active_household_member(uuid) from public, anon;
grant execute on function public.is_active_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
alter table public.household_consents enable row level security;
alter table public.personal_documents enable row level security;
alter table public.personal_finance_drafts enable row level security;
alter table public.personal_finance_usage_records enable row level security;
alter table public.personal_service_entitlements enable row level security;
alter table private.personal_ai_processing_logs enable row level security;

create policy "members read households" on public.households for select to authenticated using (public.is_active_household_member(id));
create policy "users create own household" on public.households for insert to authenticated with check (created_by = auth.uid());
create policy "members read household memberships" on public.household_memberships for select to authenticated using (public.is_active_household_member(household_id));
create policy "members read household consents" on public.household_consents for select to authenticated using (public.is_active_household_member(household_id));
create policy "members read personal documents" on public.personal_documents for select to authenticated using (public.is_active_household_member(household_id));
create policy "members read personal drafts" on public.personal_finance_drafts for select to authenticated using (public.is_active_household_member(household_id));
create policy "members read personal usage" on public.personal_finance_usage_records for select to authenticated using (public.is_active_household_member(household_id));
create policy "members read personal entitlements" on public.personal_service_entitlements for select to authenticated using (public.is_active_household_member(household_id));

commit;
