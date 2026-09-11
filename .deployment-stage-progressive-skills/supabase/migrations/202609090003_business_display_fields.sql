-- Correct business details returned to the Hostinger workspace; no stored data changes.
begin;
CREATE OR REPLACE FUNCTION public.mylekhpal_books(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  action text := payload->>'action';
  business_id uuid;
  b public.businesses%rowtype;
  role_name text;
  entry_id uuid;
  account_id uuid;
  entry_date date;
  year_number integer;
  line jsonb;
  line_number integer := 0;
  debit_value numeric;
  credit_value numeric;
  debit_total numeric := 0;
  credit_total numeric := 0;
  entry_lines jsonb := '[]'::jsonb;
  result jsonb;
  business_name text;
  reference_text text;
  narration_text text;
  pan_text text;
  gstin_text text;
  client_id text;
begin
  if actor is null then raise exception 'Sign in to continue.' using errcode = '42501'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 32000 then
    raise exception 'Invalid request or request too large.';
  end if;
  if action = 'list' then
    select jsonb_build_object('businesses', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'name', x.legal_name, 'client_id', x.workspace_settings->>'clientId',
      'year', x.workspace_settings->'year', 'status', 'Onboarding draft'
    ) order by x.created_at desc), '[]'::jsonb)) into result
    from public.businesses x where public.is_active_business_member(x.id);
    return result;
  end if;
  if action = 'createBusiness' then
    if payload->'confirmAccounts' is distinct from 'true'::jsonb then raise exception 'Confirm the starter chart of accounts.'; end if;
    business_name := btrim(payload->>'name');
    if business_name is null or length(business_name) not between 1 and 160 then raise exception 'Enter a business name (up to 160 characters).'; end if;
    if length(coalesce(payload->>'tradeName','')) > 160 or length(coalesce(payload->>'entityType','')) > 80
      or length(coalesce(payload->>'state','')) > 80 or length(coalesce(payload->>'address','')) > 500 then raise exception 'Check field lengths.'; end if;
    if coalesce(payload->>'year','') !~ '^20[0-9]{2}$|^2100$' then raise exception 'Select a valid financial year.'; end if;
    year_number := (payload->>'year')::integer;
    pan_text := upper(btrim(coalesce(payload->>'pan','')));
    gstin_text := upper(btrim(coalesce(payload->>'gstin','')));
    if pan_text <> '' and pan_text !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'PAN format is invalid.'; end if;
    if gstin_text <> '' and (gstin_text !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' or (pan_text <> '' and substring(gstin_text from 3 for 10) <> pan_text)) then raise exception 'GSTIN format or PAN does not match.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
    if (select count(*) from public.businesses where created_by = actor) >= 10 then raise exception 'Foundation preview allows up to 10 businesses.'; end if;
    business_id := gen_random_uuid();
    client_id := 'CL-' || upper(substring(replace(business_id::text,'-','') from 1 for 10));
    insert into public.businesses(id, legal_name, display_name, pan, gstins, created_by, workspace_settings)
    values(business_id, business_name, coalesce(nullif(btrim(payload->>'tradeName'),''), business_name), nullif(pan_text,''),
      case when gstin_text = '' then '{}'::text[] else array[gstin_text] end, actor,
      jsonb_build_object('year', year_number, 'clientId', client_id, 'entityType', payload->>'entityType', 'state', payload->>'state', 'address', payload->>'address'));
    insert into public.business_memberships(business_id,user_id,role) values(business_id,actor,'owner');
    insert into public.chart_of_accounts(business_id,code,name,type,created_by)
    select business_id,v.code,v.name,v.type,actor from (values
      ('1000','Cash','asset'),('1010','Bank','asset'),('1100','Customer receivables','asset'),
      ('2000','Supplier payables','liability'),('3000','Owner capital','equity'),('4000','Sales','income'),
      ('5000','Purchases','expense'),('5100','General expenses','expense')) v(code,name,type);
    insert into public.audit_log(business_id,actor_user_id,actor_type,action,entity_type,entity_id,after_state)
      values(business_id,actor,'human','Business created','business',business_id,jsonb_build_object('name',business_name,'clientId',client_id));
    return jsonb_build_object('id',business_id,'clientId',client_id);
  end if;
  begin business_id := (payload->>'business')::uuid;
  exception when invalid_text_representation then raise exception 'Business unavailable.' using errcode = '42501'; end;
  if business_id is null or not public.is_active_business_member(business_id) then raise exception 'Business unavailable.' using errcode = '42501'; end if;
  select * into b from public.businesses where id = business_id;
  select m.role into role_name from public.business_memberships m where m.business_id = b.id and m.user_id = actor and m.status = 'active'
    order by case m.role when 'owner' then 0 when 'representative' then 1 when 'accountant' then 2 when 'preparer' then 3 else 4 end limit 1;
  if action = 'read' then
    return jsonb_build_object(
      'business', jsonb_build_object('id',b.id,'name',b.legal_name,'trade_name',b.display_name,'client_id',b.workspace_settings->>'clientId',
        'year',b.workspace_settings->'year','pan',b.pan,'gstin',coalesce(b.gstins[1],''),'state',b.workspace_settings->>'state','address',b.workspace_settings->>'address','entity_type',b.workspace_settings->>'entityType','status','Onboarding draft','active_role',role_name),
      'accounts', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'type',initcap(a.type)) order by a.code)
        from public.chart_of_accounts a where a.business_id = b.id and a.is_active), '[]'::jsonb),
      'entries', coalesce((select jsonb_agg(j.value order by j.transaction_date desc, j.created_at desc) from (
        select e.transaction_date,e.created_at,jsonb_build_object('id',e.id,'date',e.transaction_date,'narration',e.description,'reference',e.entry_number,
          'status',initcap(e.status),'source','Manual','created_at',e.created_at,
          'total',coalesce((select sum(l.debit)*100 from public.journal_lines l where l.entry_id=e.id),0),
          'lines',coalesce((select jsonb_agg(jsonb_build_object('account',l.account_id,'debit',l.debit*100,'credit',l.credit*100) order by l.line_no)
            from public.journal_lines l where l.entry_id=e.id),'[]'::jsonb)::text) as value
        from public.journal_entries e where e.business_id=b.id order by e.transaction_date desc,e.created_at desc limit 500
      ) j),'[]'::jsonb),
      'audit',coalesce((select jsonb_agg(j.value order by j.created_at desc) from (
        select a.created_at,jsonb_build_object('id',a.id,'actor',a.actor_user_id,'action',a.action,'record_id',a.entity_id,
          'detail',a.after_state::text,'created_at',a.created_at) value
        from public.audit_log a where a.business_id=b.id order by a.created_at desc limit 100) j),'[]'::jsonb),
      'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'status',m.status))
        from public.business_memberships m where m.business_id=b.id),'[]'::jsonb));
  end if;
  if action <> 'createEntry' or action is null then raise exception 'Unsupported action.'; end if;
  -- Lock the membership while writing so revocation cannot race a draft insertion.
  perform 1 from public.business_memberships m where m.business_id=b.id and m.user_id=actor and m.status='active' and m.role in ('owner','representative','accountant','preparer') for share;
  if not found then raise exception 'Your assigned role cannot create journal drafts.' using errcode = '42501'; end if;
  if payload->'confirmBusiness' is distinct from 'true'::jsonb then raise exception 'Confirm the active business before saving.'; end if;
  narration_text := btrim(payload->>'narration'); reference_text := btrim(payload->>'reference');
  if narration_text is null or length(narration_text) not between 1 and 1000 or reference_text is null or length(reference_text) not between 1 and 100 then raise exception 'Check required fields and text lengths.'; end if;
  year_number := (b.workspace_settings->>'year')::integer;
  if year_number is null then raise exception 'The financial year has not been configured for this business.'; end if;
  if coalesce(payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Enter a valid date.'; end if;
  begin entry_date := (payload->>'date')::date;
  exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Enter a valid date.'; end;
  if entry_date < make_date(year_number,4,1) or entry_date > make_date(year_number+1,3,31) then raise exception 'Enter a valid date within the selected financial year.'; end if;
  if jsonb_typeof(payload->'lines') is distinct from 'array' then raise exception 'Use between 2 and 40 journal lines.'; end if;
  if jsonb_array_length(payload->'lines') not between 2 and 40 then raise exception 'Use between 2 and 40 journal lines.'; end if;
  for line in select value from jsonb_array_elements(payload->'lines') loop
    begin account_id := (line->>'account')::uuid;
    exception when invalid_text_representation then raise exception 'Choose an account belonging to this business.'; end;
    if account_id is null or not exists(select 1 from public.chart_of_accounts a where a.id=account_id and a.business_id=b.id and a.is_active) then raise exception 'Choose an account belonging to this business.'; end if;
    if coalesce(nullif(line->>'debit',''),'0') !~ '^\d{1,10}(\.\d{1,2})?$' or coalesce(nullif(line->>'credit',''),'0') !~ '^\d{1,10}(\.\d{1,2})?$' then raise exception 'Enter a non-negative amount with at most two decimal places.'; end if;
    debit_value := coalesce(nullif(line->>'debit',''),'0')::numeric; credit_value := coalesce(nullif(line->>'credit',''),'0')::numeric;
    if (debit_value>0) = (credit_value>0) then raise exception 'Each line needs either a debit or a credit, not both.'; end if;
    debit_total := debit_total+debit_value; credit_total := credit_total+credit_value;
    entry_lines := entry_lines || jsonb_build_array(jsonb_build_object('account',account_id,'debit',debit_value,'credit',credit_value));
  end loop;
  if debit_total <> credit_total then raise exception 'Debits and credits must balance.'; end if;
  if debit_total > 9999999999.99 then raise exception 'Entry amount exceeds the supported limit.'; end if;
  entry_id := gen_random_uuid();
  insert into public.journal_entries(id,business_id,entry_number,entry_type,transaction_date,financial_year,period,description,source_method,status,preparer_id)
    values(entry_id,b.id,reference_text,'journal',entry_date,year_number::text||'-'||(year_number+1)::text,to_char(entry_date,'YYYY-MM'),narration_text,'manual','draft',actor);
  for line in select value from jsonb_array_elements(entry_lines) loop
    line_number := line_number+1;
    insert into public.journal_lines(entry_id,line_no,account_id,debit,credit)
      values(entry_id,line_number,(line->>'account')::uuid,(line->>'debit')::numeric,(line->>'credit')::numeric);
  end loop;
  insert into public.audit_log(business_id,actor_user_id,actor_type,action,entity_type,entity_id,after_state)
    values(b.id,actor,'human','Draft created','journal_entry',entry_id,jsonb_build_object('reference',reference_text,'date',entry_date,'narration',narration_text,'lines',entry_lines,'total',debit_total,'status','draft'));
  return jsonb_build_object('id',entry_id,'status','Draft');
exception when unique_violation then
  raise exception 'This reference already exists. Review the existing entry before continuing.' using errcode = '23505';
end;
$function$
;
notify pgrst, 'reload schema';
commit;
