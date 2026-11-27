-- Run: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql
-- Verifies that Row Level Security isolates two users. Rolls back at the end.
begin;

insert into auth.users (id, email, aud, role, instance_id)
values ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
       ('00000000-0000-0000-0000-0000000000b2', 'b@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

-- profile rows are created by trigger
do $$ begin
  if (select count(*) from public.profiles where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2')) <> 2
  then raise exception 'profile trigger failed'; end if;
end $$;

-- act as user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into public.attempts (skill, band) values ('writing', 6.0);
select public.log_error('grammar', 'Subject-verb agreement', 'He go  to school', 'He goes to school', 'third person -s', 'writing');
select public.log_error('grammar', 'subject-verb  agreement', 'She play tennis', 'She plays tennis', null, 'writing');

do $$ begin
  if (select count from public.error_log where category = 'grammar') <> 2 then raise exception 'log_error did not dedupe'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'A sees other profiles'; end if;
end $$;

-- act as user B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.attempts) <> 0 then raise exception 'B can read A attempts'; end if;
  if (select count(*) from public.error_log) <> 0 then raise exception 'B can read A errors'; end if;
end $$;

-- B cannot write rows owned by A
do $$ begin
  begin
    insert into public.attempts (user_id, skill, band) values ('00000000-0000-0000-0000-0000000000a1', 'reading', 9);
    raise exception 'B inserted a row for A';
  exception when insufficient_privilege then null; -- expected: RLS violation
  end;
end $$;

update public.attempts set band = 9;  -- affects 0 rows for B
reset role;
do $$ begin
  if exists (select 1 from public.attempts where band = 9) then raise exception 'B updated A rows'; end if;
end $$;

-- every public table has RLS enabled
do $$ declare r record; begin
  for r in select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise exception 'RLS disabled on %', r.relname;
  end loop;
end $$;

select 'RLS CHECK PASSED' as result;
rollback;
