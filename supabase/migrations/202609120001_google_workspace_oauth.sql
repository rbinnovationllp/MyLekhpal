-- Google Drive OAuth for both isolated MyLekhapal workspaces.
-- Tokens are never exposed to browser clients; Edge Functions use the service role.
begin;

create table if not exists public.workspace_google_connections (
  id uuid primary key default gen_random_uuid(),
  service_area text not null check (service_area in ('business','personal')),
  business_id uuid references public.businesses(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  connected_by_user_id uuid not null references auth.users(id) on delete cascade,
  google_account_email text not null,
  scope_granted text not null,
  connected_at timestamptz not null default now(),
  last_token_refresh_at timestamptz,
  sync_status text not null default 'connected' check (sync_status in ('connected','needs_reauthorization','revoked','error')),
  revoked_at timestamptz,
  check (
    (service_area = 'business' and business_id is not null and household_id is null)
    or (service_area = 'personal' and household_id is not null and business_id is null)
  )
);

create unique index if not exists workspace_google_connections_business_unique
  on public.workspace_google_connections(business_id) where business_id is not null and revoked_at is null;
create unique index if not exists workspace_google_connections_household_unique
  on public.workspace_google_connections(household_id) where household_id is not null and revoked_at is null;

create table if not exists private.workspace_google_connection_secrets (
  connection_id uuid primary key references public.workspace_google_connections(id) on delete cascade,
  refresh_token_ciphertext text not null,
  access_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  encryption_version smallint not null default 1,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create table if not exists private.workspace_google_oauth_states (
  state_hash text primary key,
  service_area text not null check (service_area in ('business','personal')),
  business_id uuid references public.businesses(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (service_area = 'business' and business_id is not null and household_id is null)
    or (service_area = 'personal' and household_id is not null and business_id is null)
  )
);

create table if not exists private.google_oauth_diagnostics (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  stage text not null,
  outcome text not null check (outcome in ('started','succeeded','failed')),
  service_area text check (service_area in ('business','personal')),
  workspace_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  error_code text,
  created_at timestamptz not null default now()
);

alter table public.workspace_google_connections enable row level security;
alter table private.workspace_google_connection_secrets enable row level security;
alter table private.workspace_google_oauth_states enable row level security;
alter table private.google_oauth_diagnostics enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_google_connections' and policyname = 'members read workspace Google connections') then
    create policy "members read workspace Google connections" on public.workspace_google_connections for select to authenticated using (
      (service_area = 'business' and public.is_active_business_member(business_id))
      or (service_area = 'personal' and public.is_active_household_member(household_id))
    );
  end if;
end $$;

commit;
