-- Give Business Accounting a tracked 14-day trial and keep billing initiation server-side.
begin;

alter table public.business_subscriptions
  add column if not exists trial_ends_at timestamptz;

-- Existing workspaces predate trial tracking. Give them a documented 14-day rollout
-- window rather than deriving an already-expired date from their creation timestamp.
insert into public.business_subscriptions (business_id, status, trial_ends_at, updated_at)
select b.id, 'trial', now() + interval '14 days', now()
from public.businesses b
left join public.business_subscriptions s on s.business_id = b.id
where s.business_id is null;

update public.business_subscriptions
set trial_ends_at = now() + interval '14 days', updated_at = now()
where status = 'trial' and trial_ends_at is null;

create or replace function public.start_business_trial()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.business_subscriptions (business_id, status, trial_ends_at)
  values (new.id, 'trial', now() + interval '14 days')
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists business_trial_on_create on public.businesses;
create trigger business_trial_on_create
  after insert on public.businesses
  for each row execute function public.start_business_trial();

create or replace function public.mylekhpal_write_access(target_business uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare sub public.business_subscriptions%rowtype;
begin
  if not public.is_active_business_member(target_business) then return false; end if;
  select * into sub from public.business_subscriptions where business_id = target_business;
  if not found then return false; end if;
  if sub.status = 'trial' and (sub.trial_ends_at is null or now() >= sub.trial_ends_at) then return false; end if;
  if sub.status = 'restricted_read_only' then return false; end if;
  if sub.payment_due_at is not null and now() >= sub.payment_due_at + interval '7 days' then return false; end if;
  return sub.status in ('trial', 'active', 'payment_due');
end;
$$;

create or replace function public.enforce_business_write_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.mylekhpal_write_access(new.business_id) then
    raise exception 'The trial has ended or this business is read-only. Authorise a plan to continue.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists business_trial_write_guard on public.journal_entries;
create trigger business_trial_write_guard
  before insert on public.journal_entries
  for each row execute function public.enforce_business_write_access();

commit;
