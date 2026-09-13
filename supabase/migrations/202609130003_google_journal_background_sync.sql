-- Queue business journal drafts for a connected workspace's private Google Sheet.
-- The queue is deliberately private: browser clients never receive OAuth tokens.
begin;

alter table public.workspace_google_connections
  add column if not exists spreadsheet_id text,
  add column if not exists spreadsheet_title text,
  add column if not exists last_synced_at timestamptz;

create table if not exists private.google_journal_sync_queue (
  entry_id uuid primary key references public.journal_entries(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  queued_at timestamptz not null default now(),
  synced_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text
);

alter table private.google_journal_sync_queue enable row level security;

create or replace function private.queue_google_journal_sync()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into private.google_journal_sync_queue(entry_id, business_id)
  values (new.id, new.business_id)
  on conflict (entry_id) do nothing;
  return new;
end;
$$;

drop trigger if exists queue_google_journal_sync_after_insert on public.journal_entries;
create trigger queue_google_journal_sync_after_insert
  after insert on public.journal_entries
  for each row execute function private.queue_google_journal_sync();

commit;
