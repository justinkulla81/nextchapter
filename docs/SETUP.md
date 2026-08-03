# Setup & Operations

This is the "I have never seen this codebase, how do I run it and keep it running" doc. It covers every external service, every environment variable, local development, deploys, and the scheduled jobs that keep the product running day-to-day.

See also: [PRODUCT_VISION_CANDIDATE.md](./PRODUCT_VISION_CANDIDATE.md), [PRODUCT_VISION_ADMIN_ORGS.md](./PRODUCT_VISION_ADMIN_ORGS.md), [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [SCRIPTS.md](./SCRIPTS.md).

## Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript, Server Actions)
- **Database**: PostgreSQL via Supabase, accessed through Prisma 6 (`prisma/schema.prisma` is the schema source of truth)
- **Auth**: Supabase Auth (email/password + magic link; no OAuth providers configured today — see `IDEAS.md` for deferred Google Sign-In)
- **Styling**: Tailwind CSS v4, CSS-first config — there is no `tailwind.config.ts`; every design token lives as a CSS custom property in `src/app/globals.css`'s `@theme inline` block. See `DESIGN_SYSTEM.md`.
- **UI primitives**: `@base-ui/react` (not shadcn/Radix) for interactive components like `Button`
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`), used throughout — resume analysis, job-fit feedback, Victoria (the AI coach persona), report generation, LinkedIn/Substack content generation
- **Email**: Resend (transactional email — reminders, reports, digests, reference requests)
- **Analytics**: PostHog (product analytics, server + client events) and Google Analytics 4 (public marketing pages only)
- **Hosting**: Vercel (the app is linked via `.vercel/project.json` — project `nextchapter`, team `launchyournextchapter`)
- **Image generation**: Google Gemini API ("Nano Banana" — headshot/banner generation for org landing pages)

## External services & accounts needed

| Service | Used for | Required for local dev? |
|---|---|---|
| **Supabase** | Postgres database + auth | Yes — nothing runs without it |
| **Vercel** | Hosting, cron jobs, preview deploys | Only for deploy, not local dev |
| **Anthropic** | Every AI-generated feature (Victoria, reports, resume/job-fit analysis, content generators) | Yes — most core features call this |
| **Resend** | All outbound transactional email | Optional locally (emails will fail silently or error — check individual send-function error handling) |
| **PostHog** | Product analytics | Optional locally |
| **Google Analytics 4** | Public-page traffic tracking | Optional, public pages only |
| **Adzuna** | Job-market data for the Hireability Report's market-conditions context | Optional — market module degrades gracefully without it |
| **BLS (Bureau of Labor Statistics) API** | Same market-conditions context as Adzuna | Optional |
| **Google Gemini** | Headshot/banner image generation for org landing pages | Optional — only that one feature needs it |
| **Google Cloud OAuth (Client ID/Secret)** | Gmail-readonly ingestion for the admin Research Library feature (an internal company research inbox, not candidate-facing) | Optional — only Research Library ingestion needs it |
| **RapidAPI (JSearch)** | One leg of the job-source waterfall for job listings | Optional — waterfall falls back to other sources |
| **Stripe** | **Configured but not wired into any code yet** — see `IDEAS.md` Monetization section. Keys exist in `.env.local` for when this gets built. | No — unused today |
| **Twilio (SMS)** | **Not configured, not wired in** — SMS accountability nudges are built in schema/UI but deactivated pending this. See `IDEAS.md`. | No |
| **Attio (CRM)** | **Not integrated** — see `IDEAS.md` Trust & Integrations. | No |

## Environment variables

All in `.env.local` (never committed — check `.gitignore`). Every variable actually read by the app, grouped by purpose:

**Database (read by Prisma directly via `prisma/schema.prisma`, not `process.env.X` in application code)**
- `DATABASE_URL` — pooled connection string (used at runtime)
- `DIRECT_URL` — direct (non-pooled) connection string (used for migrations)

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used for admin operations (creating/deleting auth users, signed storage URLs)

**Anthropic**
- `ANTHROPIC_API_KEY` — read automatically by the SDK, not referenced explicitly in `src/`

**App / URLs**
- `NEXT_PUBLIC_APP_URL` — the canonical site URL, used for building absolute links in emails etc. Must match the real production domain in Vercel's env config — a past bug came from this being misconfigured (see `IDEAS.md` history / task list "Phase 0: Check Vercel/Supabase URL config for dashboard load bug").

**Email**
- `RESEND_API_KEY`

**Analytics**
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST` — your PostHog region ingest URL (`https://us.i.posthog.com` or `https://eu.i.posthog.com`); also used by `next.config.ts`'s rewrite proxy
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — GA4, public marketing pages only (see `EXCLUDED_PREFIXES` in `src/components/analytics/GoogleAnalytics.tsx` for which routes it never fires on — never fires on authenticated routes)

**Job market data**
- `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`
- `BLS_API_KEY`
- `RAPIDAPI_KEY` — JSearch, part of the job-source waterfall (ATS feeds → JSearch → Adzuna)

**Images**
- `GEMINI_API_KEY`

**Google OAuth (Research Library Gmail ingestion only — not candidate auth)**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Admin**
- `ADMIN_EMAILS` — comma-separated allowlist checked against the logged-in Supabase user's email to gate `/support/admin/*` pages
- `RESEARCH_LIBRARY_ALERT_EMAIL` — where Research Library pipeline alerts get sent

**Cron**
- `CRON_SECRET` — Vercel Cron sends this as a Bearer token; every `/api/cron/*` route checks it before running

**Waitlist**
- `NEXT_PUBLIC_WAITLIST_ENDPOINT` — empty/unset uses the built-in `/api/waitlist` route (stores to Postgres via `WaitlistSignup`); can be swapped to an external Formspree/Buttondown URL instead

**Stripe (configured, unused — see Monetization in `IDEAS.md`)**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Auto-set by tooling, don't touch**
- `VERCEL_OIDC_TOKEN` — created by the Vercel CLI when you run `vercel link`/`vercel env pull`

## Supabase Storage buckets

Four buckets, all accessed server-side via the service-role client (`admin.storage.from(...)`), never directly from the browser:

| Bucket | Used by |
|---|---|
| `resumes` | Candidate resume uploads — signed URLs generated on demand, never public |
| `work-samples` | Candidate work-sample uploads — public URLs (candidate explicitly chooses to share these) |
| `avatars` | Profile pictures across all 4 portals |
| `coach-logos` | Coach white-label branding upload (Coach Settings) |

## Local development

```bash
npm install
```

Requires `.env.local` populated per the table above (at minimum: `DATABASE_URL`, `DIRECT_URL`, the three Supabase vars, `ANTHROPIC_API_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`). `postinstall` runs `prisma generate` automatically.

```bash
npm run dev
```

Starts the dev server at `http://localhost:3000`. This project's convention (established through this whole build) is to run the dev server via the Browser-pane preview tooling in Claude Code rather than a bare terminal `npm run dev`, so console errors/network requests are inspectable — see `.claude/launch.json` if present.

**Verification commands**, run before any commit:
```bash
npx tsc --noEmit
npx eslint <changed files>
rm -rf .next && npm run build
```

## Database

Schema lives in `prisma/schema.prisma` (69 models — see `DATABASE_SCHEMA.md` for an organized walkthrough). This project has never used `prisma migrate` — schema changes are pushed directly:

```bash
npx prisma db push --skip-generate
npx prisma generate
```

Seeding/reset scripts live in `scripts/` — see `SCRIPTS.md` for what each one does (including how to create and delete sample/test users).

## Deploying

The repo is **not connected to a git remote** — there is no GitHub push-to-deploy wired up. Deploys go straight from the local working tree via the Vercel CLI:

```bash
npx vercel --prod --yes
```

This builds, deploys, and aliases the result to the production domain (`launchyournextchapter.com`) in one step. The project is already linked (`.vercel/project.json` — project `nextchapter`, org `launchyournextchapter`); if that file is ever missing, `npx vercel link` will re-link it (needs a Vercel account with access to the team).

Standard practice in this codebase: run the full verification pass (`tsc` / `eslint` / `build`) and get explicit user go-ahead before deploying — deploys are never done silently as part of a build task.

## Scheduled jobs (Vercel Cron)

Defined in `vercel.json`, all authenticated via `CRON_SECRET`. All times UTC:

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/daily-action-email` | 13:00 daily | Victoria's daily action email to candidates |
| `/api/cron/registration-reminders` | 14:00 daily | Nudges for incomplete signups |
| `/api/cron/interim-role-reverify` | 14:00 daily | Re-verification cadence for interim/fractional roles |
| `/api/cron/expire-job-postings` | 10:00 daily | Expires stale job board postings |
| `/api/cron/ats-job-board-feed` | 10:30 daily | Pulls the ATS feed (Greenhouse/Lever/Ashby) into the job board |
| `/api/cron/research-inbox-sweep` | 12:00 daily | Sweeps the Gmail research inbox into the Research Library pipeline |
| `/api/cron/auto-assign-sprint` | Mon 09:00 (~5am ET) | Auto-assigns every candidate's Weekly Search Sprint (fully automatic, no manual goal-setting step exists anymore) + sends the "weekly goal assigned" recap/preview email |
| `/api/cron/market-reality-snapshot` | Mon 20:20 | Archives that week's Market Reality grade snapshot (well after auto-assign-sprint, so every candidate's week is already set) |
| `/api/cron/weekly-gap-nudge` | Fri 21:00 | "Close the gap to an A" email |
| `/api/cron/community-coaching-digest` | Sat 15:00 | Community & Coaching weekly digest |
| `/api/cron/market-digest-candidates` | Tue 14:00 | Weekly market digest — candidates |
| `/api/cron/market-digest-coaches` | Tue 14:30 | Weekly market digest — coaches |
| `/api/cron/market-digest-recruiters` | Tue 15:00 | Weekly market digest — recruiters |
| `/api/cron/market-digest-employers` | Tue 15:30 | Weekly market digest — employers |

## Auth model

Supabase Auth, email/password + magic link (no social/OAuth login today). Session refresh runs through `src/lib/supabase/middleware.ts`. New signups go through email confirmation (`mailer_autoconfirm=false` on the Supabase project) — a fresh `signUp()` call does not produce an immediate session; the candidate has to click the confirmation link, which lands on the auth callback handler that finishes registration.

Four separate portal login surfaces, each with their own auth flow but the same underlying Supabase project: candidate (`/auth/login`), admin (`/support/admin/login`), coach (`/support/coach/login`), recruiter (`/talent/login` or `/recruiters` — verify current routing in `PRODUCT_VISION_ADMIN_ORGS.md`).

## Known operational gaps

(Full detail in `IDEAS.md`)
- No real employer/recruiter domain verification — named-contact trust gate only.
- No live Attio CRM sync.
- Stripe is configured but not wired into any payment flow — everything is free today.
- Twilio/SMS is built in schema but not activated (no Twilio account, opt-in UI deactivated).
