-- The private schema is deliberately not PostgREST-exposed. These service-role-only
-- RPCs let Edge Functions manipulate OAuth state and encrypted token records safely.
create or replace function public.google_oauth_log(
  p_request_id uuid, p_stage text, p_outcome text, p_service_area text default null,
  p_workspace_id uuid default null, p_user_id uuid default null, p_error_code text default null
) returns void language sql security definer set search_path = private, public as $$
  insert into private.google_oauth_diagnostics(request_id, stage, outcome, service_area, workspace_id, user_id, error_code)
  values (p_request_id, p_stage, p_outcome, p_service_area, p_workspace_id, p_user_id, p_error_code);
$$;

create or replace function public.google_oauth_create_state(
  p_state_hash text, p_service_area text, p_business_id uuid, p_household_id uuid, p_user_id uuid, p_expires_at timestamptz
) returns void language sql security definer set search_path = private, public as $$
  insert into private.workspace_google_oauth_states(state_hash, service_area, business_id, household_id, user_id, expires_at)
  values (p_state_hash, p_service_area, p_business_id, p_household_id, p_user_id, p_expires_at);
$$;

create or replace function public.google_oauth_consume_state(p_state_hash text)
returns table(service_area text, business_id uuid, household_id uuid, user_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = private, public as $$
begin
  return query delete from private.workspace_google_oauth_states
    where state_hash = p_state_hash and expires_at > now()
    returning workspace_google_oauth_states.service_area, workspace_google_oauth_states.business_id, workspace_google_oauth_states.household_id, workspace_google_oauth_states.user_id, workspace_google_oauth_states.expires_at;
end;
$$;

create or replace function public.google_oauth_store_secret(p_connection_id uuid, p_refresh text, p_access text, p_expires_at timestamptz)
returns void language sql security definer set search_path = private, public as $$
  insert into private.workspace_google_connection_secrets(connection_id, refresh_token_ciphertext, access_token_ciphertext, access_token_expires_at, encryption_version, rotated_at)
  values (p_connection_id, p_refresh, p_access, p_expires_at, 1, now())
  on conflict (connection_id) do update set refresh_token_ciphertext = excluded.refresh_token_ciphertext, access_token_ciphertext = excluded.access_token_ciphertext, access_token_expires_at = excluded.access_token_expires_at, rotated_at = now();
$$;

create or replace function public.google_oauth_get_secret(p_connection_id uuid)
returns table(refresh_token_ciphertext text, access_token_ciphertext text, access_token_expires_at timestamptz)
language sql security definer set search_path = private, public as $$
  select refresh_token_ciphertext, access_token_ciphertext, access_token_expires_at from private.workspace_google_connection_secrets where connection_id = p_connection_id;
$$;

revoke all on function public.google_oauth_log(uuid,text,text,text,uuid,uuid,text) from public;
revoke all on function public.google_oauth_create_state(text,text,uuid,uuid,uuid,timestamptz) from public;
revoke all on function public.google_oauth_consume_state(text) from public;
revoke all on function public.google_oauth_store_secret(uuid,text,text,timestamptz) from public;
revoke all on function public.google_oauth_get_secret(uuid) from public;
grant execute on function public.google_oauth_log(uuid,text,text,text,uuid,uuid,text) to service_role;
grant execute on function public.google_oauth_create_state(text,text,uuid,uuid,uuid,timestamptz) to service_role;
grant execute on function public.google_oauth_consume_state(text) to service_role;
grant execute on function public.google_oauth_store_secret(uuid,text,text,timestamptz) to service_role;
grant execute on function public.google_oauth_get_secret(uuid) to service_role;
