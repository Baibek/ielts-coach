-- Explicit Data API grants, so the app works even when the Supabase project was
-- created with "Grant API access to new tables automatically" turned off.
-- Row Level Security (enabled on every table) still limits each user to their own rows.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.log_error(text, text, text, text, text, text) to authenticated;

-- Tables added by later migrations get the same rights.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- Signed-out visitors get nothing from the public schema.
revoke all on all tables in schema public from anon;
