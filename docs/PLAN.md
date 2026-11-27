# IELTS Coach — build plan (approved 2026-11-26)

Single-user IELTS Academic coach. UI kk/ru/en, exam content English. $0: Next.js on Vercel,
Supabase (auth, Postgres, Storage, RLS), Groq (LLM + Whisper) with Gemini fallback, Web Speech TTS.

## Decisions
- Exam date / target / level come from onboarding, editable in Settings.
- Sign-in locked to `ALLOWED_EMAIL` (app + proxy); after first login disable sign-ups in Supabase.
- Sign-in by emailed 6-digit code or link (works across devices).
- Study plan is rule-based (`src/lib/plan/engine.ts`): phases by days left (foundation >30,
  timed practice 17–30, mocks 3–16 with mocks at 13/8/4 days left, taper ≤2), skill weights from
  band gap with Writing ×1.3; rebuilt weekly or on demand. AI is used only for scoring/feedback/
  generation/tutor.
- Long tests are generated in parts and cached in `generated_tests`.
- `aiClient`: Groq → Gemini on 429/5xx, retries, zod-validated JSON with one repair retry,
  every call logged in `ai_usage`. `AI_MOCK=1` for keyless local testing.
- Next.js 16 Cache Components disabled (every page is per-user/dynamic).
- Diagnostic arrives with the modules (Day 5); until then the plan uses the self-reported level.

## Build order
- Day 1 ✅ auth, DB + RLS, onboarding, dashboard (countdown, streak, bands, trend, today), plan, settings
- Day 2 ✅ Writing (aiClient, Task 1 visuals, exam mode, examiner scoring, corrections, Error Log feed)
- Day 4 Speaking (Web Speech examiner, recording, Whisper, feedback, recordings history)
- Day 5 Reading + Listening (+ diagnostic)
- Day 6 Error Log, Vocabulary (SM-2), AI tutor, full mock exam
