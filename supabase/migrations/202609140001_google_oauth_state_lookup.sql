-- Split state retrieval from deletion. This makes callback failures diagnosable and
-- preserves the one-time state until a connection has been fully saved.
create or replace function public.google_oauth_lookup_state(p_state_hash text)
returns table(service_area text, business_id uuid, household_id uuid, user_id uuid, expires_at timestamptz)
language sql security definer set search_path = private, public as $$
  select service_area, business_id, household_id, user_id, expires_at
  from private.workspace_google_oauth_states
  where state_hash = p_state_hash and expires_at > now();
$$;

create or replace function public.google_oauth_delete_state(p_state_hash text)
returns void language sql security definer set search_path = private, public as $$
  delete from private.workspace_google_oauth_states where state_hash = p_state_hash;
$$;

revoke all on function public.google_oauth_lookup_state(text) from public;
revoke all on function public.google_oauth_delete_state(text) from public;
grant execute on function public.google_oauth_lookup_state(text) to service_role;
grant execute on function public.google_oauth_delete_state(text) to service_role;
