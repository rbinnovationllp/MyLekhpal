begin;

alter table public.businesses add column if not exists onboarding_completed_at timestamptz;
alter table public.businesses add column if not exists is_test boolean not null default false;
alter table public.businesses add column if not exists suspended_at timestamptz;
alter table public.businesses add column if not exists deleted_at timestamptz;

create or replace function public.mark_business_onboarding_complete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.onboarding_completed_at is null and new.is_test = false then new.onboarding_completed_at = now(); end if;
  return new;
end; $$;
drop trigger if exists businesses_complete_on_insert on public.businesses;
create trigger businesses_complete_on_insert before insert on public.businesses for each row execute function public.mark_business_onboarding_complete();

create table if not exists public.anonymous_visitor_windows (
  visitor_hash text not null,
  network_hash text not null,
  window_start date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (visitor_hash, window_start)
);
create index if not exists anonymous_visitor_windows_window_idx on public.anonymous_visitor_windows (window_start desc);
create unique index if not exists anonymous_visitor_windows_network_window_key on public.anonymous_visitor_windows (network_hash, window_start);
alter table public.anonymous_visitor_windows enable row level security;

create or replace function public.public_adoption_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'unique_visitors_30d', (select count(*) from public.anonymous_visitor_windows where window_start >= (now() at time zone 'Asia/Kolkata')::date - 29),
    'registered_businesses', (select count(*) from public.businesses b where b.onboarding_completed_at is not null and not b.is_test and b.suspended_at is null and b.deleted_at is null),
    'active_subscribed_businesses', (select count(*) from public.business_subscriptions s join public.businesses b on b.id=s.business_id where s.status='active' and b.onboarding_completed_at is not null and not b.is_test and b.suspended_at is null and b.deleted_at is null)
  );
$$;
revoke all on function public.public_adoption_stats() from public;
grant execute on function public.public_adoption_stats() to anon, authenticated;

create or replace function public.record_public_visitor(visitor_hash_input text, network_hash_input text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_window date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if length(visitor_hash_input) <> 64 or length(network_hash_input) <> 64 then raise exception 'Invalid anonymous visitor identity.' using errcode='22023'; end if;
  insert into public.anonymous_visitor_windows(visitor_hash,network_hash,window_start)
    values(visitor_hash_input,network_hash_input,current_window)
    on conflict (network_hash,window_start) do update set last_seen_at=now();
end; $$;
revoke all on function public.record_public_visitor(text,text) from public;
grant execute on function public.record_public_visitor(text,text) to service_role;
commit;
