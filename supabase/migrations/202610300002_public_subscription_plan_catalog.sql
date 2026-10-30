-- PREPARED ONLY: do not apply until RBIL approves business-plan prices and the
-- public catalogue contract. Provider identifiers stay in the base table.
begin;

-- Business plans predate a public price catalogue. Fields are nullable so this
-- migration neither invents nor changes the approved Razorpay price mapping.
alter table public.subscription_plans
  add column if not exists price_inclusive_gst_paise integer,
  add column if not exists currency char(3) not null default 'INR',
  add column if not exists gst_rate_percent numeric(5,2),
  add column if not exists gst_included boolean not null default true,
  add column if not exists public_entitlement_summary text;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_price_inclusive_gst_paise_check;
alter table public.subscription_plans
  add constraint subscription_plans_price_inclusive_gst_paise_check
  check (price_inclusive_gst_paise is null or price_inclusive_gst_paise > 0);
alter table public.subscription_plans
  drop constraint if exists subscription_plans_gst_rate_percent_check;
alter table public.subscription_plans
  add constraint subscription_plans_gst_rate_percent_check
  check (gst_rate_percent is null or gst_rate_percent between 0 and 100);

-- This intentionally uses the view owner's privileges: anon/authenticated have
-- no base-table privilege, while this projection is the sole public surface.
create or replace view public.public_subscription_plan_catalog
with (security_barrier = true)
as
select
  code,
  display_name,
  interval,
  price_inclusive_gst_paise,
  currency,
  gst_rate_percent,
  gst_included,
  public_entitlement_summary,
  active
from public.subscription_plans
where active = true;

revoke all on table public.subscription_plans from public, anon, authenticated;
alter table public.subscription_plans enable row level security;

revoke all on table public.public_subscription_plan_catalog from public;
grant select on table public.public_subscription_plan_catalog to anon, authenticated;

comment on view public.public_subscription_plan_catalog is
  'Public business-plan catalogue. It deliberately excludes Razorpay IDs and operational fields.';

commit;

-- Before applying: populate price_inclusive_gst_paise, gst_rate_percent, and
-- public_entitlement_summary from an RBIL-approved business pricing schedule.
-- Do not derive, guess, or copy a price from Razorpay without that approval.
