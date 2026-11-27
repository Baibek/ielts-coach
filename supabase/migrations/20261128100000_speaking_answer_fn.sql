-- Save one recorded answer into speaking_sessions.answers[index] atomically,
-- so answers transcribed in parallel never overwrite each other.
create function public.speaking_set_answer(p_id uuid, p_index int, p_answer jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.speaking_sessions
     set answers = jsonb_set(answers, array[p_index::text], coalesce(answers -> p_index, '{}'::jsonb) || p_answer, false)
   where id = p_id;
$$;

grant execute on function public.speaking_set_answer(uuid, int, jsonb) to authenticated;
