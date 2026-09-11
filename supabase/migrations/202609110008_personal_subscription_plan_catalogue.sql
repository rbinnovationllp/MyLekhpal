-- Personal Finance plans are deliberately separate from business subscription_plans.
-- Prices are stored in paise and are GST-inclusive, matching the live Razorpay plans.
begin;

create table if not exists public.personal_subscription_plans (
  code text primary key,
  display_name text not null,
  interval text not null check (interval in ('monthly', 'yearly')),
  razorpay_plan_id text not null unique,
  price_inclusive_gst_paise integer not null check (price_inclusive_gst_paise > 0),
  base_price_paise integer not null check (base_price_paise > 0),
  gst_rate_percent numeric(5,2) not null default 18.00 check (gst_rate_percent >= 0),
  scope_summary text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_subscriptions (
  household_id uuid primary key references public.households(id) on delete cascade,
  plan_code text references public.personal_subscription_plans(code),
  razorpay_subscription_id text unique,
  status text not null default 'pending_authorisation' check (status in ('pending_authorisation', 'trial', 'active', 'payment_due', 'restricted_read_only', 'cancelled', 'expired')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  payment_due_at timestamptz,
  restricted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_subscription_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('human', 'system')),
  action text not null,
  provider_event_id text unique,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.payment_events add column if not exists household_id uuid references public.households(id) on delete set null;

insert into public.personal_subscription_plans
  (code, display_name, interval, razorpay_plan_id, price_inclusive_gst_paise, base_price_paise, scope_summary)
values
  ('personal_basic_monthly', 'Personal Basic', 'monthly', 'plan_TafoCRYO08O0sw', 11700, 9900, 'Personal finance dashboard, income and expense tracking, budgeting, tax estimates, deduction guidance and document checklist.'),
  ('personal_basic_yearly', 'Personal Basic', 'yearly', 'plan_TafpkQOLlYMoLk', 117900, 99900, 'Personal finance dashboard, income and expense tracking, budgeting, tax estimates, deduction guidance and document checklist.'),
  ('personal_plus_monthly', 'Personal Plus', 'monthly', 'plan_Tafrg4J0BXf4o8', 23500, 19900, 'Everything in Personal Basic plus goals, financial planning, old/new tax regime comparison, tax-saving education and ITR preparation assistance.'),
  ('personal_plus_yearly', 'Personal Plus', 'yearly', 'plan_Taft1yBTrxyA08', 235900, 199900, 'Everything in Personal Basic plus goals, financial planning, old/new tax regime comparison, tax-saving education and ITR preparation assistance.'),
  ('professional_monthly', 'Professional', 'monthly', 'plan_TafuVYg0NYTBxT', 47100, 39900, 'Everything in Personal Plus plus multiple-income, capital-gains, advance-tax planning, professional-income and detailed-tax-report support.'),
  ('professional_yearly', 'Professional', 'yearly', 'plan_Tafvzvi8ZH4tZp', 471900, 399900, 'Everything in Personal Plus plus multiple-income, capital-gains, advance-tax planning, professional-income and detailed-tax-report support.'),
  ('premium_monthly', 'Premium', 'monthly', 'plan_TafxL4aYXKJt9w', 82500, 69900, 'Everything in Professional plus F&O, crypto and foreign-income document support, advanced scenarios, priority support and professional-review workflow.'),
  ('premium_yearly', 'Premium', 'yearly', 'plan_TafyjgzfZpNlDw', 825900, 699900, 'Everything in Professional plus F&O, crypto and foreign-income document support, advanced scenarios, priority support and professional-review workflow.')
on conflict (code) do update set
  display_name = excluded.display_name,
  interval = excluded.interval,
  razorpay_plan_id = excluded.razorpay_plan_id,
  price_inclusive_gst_paise = excluded.price_inclusive_gst_paise,
  base_price_paise = excluded.base_price_paise,
  scope_summary = excluded.scope_summary,
  active = true,
  updated_at = now();

alter table public.personal_subscription_plans enable row level security;
alter table public.personal_subscriptions enable row level security;
alter table public.personal_subscription_events enable row level security;
drop policy if exists "authenticated users read active personal subscription plans" on public.personal_subscription_plans;
create policy "authenticated users read active personal subscription plans"
  on public.personal_subscription_plans for select to authenticated using (active = true);
drop policy if exists "members read personal subscriptions" on public.personal_subscriptions;
create policy "members read personal subscriptions"
  on public.personal_subscriptions for select to authenticated using (public.is_active_household_member(household_id));
drop policy if exists "members read personal subscription events" on public.personal_subscription_events;
create policy "members read personal subscription events"
  on public.personal_subscription_events for select to authenticated using (public.is_active_household_member(household_id));

commit;
