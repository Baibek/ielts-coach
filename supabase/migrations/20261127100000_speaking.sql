-- Day 4: Speaking module support.
-- One speaking_sessions row = one practice (Part 1, 2, 3 or a full test) with several recorded answers.

alter table public.speaking_sessions
  add column mode text not null default 'practice' check (mode in ('practice', 'exam')),
  add column answers jsonb not null default '[]'::jsonb,   -- [{part, question, path, duration_sec, transcript, metrics}]
  add column status text not null default 'pending' check (status in ('pending', 'scored')),
  add column set_ids text[] not null default '{}';

alter table public.speaking_sessions drop constraint if exists speaking_sessions_part_check;
alter table public.speaking_sessions add constraint speaking_sessions_part_check check (part in (0, 1, 2, 3)); -- 0 = full test

-- Allow overwriting an answer when the student re-records it.
create policy "own recordings update" on storage.objects
  for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
