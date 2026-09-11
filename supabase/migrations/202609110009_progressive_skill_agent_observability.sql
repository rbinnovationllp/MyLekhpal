-- Private, administrator-only evidence that a progressively-disclosed skill was actually used.
create table if not exists private.skill_agent_runs (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  service text not null check (service in ('business_accounting', 'personal_finance')),
  skill_name text not null,
  skill_path text not null,
  skill_loaded boolean not null default false,
  references_loaded jsonb not null default '[]'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  status text not null check (status in ('completed', 'failed', 'rejected')),
  business_id uuid references public.businesses(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((business_id is not null)::integer + (household_id is not null)::integer = 1)
);

create index if not exists skill_agent_runs_service_created_idx on private.skill_agent_runs(service, created_at desc);
create index if not exists skill_agent_runs_business_idx on private.skill_agent_runs(business_id, created_at desc) where business_id is not null;
create index if not exists skill_agent_runs_household_idx on private.skill_agent_runs(household_id, created_at desc) where household_id is not null;
alter table private.skill_agent_runs enable row level security;
-- No client policy: only service-role backend and authorised internal administration paths may read this evidence.
