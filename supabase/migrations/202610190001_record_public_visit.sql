-- Records privacy-preserving visit aggregates through a service-role-only RPC.
begin;

create or replace function public.record_public_visit(
  visitor_hash_input text,
  suspected_bot_input boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  observed_at timestamptz := now();
  observed_date date := (now() at time zone 'Asia/Kolkata')::date;
  previous_last_seen timestamptz;
  is_new_session boolean;
begin
  if visitor_hash_input !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid anonymous visitor identity.' using errcode = '22023';
  end if;

  select v.last_seen_at
    into previous_last_seen
    from private.website_visitors as v
    where v.visitor_hash = visitor_hash_input
    for update;

  is_new_session := previous_last_seen is null
    or observed_at - previous_last_seen >= interval '30 minutes';

  insert into private.website_visitors as v (
    visitor_hash,
    first_seen_at,
    last_seen_at,
    total_sessions,
    suspected_bot
  ) values (
    visitor_hash_input,
    observed_at,
    observed_at,
    1,
    suspected_bot_input
  )
  on conflict (visitor_hash) do update
    set last_seen_at = excluded.last_seen_at,
        total_sessions = v.total_sessions + case when is_new_session then 1 else 0 end,
        suspected_bot = v.suspected_bot or excluded.suspected_bot;

  insert into private.website_visit_days as d (
    visitor_hash,
    visit_date,
    sessions,
    last_seen_at
  ) values (
    visitor_hash_input,
    observed_date,
    1,
    observed_at
  )
  on conflict (visitor_hash, visit_date) do update
    set last_seen_at = excluded.last_seen_at,
        sessions = d.sessions + case when is_new_session then 1 else 0 end;
end;
$$;

revoke all on function public.record_public_visit(text, boolean) from public;
revoke all on function public.record_public_visit(text, boolean) from anon;
revoke all on function public.record_public_visit(text, boolean) from authenticated;
grant execute on function public.record_public_visit(text, boolean) to service_role;

commit;
