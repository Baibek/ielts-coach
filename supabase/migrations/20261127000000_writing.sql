-- Day 2: Writing module support

-- Language for AI explanations (null = same as the interface language).
alter table public.profiles
  add column feedback_lang text check (feedback_lang in ('kk', 'ru', 'en'));

-- Error log now groups mistakes by a short "pattern" (e.g. "subject-verb agreement"),
-- so the same kind of mistake in different sentences counts as a repeat.
drop function if exists public.log_error(text, text, text, text, text);

create function public.log_error(
  p_category text, p_pattern text, p_example text, p_correction text, p_rule text, p_source text
) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.error_log (category, key, example, correction, rule, source)
  values (
    p_category,
    p_category || ':' || lower(regexp_replace(trim(coalesce(nullif(p_pattern, ''), p_example)), '\s+', ' ', 'g')),
    p_example, p_correction, p_rule, p_source
  )
  on conflict (user_id, key) do update
    set count = public.error_log.count + 1,
        last_seen = now(),
        example = excluded.example,
        correction = excluded.correction,
        rule = coalesce(excluded.rule, public.error_log.rule),
        resolved = false;
$$;

alter table public.error_log add column pattern text;

-- Keep the pattern text readable for the Error Log page.
create or replace function public.error_log_set_pattern()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pattern is null then
    new.pattern := split_part(new.key, ':', 2);
  end if;
  return new;
end;
$$;

create trigger error_log_pattern
  before insert on public.error_log
  for each row execute function public.error_log_set_pattern();

-- Writing: a submission can exist before it is scored (AI limit reached).
alter table public.writing_submissions add column mode text not null default 'practice'
  check (mode in ('practice', 'exam'));
alter table public.writing_submissions add column duration_sec int;
alter table public.writing_submissions add column status text not null default 'scored'
  check (status in ('pending', 'scored'));
