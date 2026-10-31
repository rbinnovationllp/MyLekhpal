-- PREPARED ONLY: do not apply until RBIL approves the reconciliation plan.
-- Drafts may be incomplete, but a posted entry must balance at transaction end.
begin;

create or replace function public.assert_posted_journal_is_balanced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_entry_id uuid;
  entry_status text;
  debit_total numeric;
  credit_total numeric;
  target_entry_ids uuid[];
begin
  -- A line can move between entries. Check both sides of that move.
  if tg_table_name = 'journal_entries' then
    target_entry_ids := array[new.id];
  elsif tg_op = 'INSERT' then
    target_entry_ids := array[new.entry_id];
  elsif tg_op = 'DELETE' then
    target_entry_ids := array[old.entry_id];
  else
    target_entry_ids := array[old.entry_id, new.entry_id];
  end if;

  -- Stable lock ordering serializes posts and line changes, including
  -- opposite-direction moves between two entries.
  for target_entry_id in
    select e.id
    from public.journal_entries as e
    where e.id = any(target_entry_ids)
    order by e.id
    for update
  loop
    select e.status into entry_status
    from public.journal_entries as e
    where e.id = target_entry_id;

    if entry_status is distinct from 'posted' then
      continue;
    end if;

    select coalesce(sum(l.debit), 0), coalesce(sum(l.credit), 0)
    into debit_total, credit_total
    from public.journal_lines as l
    where l.entry_id = target_entry_id;

    if debit_total <> credit_total then
      raise exception using
        errcode = '23514',
        message = 'A posted journal entry must balance.',
        hint = 'Keep the entry as a draft until its debit and credit totals are equal.';
    end if;
  end loop;

  return null;
end;
$$;

-- Trigger execution does not require EXECUTE privilege on this function.
revoke all on function public.assert_posted_journal_is_balanced() from public, anon, authenticated;

drop trigger if exists journal_lines_require_posted_balance on public.journal_lines;
create constraint trigger journal_lines_require_posted_balance
after insert or update or delete on public.journal_lines
deferrable initially deferred
for each row execute function public.assert_posted_journal_is_balanced();

drop trigger if exists journal_posting_requires_balance on public.journal_entries;
create constraint trigger journal_posting_requires_balance
after insert or update on public.journal_entries
deferrable initially deferred
for each row execute function public.assert_posted_journal_is_balanced();

commit;

-- Rollback (run only after confirming no other migration depends on the guard):
-- begin;
-- drop trigger if exists journal_lines_require_posted_balance on public.journal_lines;
-- drop trigger if exists journal_posting_requires_balance on public.journal_entries;
-- drop function if exists public.assert_posted_journal_is_balanced();
-- commit;
