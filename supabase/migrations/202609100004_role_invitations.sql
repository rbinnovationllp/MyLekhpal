begin;

create table if not exists public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null check (role in ('accountant','ca_partner','preparer','reviewer','approver')),
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, email, role, status)
);
alter table public.business_invitations enable row level security;
create policy "invitees read own invitations" on public.business_invitations for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt()->>'email','')));

create or replace function public.mylekhpal_invite_member(target_business uuid, invite_email text, target_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); invitation_id uuid;
begin
  if actor is null then raise exception 'Sign in to continue.' using errcode='42501'; end if;
  if not exists (select 1 from public.business_memberships where business_id=target_business and user_id=actor and status='active' and role in ('owner','representative')) then
    raise exception 'Only a business owner or representative can invite a member.' using errcode='42501';
  end if;
  if lower(btrim(invite_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid email address.'; end if;
  if target_role not in ('accountant','ca_partner','preparer','reviewer','approver') then raise exception 'This role cannot be invited.' using errcode='22023'; end if;
  insert into public.business_invitations(business_id,email,role,invited_by) values(target_business,lower(btrim(invite_email)),target_role,actor) returning id into invitation_id;
  insert into public.audit_log(business_id,actor_user_id,actor_type,action,entity_type,entity_id,after_state)
    values(target_business,actor,'human','Member invited','business_invitation',invitation_id,jsonb_build_object('role',target_role));
  return invitation_id;
end; $$;

create or replace function public.mylekhpal_accept_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); invite public.business_invitations%rowtype;
begin
  if actor is null then raise exception 'Sign in to continue.' using errcode='42501'; end if;
  select * into invite from public.business_invitations where id=invitation_id for update;
  if not found or invite.status <> 'pending' or invite.expires_at < now() or lower(invite.email) <> lower(coalesce(auth.jwt()->>'email','')) then raise exception 'This invitation is unavailable.' using errcode='42501'; end if;
  insert into public.business_memberships(business_id,user_id,role,status) values(invite.business_id,actor,invite.role,'active')
    on conflict (business_id,user_id) do update set role=excluded.role,status='active';
  update public.business_invitations set status='accepted',accepted_by=actor,accepted_at=now() where id=invite.id;
  insert into public.audit_log(business_id,actor_user_id,actor_type,action,entity_type,entity_id,after_state)
    values(invite.business_id,actor,'human','Member invitation accepted','business_invitation',invite.id,jsonb_build_object('role',invite.role));
end; $$;
revoke all on function public.mylekhpal_invite_member(uuid,text,text) from public, anon;
revoke all on function public.mylekhpal_accept_invitation(uuid) from public, anon;
grant execute on function public.mylekhpal_invite_member(uuid,text,text) to authenticated;
grant execute on function public.mylekhpal_accept_invitation(uuid) to authenticated;
commit;
