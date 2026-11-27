-- Keep a short, secret-free reason for failed AI calls (shown in Settings).
alter table public.ai_usage add column error text;
