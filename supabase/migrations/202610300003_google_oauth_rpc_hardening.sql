-- PREPARED ONLY: do not execute without RBIL approval and a verified Edge
-- Function service-role configuration. These public-schema SECURITY DEFINER
-- helpers are internal bridges to private OAuth state and token-ciphertext
-- tables; browser roles must never execute them.
begin;

revoke all on function public.google_oauth_log(uuid,text,text,text,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.google_oauth_create_state(text,text,uuid,uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.google_oauth_consume_state(text) from public, anon, authenticated;
revoke all on function public.google_oauth_store_secret(uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.google_oauth_get_secret(uuid) from public, anon, authenticated;
revoke all on function public.google_oauth_lookup_state(text) from public, anon, authenticated;
revoke all on function public.google_oauth_delete_state(text) from public, anon, authenticated;

grant execute on function public.google_oauth_log(uuid,text,text,text,uuid,uuid,text) to service_role;
grant execute on function public.google_oauth_create_state(text,text,uuid,uuid,uuid,timestamptz) to service_role;
grant execute on function public.google_oauth_consume_state(text) to service_role;
grant execute on function public.google_oauth_store_secret(uuid,text,text,timestamptz) to service_role;
grant execute on function public.google_oauth_get_secret(uuid) to service_role;
grant execute on function public.google_oauth_lookup_state(text) to service_role;
grant execute on function public.google_oauth_delete_state(text) to service_role;

notify pgrst, 'reload schema';
commit;

-- Rollback is intentionally not an automatic public re-grant. If an approved
-- post-apply check proves an Edge Function is not using service_role, halt the
-- OAuth flow, correct that deployment configuration, and rerun verification.
-- Restoring browser-role execution would reintroduce the token/state exposure.
