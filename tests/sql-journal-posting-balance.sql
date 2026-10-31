-- Journal posting balance regression suite (psql).
-- Run only against a disposable database or a confirmed synthetic business.
-- Required psql variables are synthetic IDs: business_id, user_id,
-- debit_account_id, and credit_account_id. Every mutation is rolled back.
--
-- psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v business_id='...' -v user_id='...' \
--   -v debit_account_id='...' -v credit_account_id='...' \
--   -f tests/sql-journal-posting-balance.sql
\set ON_ERROR_STOP on

begin;
set local app.balance_test_business_id = :'business_id';
set local app.balance_test_user_id = :'user_id';
set local app.balance_test_debit_account_id = :'debit_account_id';
set local app.balance_test_credit_account_id = :'credit_account_id';
set local request.jwt.claim.sub = :'user_id';
set local request.jwt.claim.role = 'authenticated';

do $$
declare
  business_id uuid := current_setting('app.balance_test_business_id')::uuid;
  user_id uuid := current_setting('app.balance_test_user_id')::uuid;
  debit_account_id uuid := current_setting('app.balance_test_debit_account_id')::uuid;
  credit_account_id uuid := current_setting('app.balance_test_credit_account_id')::uuid;
  balanced_id uuid := gen_random_uuid();
  incomplete_id uuid := gen_random_uuid();
  source_id uuid := gen_random_uuid();
  destination_id uuid := gen_random_uuid();
  rejected boolean;
  line_id uuid;
  outside_financial_year_date text;
begin
  -- 1. Balanced journal posting.
  set constraints all deferred;
  insert into public.journal_entries (id,business_id,entry_number,entry_type,transaction_date,financial_year,period,description,source_method,status,preparer_id)
  values (balanced_id,business_id,'SQL-BAL-' || left(balanced_id::text,8),'journal',current_date,'2099-2100',to_char(current_date,'YYYY-MM'),'synthetic balance test','manual','draft',user_id);
  insert into public.journal_lines (entry_id,line_no,account_id,debit,credit) values
    (balanced_id,1,debit_account_id,100,0),(balanced_id,2,credit_account_id,0,100);
  update public.journal_entries set status='posted' where id=balanced_id;
  set constraints all immediate;

  -- 2. An entry inserted directly as posted is rejected, even with no lines.
  rejected := false;
  begin
    set constraints all deferred;
    insert into public.journal_entries (id,business_id,entry_number,entry_type,transaction_date,financial_year,period,description,source_method,status,preparer_id)
    values (gen_random_uuid(),business_id,'SQL-UNB-' || left(gen_random_uuid()::text,8),'journal',current_date,'2099-2100',to_char(current_date,'YYYY-MM'),'synthetic rejection test','manual','posted',user_id);
    set constraints all immediate;
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'unbalanced posting was accepted'; end if;

  -- 3. Draft with incomplete lines remains allowed.
  set constraints all deferred;
  insert into public.journal_entries (id,business_id,entry_number,entry_type,transaction_date,financial_year,period,description,source_method,status,preparer_id)
  values (incomplete_id,business_id,'SQL-DRF-' || left(incomplete_id::text,8),'journal',current_date,'2099-2100',to_char(current_date,'YYYY-MM'),'synthetic incomplete draft','manual','draft',user_id);
  insert into public.journal_lines (entry_id,line_no,account_id,debit,credit) values (incomplete_id,1,debit_account_id,100,0);
  set constraints all immediate;

  -- 4. Posting the incomplete draft is rejected; balance it, then post it.
  rejected := false;
  begin
    set constraints all deferred;
    update public.journal_entries set status='posted' where id=incomplete_id;
    set constraints all immediate;
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'incomplete draft was posted'; end if;
  set constraints all deferred;
  insert into public.journal_lines (entry_id,line_no,account_id,debit,credit) values (incomplete_id,2,credit_account_id,0,100);
  update public.journal_entries set status='posted' where id=incomplete_id;
  set constraints all immediate;

  -- 5. Updating a posted line cannot make it unbalanced.
  select id into line_id from public.journal_lines where entry_id=balanced_id and debit > 0;
  rejected := false;
  begin
    set constraints all deferred;
    update public.journal_lines set debit=101 where id=line_id;
    set constraints all immediate;
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'unbalanced posted-line update was accepted'; end if;

  -- 6. Deleting a posted line cannot make it unbalanced.
  rejected := false;
  begin
    set constraints all deferred;
    delete from public.journal_lines where entry_id=balanced_id and credit > 0;
    set constraints all immediate;
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'unbalanced posted-line delete was accepted'; end if;

  -- 7. Moving one line checks both the source and destination posted entries.
  set constraints all deferred;
  insert into public.journal_entries (id,business_id,entry_number,entry_type,transaction_date,financial_year,period,description,source_method,status,preparer_id) values
    (source_id,business_id,'SQL-SRC-' || left(source_id::text,8),'journal',current_date,'2099-2100',to_char(current_date,'YYYY-MM'),'synthetic source','manual','draft',user_id),
    (destination_id,business_id,'SQL-DST-' || left(destination_id::text,8),'journal',current_date,'2099-2100',to_char(current_date,'YYYY-MM'),'synthetic destination','manual','draft',user_id);
  insert into public.journal_lines (entry_id,line_no,account_id,debit,credit) values
    (source_id,1,debit_account_id,100,0),(source_id,2,credit_account_id,0,100),
    (destination_id,1,debit_account_id,100,0),(destination_id,2,credit_account_id,0,100);
  update public.journal_entries set status='posted' where id in (source_id,destination_id);
  set constraints all immediate;
  rejected := false;
  begin
    set constraints all deferred;
    update public.journal_lines set entry_id=destination_id where entry_id=source_id and debit > 0;
    set constraints all immediate;
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'cross-entry line move was accepted'; end if;

  -- 10a. The RPC rejects a date outside the configured financial year.
  select make_date((b.workspace_settings->>'year')::integer - 1, 3, 31)::text
  into outside_financial_year_date
  from public.businesses as b where b.id=business_id;
  if outside_financial_year_date is null then
    raise exception 'synthetic business needs workspace_settings.year for test 10a';
  end if;
  rejected := false;
  begin
    perform public.mylekhpal_books(jsonb_build_object(
      'action','createEntry', 'business',business_id, 'confirmBusiness',true,
      'reference','SQL-FY-' || left(gen_random_uuid()::text,8),
      'narration','synthetic financial-year test', 'date',outside_financial_year_date, 'lines','[]'::jsonb));
  exception when raise_exception then
    rejected := position('within the selected financial year' in sqlerrm) > 0;
  end;
  if not rejected then raise exception 'financial-year restriction was not enforced'; end if;

  -- 10b. The subscription write guard rejects restricted businesses.
  if not exists (select 1 from public.business_subscriptions where business_id=business_id) then
    raise exception 'synthetic business needs a subscription row for test 10b';
  end if;
  update public.business_subscriptions set status='restricted_read_only' where business_id=business_id;
  rejected := false;
  begin
    insert into public.journal_entries (id,business_id,entry_number,entry_type,transaction_date,financial_year,period,description,source_method,status,preparer_id)
    values (gen_random_uuid(),business_id,'SQL-SUB-' || left(gen_random_uuid()::text,8),'journal',current_date,'2099-2100',to_char(current_date,'YYYY-MM'),'synthetic subscription test','manual','draft',user_id);
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'subscription restriction was not enforced'; end if;

  raise notice 'Journal balance tests 1-7 passed; outer transaction will roll back.';
end;
$$;

-- 8. Concurrency needs two psql sessions and committed disposable fixtures:
--    A: BEGIN; alter/post an entry; COMMIT.
--    B: concurrently alter a line on the same entry; COMMIT.
--    Parent-row locking must serialize the operations; any unbalanced final
--    state must fail with SQLSTATE 23514. Use a disposable database because a
--    successful COMMIT cannot be proven and then rolled back in another session.
-- 9. The ROLLBACK below proves this suite retains no synthetic test data.
rollback;
