# IELTS Coach

A personal IELTS Academic preparation app: a 6-week study plan, AI examiner feedback,
and progress that syncs between your laptop and phone. The interface is in Kazakh, with
Russian and English. Exam content is in English.

Everything runs on free tiers: Vercel, Supabase, Groq and Google Gemini.

> **Status:** Days 1–2 are done: sign-in, database, dashboard, study plan, settings, and the **Writing** module.
> Speaking, Reading, Listening, Error Log, Vocabulary, Tutor and Mock exam come next.
> Their pages show "Coming soon" until then.

---

## What you need (all free)

| Service | What it's for | Sign up |
|---|---|---|
| GitHub | stores the code; Vercel deploys from it | https://github.com |
| Supabase | sign-in, database, audio storage | https://supabase.com |
| Groq | main AI model and speech-to-text | https://console.groq.com |
| Google AI Studio | backup AI model (Gemini) | https://aistudio.google.com |
| Vercel | hosts the website | https://vercel.com (sign in with GitHub) |

On your computer: **Node.js 20 or newer** (https://nodejs.org, the "LTS" button) and **Git**.

---

## Step 1: Supabase (database and sign-in)

1. Go to https://supabase.com/dashboard and click **New project**.
   - Name: `ielts-coach`. Database password: generate one and save it somewhere.
   - Region: **Central EU (Frankfurt)** is the closest to Kazakhstan.
2. Wait about a minute for the project to start. Then open **SQL Editor → New query**.
3. Open the folder `supabase/migrations/` in this project. For **each file, in name order**
   (`20261126000000_init.sql`, then `20261127000000_writing.sql`, …), copy **all** of it, paste it into the editor
   and press **Run**. You should see "Success. No rows returned" each time.
   When a later update adds a new file to this folder, run just that new file the same way.
4. Open **Project Settings → API Keys** and copy:
   - **Project URL** (looks like `https://abcd.supabase.co`). It's under *Project Settings → Data API*.
   - **Publishable key** (starts with `sb_publishable_`). On older projects this is the `anon` key; that works too.
5. Open **Authentication → Emails → Magic Link** (sometimes called *Email Templates*).
   Replace the message body with the contents of `supabase/templates/magic_link.html` and press **Save**.
   The template puts a **6-digit code** in the email, so you can request sign-in on your laptop and type the
   code on your phone, or the other way round.
6. Open **Authentication → URL Configuration**:
   - **Site URL**: for now `http://localhost:3000`. After Step 5 change it to your Vercel address.
   - **Redirect URLs**: add `http://localhost:3000/**` (and later `https://YOUR-APP.vercel.app/**`).

> The free Supabase email sender allows only a few emails per hour. You rarely need more than one:
> a sign-in lasts for weeks on each device.
>
> Free Supabase projects **pause after 7 days without any activity**. Using the app daily prevents this.
> If it ever pauses, open the Supabase dashboard and click **Restore**.

## Step 2: Groq API key (main AI)

1. Go to https://console.groq.com/keys, click **Create API Key**, and copy the key (starts with `gsk_`).
2. Open https://console.groq.com/docs/models and pick the strongest **production** text model
   (for example `openai/gpt-oss-120b` or `llama-3.3-70b-versatile`). That id goes into `GROQ_MODEL`.
   Speech-to-text uses `whisper-large-v3-turbo`.

## Step 3: Gemini API key (backup AI)

1. Go to https://aistudio.google.com/apikey and click **Create API key**. Copy it.
2. The model id goes into `GEMINI_MODEL`, for example `gemini-2.5-flash`. You can also use a newer Flash or Flash-Lite id
   from https://ai.google.dev/gemini-api/docs/models.

> On the free tier Google may use what you send to improve its products. That's fine for practice essays;
> don't paste anything private.

## Step 4: Run it on your computer

```bash
git clone https://github.com/YOUR-NAME/ielts-coach.git
```

```bash
cd ielts-coach
```

```bash
npm install
```

```bash
cp .env.example .env.local
```

Open `.env.local` in any text editor and fill it in:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcd.supabase.co      # from Step 1
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…   # from Step 1
ALLOWED_EMAIL=your.real@email.com                       # only this email can sign in
SITE_URL=http://localhost:3000
GROQ_API_KEY=gsk_…                                      # from Step 2
GROQ_MODEL=openai/gpt-oss-120b
GROQ_STT_MODEL=whisper-large-v3-turbo
GEMINI_API_KEY=…                                        # from Step 3
GEMINI_MODEL=gemini-2.5-flash
AI_MOCK=0
```

Then start it:

```bash
npm run dev
```

Open http://localhost:3000, enter your email, and type the code you receive.

`GROQ_API_KEY` and `GEMINI_API_KEY` never reach the browser: they have no `NEXT_PUBLIC_` prefix, and only server
code uses them. The Supabase publishable key is meant to be public, because Row Level Security protects your data.

## Step 5: Put it online with Vercel

1. Push the project to a **private** GitHub repository.
2. Go to https://vercel.com/new, choose the repository and click **Import**.
3. Open **Environment Variables** and add every line from your `.env.local`, with one change:
   `SITE_URL` = `https://YOUR-APP.vercel.app` (Vercel shows the address after the first deploy; you can add it then
   and redeploy).
4. Click **Deploy**.
5. Back in Supabase, under **Authentication → URL Configuration**:
   - set **Site URL** to `https://YOUR-APP.vercel.app`
   - add `https://YOUR-APP.vercel.app/**` to **Redirect URLs**.
6. Sign in on the website once. Then, in Supabase under **Authentication → Sign In / Providers**, turn **off**
   "Allow new users to sign up". You stay signed in, and nobody else can create an account.

**On your phone:** open the site and choose *Add to Home Screen* (Safari share menu, or the Chrome ⋮ menu).
It then opens like an app.

---

## Using the app

- **First visit:** set the exam date, target band and your rough level. A 6-week plan is created.
- **Home:** countdown, streak, your band per skill and overall (official IELTS rounding), progress chart,
  and today's 3–5 tasks. Tap the circle to tick a task; tap the task to open it.
- **Plan:** every day until the exam.
  - Weeks 1–2: skills and strategies. Weeks 3–4: timed practice on weak skills.
  - Weeks 5–6: full mock tests (1 in week 5, 2 in week 6) plus error review. The last 2 days are light.
  - The plan rebuilds itself every week from your latest results. **Rebuild plan now** does it immediately.
- **Writing:**
  - Choose Task 1 or Task 2, in **Practice** (no time limit) or **Exam mode** (20/40-minute timer, no spellcheck).
    In exam mode your answer is sent automatically when time runs out, like the computer-delivered test.
  - Task 1 shows bar, line and pie charts, tables, process diagrams and before/after maps.
  - 24 built-in tasks work without AI. **New task from AI** creates fresh ones, which are saved and reused.
  - The AI examiner scores the four official criteria with quotes from your text. The same exam rules are always
    applied on top: too few words or an off-topic answer caps the score.
  - You get inline corrections (tap a highlighted phrase), two paragraphs rewritten at Band 8, and the top 3 things
    to fix. Your mistakes are grouped by type in the Error Log.
  - If the AI limit is reached, your answer is still saved. Press **Score now** later.
  - Your draft is kept on the device, so a reload doesn't lose it.
- **Settings:** language, light/dark theme, language of AI explanations, exam details, today's AI usage per provider,
  sign out.

## For developers

```bash
npm test
```

Unit tests cover band rounding, raw-score→band tables, the plan engine, streaks, the trend chart, the AI client
(Groq → Gemini fallback, retries, JSON repair) and the Writing scoring rules.

To try the app without AI keys, set `AI_MOCK=1` in `.env.local`. You'll get fake feedback, clearly labelled as such.

```bash
npm run lint
```

```bash
npm run typecheck
```

### Local database (optional, needs Docker)

```bash
npm run db:start
```

This starts a local Supabase with the migration applied. Sign-in emails appear at http://127.0.0.1:54324.
Use `http://127.0.0.1:54321` and the printed publishable key in `.env.local`.

To check that Row Level Security isolates users:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql
```

### Project layout

```
src/
  app/
    login/, auth/callback/      sign-in (email code or link)
    (app)/                      signed-in pages: dashboard, plan, settings, modules
    (app)/actions.ts            server actions (plan ticks, onboarding, settings)
  components/ui/                buttons, cards, inputs (shadcn/ui style)
  components/app/, dashboard/   navigation, forms, task list, trend chart
  lib/
    ielts/                      band rounding, score tables, streak, trend
    plan/                       rule-based 6-week plan engine (no AI tokens)
    data/                       database queries
    i18n/                       kk / ru / en dictionaries
    supabase/                   Supabase clients
  proxy.ts                      session refresh + sign-in guard
supabase/
  migrations/                   database schema + Row Level Security
  templates/magic_link.html     sign-in email with code
tests/unit/                     vitest tests
```

## Credits and content policy

- UI components are adapted from [shadcn/ui](https://ui.shadcn.com) (MIT).
- Charts: [Recharts](https://recharts.org) (MIT). Icons: [Lucide](https://lucide.dev) (ISC).
- Built with [Next.js](https://nextjs.org) (MIT) and [Supabase](https://supabase.com) (Apache-2.0).
- **No Cambridge, IDP or British Council test material is included or copied.** All practice content is either
  generated by AI or uploaded by you. Band scores come from AI estimates and public band descriptors. They're a
  study guide, not an official result.
