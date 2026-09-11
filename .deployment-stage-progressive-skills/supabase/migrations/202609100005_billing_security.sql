begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.subscription_plans (
  code text primary key,
  display_name text not null,
  interval text not null check (interval in ('monthly','yearly')),
  razorpay_plan_id text unique,
  monthly_ai_limit integer not null check (monthly_ai_limit > 0),
  active boolean not null default true
);

insert into public.subscription_plans(code,display_name,interval,razorpay_plan_id,monthly_ai_limit) values
  ('micro_vendor_monthly','Micro Vendor','monthly','plan_Ta9yBoTk6fY2wJ',50),
  ('micro_vendor_yearly','Micro Vendor','yearly','plan_Ta9zltoRau0OiC',50),
  ('small_business_monthly','Small Business','monthly','plan_TaA14pmZd1Efn8',150),
  ('small_business_yearly','Small Business','yearly','plan_TaA2G8JyudGGNZ',150),
  ('business_plus_monthly','Business Plus','monthly','plan_TaA3WpKkuZfkQQ',500),
  ('business_plus_yearly','Business Plus','yearly','plan_TaA4lrbtOZNfdo',500),
  ('accountant_bookkeeper_monthly','Accountant / Bookkeeper','monthly','plan_TaA5xmsKT2c9kG',1000),
  ('accountant_bookkeeper_yearly','Accountant / Bookkeeper','yearly','plan_TaA7DQaCls78r5',1000),
  ('ca_practice_monthly','CA Practice','monthly','plan_TaA8RWBpYKJFDc',3000),
  ('ca_practice_yearly','CA Practice','yearly','plan_TaA9U7ghroF2WO',3000)
on conflict (code) do nothing;

create table if not exists public.business_subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  plan_code text references public.subscription_plans(code),
  razorpay_subscription_id text unique,
  status text not null default 'trial' check (status in ('trial','active','payment_due','restricted_read_only','cancelled','expired')),
  current_period_ends_at timestamptz,
  payment_due_at timestamptz,
  restricted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'razorpay'),
  provider_event_id text not null unique,
  business_id uuid references public.businesses(id) on delete set null,
  event_type text not null,
  verified boolean not null default false,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.professional_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  professional_type text not null check (professional_type in ('chartered_accountant','accountant_bookkeeper')),
  icai_membership_no text,
  verification_status text not null default 'not_submitted' check (verification_status in ('not_submitted','pending','verified','rejected')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_oauth_states (
  state_hash text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists private.google_connection_secrets (
  connection_id uuid primary key references public.google_connections(id) on delete cascade,
  refresh_token_ciphertext text not null,
  encryption_version smallint not null default 1,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);
create table if not exists public.report_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  report_type text not null check (report_type in ('journal','ledger','trial_balance','gst_summary')),
  format text not null check (format in ('xlsx','pdf')),
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','expired')),
  output_google_file_id text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.business_subscriptions enable row level security;
alter table public.payment_events enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.google_oauth_states enable row level security;
alter table private.google_connection_secrets enable row level security;
alter table public.report_jobs enable row level security;
create policy "members read report jobs" on public.report_jobs for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read subscription" on public.business_subscriptions for select to authenticated using (public.is_active_business_member(business_id));
create policy "users read own professional profile" on public.professional_profiles for select to authenticated using (user_id = auth.uid());
create policy "users create own professional profile" on public.professional_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "users update own unverified professional profile" on public.professional_profiles for update to authenticated using (user_id = auth.uid() and verification_status in ('not_submitted','rejected')) with check (user_id = auth.uid() and verification_status in ('not_submitted','pending'));

create or replace function public.mylekhpal_write_access(target_business uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare sub public.business_subscriptions%rowtype;
begin
  if not public.is_active_business_member(target_business) then return false; end if;
  select * into sub from public.business_subscriptions where business_id = target_business;
  if not found then return true; end if;
  if sub.status = 'restricted_read_only' then return false; end if;
  if sub.payment_due_at is not null and now() at time zone 'Asia/Kolkata' >= (sub.payment_due_at at time zone 'Asia/Kolkata') + interval '7 days' then return false; end if;
  return sub.status in ('trial','active','payment_due');
end; $$;

revoke all on function public.mylekhpal_write_access(uuid) from public, anon;
grant execute on function public.mylekhpal_write_access(uuid) to authenticated;
commit;
