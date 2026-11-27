-- Link Writing and Speaking work to a full mock exam.
alter table public.writing_submissions add column mock_id uuid references public.mock_exams (id) on delete set null;
alter table public.speaking_sessions add column mock_id uuid references public.mock_exams (id) on delete set null;
create index attempts_mock on public.attempts (mock_id) where mock_id is not null;
