-- Privacy-preserving public counter and verified live-payment adoption evidence.
begin;

create table if not exists private.website_visitors (
  visitor_hash text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  total_sessions integer not null default 1 check (total_sessions > 0),
  suspected_bot boolean not null default false
);

create table if not exists private.website_visit_days (
  visitor_hash text not null references private.website_visitors(visitor_hash) on delete cascade,
  visit_date date not null,
  sessions integer not null default 1 check (sessions > 0),
  last_seen_at timestamptz not null default now(),
  primary key (visitor_hash, visit_date)
);

create table if not exists private.razorpay_subscription_payments (
  payment_id text primary key,
  subscription_id text not null,
  business_id uuid references public.businesses(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  payment_status text not null check (payment_status in ('captured', 'refunded')),
  live_mode boolean not null,
  paid_at timestamptz not null,
  refunded_at timestamptz,
  check ((business_id is not null)::integer + (household_id is not null)::integer = 1)
);

create index if not exists razorpay_subscription_payments_active_business_idx
  on private.razorpay_subscription_payments(business_id, subscription_id) where payment_status = 'captured' and live_mode;
create index if not exists razorpay_subscription_payments_active_household_idx
  on private.razorpay_subscription_payments(household_id, subscription_id) where payment_status = 'captured' and live_mode;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.website_visitors enable row level security;
alter table private.website_visit_days enable row level security;
alter table private.razorpay_subscription_payments enable row level security;
alter table public.platform_admins enable row level security;

create or replace function private.public_adoption_metrics()
returns table (total_visitors bigint, unique_visitors bigint, registered_users bigint, active_adopters bigint)
language sql stable security definer set search_path = public, private
as $$
  select
    coalesce((select sum(total_sessions) from private.website_visitors where not suspected_bot), 0)::bigint,
    coalesce((select count(*) from private.website_visitors where not suspected_bot), 0)::bigint,
    coalesce((select count(distinct id) from public.profiles), 0)::bigint,
    (
      coalesce((select count(distinct s.business_id)
        from public.business_subscriptions s join private.razorpay_subscription_payments p
          on p.business_id = s.business_id and p.subscription_id = s.razorpay_subscription_id
        where s.status = 'active' and p.payment_status = 'captured' and p.live_mode), 0)
      + coalesce((select count(distinct s.household_id)
        from public.personal_subscriptions s join private.razorpay_subscription_payments p
          on p.household_id = s.household_id and p.subscription_id = s.razorpay_subscription_id
        where s.status = 'active' and p.payment_status = 'captured' and p.live_mode), 0)
    )::bigint;
$$;

revoke all on function private.public_adoption_metrics() from public;

create or replace function private.admin_adoption_metrics()
returns jsonb language sql stable security definer set search_path = public, private
as $$
  select jsonb_build_object(
    'summary', (select to_jsonb(m) from private.public_adoption_metrics() m),
    'dailyVisitors', coalesce((select jsonb_agg(jsonb_build_object('date', d.visit_date, 'sessions', d.sessions, 'uniqueVisitors', d.unique_visitors) order by d.visit_date)
      from (select visit_date, sum(sessions)::bigint as sessions, count(*)::bigint as unique_visitors from private.website_visit_days v join private.website_visitors i using (visitor_hash) where not i.suspected_bot and visit_date >= current_date - 29 group by visit_date) d), '[]'::jsonb),
    'paymentEvidence', jsonb_build_object(
      'capturedLivePayments', (select count(*) from private.razorpay_subscription_payments where payment_status = 'captured' and live_mode),
      'refundedPayments', (select count(*) from private.razorpay_subscription_payments where payment_status = 'refunded')
    )
  );
$$;
revoke all on function private.admin_adoption_metrics() from public;
commit;
