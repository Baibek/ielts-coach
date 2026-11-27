-- Diagnostic runs reuse the Writing and Speaking flows.
alter table public.writing_submissions drop constraint if exists writing_submissions_mode_check;
alter table public.writing_submissions add constraint writing_submissions_mode_check check (mode in ('practice', 'exam', 'diagnostic'));

alter table public.speaking_sessions drop constraint if exists speaking_sessions_mode_check;
alter table public.speaking_sessions add constraint speaking_sessions_mode_check check (mode in ('practice', 'exam', 'diagnostic'));
alter table public.speaking_sessions drop constraint if exists speaking_sessions_part_check;
alter table public.speaking_sessions add constraint speaking_sessions_part_check check (part in (0, 1, 2, 3, 4)); -- 4 = Parts 1–2 (diagnostic)
