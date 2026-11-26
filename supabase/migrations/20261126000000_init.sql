-- IELTS Coach: initial schema
-- Every table is owned by one user and protected by Row Level Security.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  locale        text not null default 'kk' check (locale in ('kk', 'ru', 'en')),
  timezone      text not null default 'Asia/Almaty',
  exam_date     date,
  target_band   numeric(2,1) not null default 7.0 check (target_band between 4 and 9),
  start_level   numeric(2,1) check (start_level between 1 and 9),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- Create a profile row automatically for each new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- generated_tests: cache of every AI-generated item (prompts, passages, scripts)
-- ---------------------------------------------------------------------------
create table public.generated_tests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  skill       text not null check (skill in ('reading', 'listening', 'writing', 'speaking')),
  kind        text not null,
  content     jsonb not null,
  model       text,
  used_count  int not null default 0,
  created_at  timestamptz not null default now()
);
create index generated_tests_lookup on public.generated_tests (user_id, skill, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- mock_exams: groups the four attempts of one full mock
-- ---------------------------------------------------------------------------
create table public.mock_exams (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status       text not null default 'in_progress' check (status in ('in_progress', 'finished', 'abandoned')),
  report       jsonb,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

-- ---------------------------------------------------------------------------
-- attempts: one row per finished practice item (any skill)
-- ---------------------------------------------------------------------------
create table public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  skill         text not null check (skill in ('reading', 'listening', 'writing', 'speaking')),
  type          text not null default 'practice' check (type in ('practice', 'timed', 'diagnostic', 'mock')),
  test_id       uuid references public.generated_tests (id) on delete set null,
  mock_id       uuid references public.mock_exams (id) on delete set null,
  raw_score     int,
  max_score     int,
  band          numeric(2,1) check (band between 0 and 9),
  duration_sec  int,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index attempts_user_time on public.attempts (user_id, created_at desc);
create index attempts_user_skill on public.attempts (user_id, skill, created_at desc);

-- ---------------------------------------------------------------------------
-- writing_submissions
-- ---------------------------------------------------------------------------
create table public.writing_submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attempt_id  uuid references public.attempts (id) on delete cascade,
  test_id     uuid references public.generated_tests (id) on delete set null,
  task        text not null check (task in ('task1', 'task2')),
  prompt      jsonb,
  text        text not null,
  word_count  int not null default 0,
  scores      jsonb,
  feedback    jsonb,
  created_at  timestamptz not null default now()
);
create index writing_submissions_user_time on public.writing_submissions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- speaking_sessions
-- ---------------------------------------------------------------------------
create table public.speaking_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attempt_id    uuid references public.attempts (id) on delete cascade,
  part          int check (part in (1, 2, 3)),
  questions     jsonb,
  audio_url     text,           -- path inside the private "recordings" bucket
  transcript    text,
  duration_sec  int,
  scores        jsonb,
  feedback      jsonb,
  created_at    timestamptz not null default now()
);
create index speaking_sessions_user_time on public.speaking_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- error_log: repeated mistakes, deduplicated by a normalised key
-- ---------------------------------------------------------------------------
create table public.error_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category    text not null,
  key         text not null,
  example     text not null,
  correction  text not null,
  rule        text,
  source      text check (source in ('writing', 'speaking', 'reading', 'listening', 'tutor', 'manual')),
  count       int not null default 1,
  resolved    boolean not null default false,
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (user_id, key)
);

-- Insert a mistake, or bump its counter if the same one was logged before.
create function public.log_error(
  p_category text, p_example text, p_correction text, p_rule text, p_source text
) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.error_log (category, key, example, correction, rule, source)
  values (
    p_category,
    p_category || ':' || lower(regexp_replace(trim(p_example), '\s+', ' ', 'g')),
    p_example, p_correction, p_rule, p_source
  )
  on conflict (user_id, key) do update
    set count = public.error_log.count + 1,
        last_seen = now(),
        correction = excluded.correction,
        rule = coalesce(excluded.rule, public.error_log.rule),
        resolved = false;
$$;

-- ---------------------------------------------------------------------------
-- vocab_cards (SM-2 spaced repetition)
-- ---------------------------------------------------------------------------
create table public.vocab_cards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word            text not null,
  meaning         text,
  example         text,
  translation_kk  text,
  translation_ru  text,
  topic           text,
  source          text,
  ease            numeric(4,2) not null default 2.5,
  interval        int not null default 0,
  reps            int not null default 0,
  due_date        date not null default current_date,
  created_at      timestamptz not null default now()
);
create unique index vocab_cards_user_word on public.vocab_cards (user_id, lower(word));
create index vocab_cards_due on public.vocab_cards (user_id, due_date);

-- ---------------------------------------------------------------------------
-- study_plan: each row is a full plan version; the newest one is current
-- ---------------------------------------------------------------------------
create table public.study_plan (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date  date not null,
  exam_date   date not null,
  basis       jsonb not null default '{}'::jsonb,  -- bands the plan was built from
  days        jsonb not null,                      -- [{date, phase, light, tasks:[...]}]
  done_keys   text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index study_plan_user_time on public.study_plan (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- tutor_messages
-- ---------------------------------------------------------------------------
create table public.tutor_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index tutor_messages_user_time on public.tutor_messages (user_id, created_at);

-- ---------------------------------------------------------------------------
-- ai_usage: one row per AI call
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider    text not null check (provider in ('groq', 'gemini', 'mock')),
  model       text,
  feature     text,
  tokens_in   int not null default 0,
  tokens_out  int not null default 0,
  ok          boolean not null default true,
  created_at  timestamptz not null default now()
);
create index ai_usage_user_time on public.ai_usage (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: a user only ever sees and writes their own rows
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array[
    'generated_tests', 'mock_exams', 'attempts', 'writing_submissions',
    'speaking_sessions', 'error_log', 'vocab_cards', 'study_plan',
    'tutor_messages', 'ai_usage'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for speaking recordings, one folder per user
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('recordings', 'recordings', false, 10485760)
on conflict (id) do nothing;

create policy "own recordings read" on storage.objects
  for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own recordings write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own recordings delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
