# Open questions and decisions, as of 2026-10-18

Everything from the redesign work and the audit of the other sessions, in the order it unblocks work. Each has my recommendation. Reply with the number and yes, or what you want instead.

## Decided (owner, 2026-10-18)

- Seven places (explained to the owner), hide what does not apply. Items 8 to 14 below: agreed with my recommendations.
- No letter grades or verdict labels on the member side.
- The personal assistant is a layer behind the one note: no tab, no separate app, no name for now.
- **No more exclusive jobs.** Every job is shown to every member. The dossier is attached to an application only if the candidate chooses. Candidate+ is signaled to the poster when it is true (and never in confidential mode).
- Onboarding: question bundles first. **Money is not asked in onboarding.** The choice lives on first opening Finances and benefits, and in Account and privacy, Money help.
- Turn the redesign on for the owner's account (the owner sets `CANDIDATE_REDESIGN_EMAILS` in Vercel).
- **One market report only** (decided 2026-10-18, replacing the earlier default). It is always the accurate picture of the member's hireability as of now, and it regenerates after the member has made improvements or done work. No separate lead-gen version, no history of old grades. Short summary and the first twelve weeks first; the rest behind "show more".
- Exclusive jobs: confirmed. No more exclusive jobs.

## Built (2026-10-19, behind the redesign flag)

- **One market report** (item 6): `/dashboard/market-reality` only, with "Regenerate after your improvements". See `docs/MARKET_REALITY_REPORT.md`.
- **Pivot tool** (item 11): `/dashboard/pivot-paths` is three parts (Where you are now, Where you could go, Your plan), feelings and stances reworded positively, a reason on every suggestion. The target is one field: `targetFunction`; `isPivoting` is written with it and read through `src/lib/journey/pivot-target.ts`. Optional data fix: `prisma/manual/2026-10-19-pivot-flag-sync.sql` (not applied).

## Decide now (these block the next build step) — original list, for reference

1. **Seven places, or your five pillars?** The redesign has Home, Jobs, Network, Learn, Finances and benefits (only if the member chose money help), Account and privacy, and Help. You once framed the menu as five things (personalize, learn, search and apply, network, work). Also: gray out irrelevant parts, or hide them? *Recommended: seven places; hide.*
2. **Letter grades.** Members see A to F, red for D and F, and "F" means weaknesses that "end most conversations". The new report also labels people "Likely to pause". *Recommended: no letter and no verdict label; "what would move you up" first.*
3. **The personal assistant.** *Recommended: a layer with no tab, no name and no separate app. It picks the one note on Home and writes the receipts.* Open: your name for it, whether it is free to every candidate, and the paid recruiter channel (all are readings by the assistant, not your decisions).
4. **Exclusive jobs.** You said show them to everyone with the dossier attached. The redesign gates them behind Candidate+. *Recommended: show to everyone, dossier attached.*
5. **Onboarding.** The Google sign-up and scan reveal skips the Confirm and Location steps, so a new member reaches Home without role, level, city or remote preference. *Recommended: question bundles O1 to O6 first, with the Google scan as a reveal after the money question. The "Your goal" and "Your plan" cards you asked for are already the journey card and "Build your plan" on Home, so the A, B or C choice is answered.*
6. **The market report.** One page for the lead-gen version and the member version? It has 11 numbered sections against a three-section rule. The career story was meant to appear in it too, but one home per fact says Learn. *Recommended: one page, collapsed to the summary, the first twelve weeks and the objections; the rest behind "show more".* Also: what did "Skills gaps (no AI)" mean?
7. **Turn the redesign on for your account?** Set `CANDIDATE_REDESIGN_EMAILS` to your email in Vercel, check Home, the menu, Improve your search and Money help on your real data, then decide on everyone. *Recommended: yes, today.*

## Decide soon

8. **College bar.** A full-width bar in the college's accent color on every page. *Recommended: neutral navy with the college's name and logo.* College funding, digital resources and donation cards: only for members who chose money help.
9. **Money.** Confirm "no" also drops the minimum pay, flexible pay and equity questions. First version US only, and which journeys first (laid off, building something of my own, thinking about a move)?
10. **Questions.** I decided: connect Track Record and What I Need to the dossier; drop the benefits priorities. The consulting question (four rows, "Not yet") becomes one bundle with a why-we-ask line and a receipt, with positive wording ("Next on my list"). Say if you disagree.
11. **Pivot tool.** Split the pivot page into three (other roles, what it would take, your list); reword the feeling tags ("Nervous", "Scared") positively; add a why to each suggestion; one source for the target field. Merge "Pivot paths" and "Explore other roles"?
12. **Gmail connect.** You said "a gating item", then "soft gates". The redesign forces nothing. *Recommended: soft gate with the reveal that shows what it unlocks; nothing locked.*
13. **Stale branches to delete:** `higher-ed-portal`, `ai-skills-taxonomy`, the four `employment-report-*` branches.
14. **Partner experience** (from earlier): name "Your people", default level for a partner, milestones, runway, the weekly email.

## Things only you can do (not decisions)

- Apply `prisma/manual/2026-10-18-money-help.sql` (one column) before Money help works. The career events SQL is **already applied** (the career story session did it on 2026-10-17; I told you earlier it was still needed, which was wrong).
- Vercel: `CANDIDATE_REDESIGN_EMAILS`; `NEWSLETTER_SENDER_QUERY=from:strictlyvc.com`; confirm `CRON_SECRET` and Resend (the new daily jobs need them); `SUPABASE_SERVICE_ROLE_KEY`.
- Google: add the redirect URI `https://launchyournextchapter.com/api/auth/join/callback`; the Gmail read scope needs Google's verification (weeks).
- Load the O*NET and BLS data (wages show 0 rows: run the "Import career taxonomy" action, dry run first); smoke test; counsel review of privacy copy; confirm the coach-note cap; expert review of the pivot feasibility and cost ranges before sales use.
- Check the consulting question really saved: no event or answer has been seen in PostHog or the database, and that Supabase project may not be production.
- Identify the session called "nextchapter".

## Still to build, in order

1. The money question in onboarding. 2. Find a job, Network and Learn in the new look, on real data. 3. Remove old code and the old pages once the flag is on for everyone. 4. The report page in the redesign. 5. The assistant's one-note ranker.
