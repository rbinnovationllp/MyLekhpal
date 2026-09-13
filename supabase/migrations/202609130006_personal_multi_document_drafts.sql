-- A draft can reference every source page in the submitted packet, in its client-selected order.
create table if not exists public.personal_finance_draft_documents (
  draft_id uuid not null references public.personal_finance_drafts(id) on delete cascade,
  document_id uuid not null references public.personal_documents(id) on delete restrict,
  page_order integer not null check (page_order > 0),
  created_at timestamptz not null default now(),
  primary key (draft_id, document_id),
  unique (draft_id, page_order)
);

alter table public.personal_finance_draft_documents enable row level security;
drop policy if exists "members read personal draft documents" on public.personal_finance_draft_documents;
create policy "members read personal draft documents" on public.personal_finance_draft_documents
for select to authenticated using (
  exists (select 1 from public.personal_finance_drafts d where d.id = draft_id and public.is_active_household_member(d.household_id))
);

-- Only one active run may process an identical household packet at a time.
create unique index if not exists personal_ai_active_input_once_idx
on private.personal_ai_processing_logs (household_id, input_hash)
where status = 'started';
