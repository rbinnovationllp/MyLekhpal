-- OAuth state-consumption regression suite (psql).
-- Run only against a disposable database or confirmed synthetic business.
-- Required psql variables: business_id and user_id. Every inserted test row
-- is rolled back. This script never reads or writes OAuth tokens or codes.
\set ON_ERROR_STOP on

begin;
set local app.oauth_test_business_id = :'business_id';
set local app.oauth_test_user_id = :'user_id';

do $$
declare
  business_id uuid := current_setting('app.oauth_test_business_id')::uuid;
  user_id uuid := current_setting('app.oauth_test_user_id')::uuid;
  valid_hash text := 'qa-valid-' || gen_random_uuid()::text;
  expired_hash text := 'qa-expired-' || gen_random_uuid()::text;
  consumed_count integer;
begin
  -- Valid state: exactly one caller receives it, then it is gone.
  insert into private.workspace_google_oauth_states
    (state_hash, service_area, business_id, household_id, user_id, expires_at)
  values (valid_hash, 'business', business_id, null, user_id, now() + interval '5 minutes');
  select count(*) into consumed_count from public.google_oauth_consume_state(valid_hash);
  if consumed_count <> 1 then raise exception 'valid state was not consumed once'; end if;
  select count(*) into consumed_count from public.google_oauth_consume_state(valid_hash);
  if consumed_count <> 0 then raise exception 'already-consumed state was reusable'; end if;

  -- Missing state: no row is returned.
  select count(*) into consumed_count from public.google_oauth_consume_state('qa-missing-' || gen_random_uuid()::text);
  if consumed_count <> 0 then raise exception 'missing state was accepted'; end if;

  -- Expired state: no row is returned. Expired-row cleanup is intentionally
  -- separate from consumption and must not make an expired state usable.
  insert into private.workspace_google_oauth_states
    (state_hash, service_area, business_id, household_id, user_id, expires_at)
  values (expired_hash, 'business', business_id, null, user_id, now() - interval '1 minute');
  select count(*) into consumed_count from public.google_oauth_consume_state(expired_hash);
  if consumed_count <> 0 then raise exception 'expired state was accepted'; end if;

  raise notice 'OAuth valid, missing, expired and already-consumed tests passed; outer transaction will roll back.';
end;
$$;

-- Concurrency test (requires two psql sessions and a committed disposable
-- fixture because a transaction-local inserted state is not visible to session B):
-- 1. Insert a synthetic unexpired state and COMMIT in a disposable environment.
-- 2. Session A: BEGIN; SELECT * FROM public.google_oauth_consume_state('<hash>');
-- 3. Session B: SELECT * FROM public.google_oauth_consume_state('<hash>');
-- 4. Commit Session A. Session B must return zero rows, never the same state.
-- 5. Remove the committed synthetic fixture through the agreed cleanup process.

rollback;
