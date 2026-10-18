# Audit: session "Career Team and Fit Future comparison"

Read-only audit, 2026-10-18. Source: the owner's Claude session `session_01R4791XXj3kfBgn1mjKpq6m` (created 2026-10-14, last active 2026-10-16, branch `claude/upbeat-mccarthy-qbycdp`). I read every message the owner typed (from the first one to the last), the assistant's analysis messages from 2026-10-14, and the last assistant messages. I did not read every tool call in the middle of the build (about 400 events of code writing); those are summarised from the commits and docs on `main`.

## 1. What "Career Team" and "Fit Future" are

The owner's first message (2026-10-14): "what does career team and fit future do that we dont https://careerteam.com/software"

- **Career Team = CareerTEAM, product "Career Edge".** A vendor that sells to state and local workforce agencies. Case management across WIOA, Wagner-Peyser, TAA, SNAP E&T, RESEA, apprenticeships and youth; an embedded federal reporting engine ("PIRL MAGIC"); an AI labor exchange; an employer portal and applicant tracking system; AI resume and cover-letter builder, AI job matching and career pathing, AI training-program matching, AI career coach, AI case-note summaries. The owner pasted the vendor page text in full (2026-10-14 12:49), because the assistant's sandbox could not reach the site.
- **Fit Future = FutureFit AI.** The assistant "assumed you mean FutureFit AI" and the owner never corrected it; later they asked "expalin how futurefit competes with me?", "how big are they. who much money" and "they have reaised and make?". It is a skills-based career navigation product sold to governments, nonprofits and partners (a free RBC-branded version). It claims about 30,000 skills and 80,000 job titles mapped to real-time labor-market data, plus a "career passport" of credentials.
- Both are **competitors / market players, not internal features.** Inside the repo "Career team" and "Fit future" are not feature names. An earlier audit (`docs/session-audit/career-pivot-team-fit.md`) could not find "Fit future" because it is FutureFit AI, an outside company. This transcript settles that.
- The comparison grew over three owner messages into a vendor scan. Added by the owner: myOneFlow, GoSprout, WIOA Solutions (nothing found), then "geogrpahic solutions and other similar competitors", then "careerarc humanly jack and jill apply.io, enhancv" (the assistant found the real name is AIApply, "its aiapply not apply.io").

**What the comparison was for:** to decide what the owner's product lacks against these companies, what to build, and where to compete or partner. Owner's words: "can we complement these programs - be honest. if yes, say how, if no, say why. also figure out what we should buidl" and, later, "how we can partner? (or know that we are squarly competing)".

## 2. What the session concluded and produced

### Comparison conclusions (assistant, 2026-10-14; owner accepted by saying "ok build this")
- CareerTeam, myOneFlow and Geographic Solutions sell to agencies. Their edge is compliance and case management, a different product category. **Do not build** case management, federal (PIRL) reporting, or apprenticeship tracking; no paid real-time labor data (Lightcast) and no "career passport" for now.
- **Complement, in one place:** be the professional and executive layer that a workforce board refers laid-off professionals to; send consented outcome counts back by CSV or webhook. Risks listed: CareerTeam has its own coach and resume builder, integration/APIs unverified, WIOA data brings compliance duties, slow agency sales.
- **FutureFit competes** (same buyers, career navigation), so no partnership. GoSprout is irrelevant to the user. WIOA Solutions could not be verified.
- Verified gaps in the codebase at that time: skills were free-text strings from Claude (no taxonomy), courses were an admin-curated link table, no employer pipeline stages, no interview scheduling, no document model, no case-note AI, no free-form resume editor, no payments, no pivot tool (only in `IDEAS.md`).
- Rough size facts (aggregator estimates, conflicting): FutureFit raised C$5.7M in 2022 and is small; CareerTeam was recapitalised by Iron Creek in 2021 to 2022 and lists about 377 staff; GoSprout about $1.2M seed.

### Build list the owner approved ("ok build this: Build ...")
1. Skills taxonomy and career pathing (O*NET + BLS) and the Pivot Tool.
2. Training matching (courses tagged to skill IDs; state funded-provider lists where they exist).
3. Free-form resume editor (Resume Studio).
4. Requested-document upload (one document model).
5. Coach appointment booking (reusing Google Calendar code).
6. Case-note summaries for coaches (metered Claude cost, 30 a day per coach cap).
7. White-label branding for institution, employer and workforce-board portals (cheap).
Tier 3, only if a buyer asks: employer pipeline stages and interview scheduling, job fairs and one events model.

Then the owner added: "yes, scope the BLS state and metro data. build this too: [the white-collar O*NET filter: SOC groups 11, 13, 15, 23 and professional parts of 17, 27, 41; Job Zones 4 and 5; skills, technology skills, activities, alternate titles, related occupations, OEWS wages, projections]" and "yes, we want this: the Pivot Tool is locally accurate."

### What was produced (all merged to `main`)
- Taxonomy tables, importers (`careers:import-onet`, `careers:import-bls`), pivot ranking, title-to-occupation matching: `src/lib/careers/`. Pivot Tool at https://launchyournextchapter.com/dashboard/pivot-paths (https://launchyournextchapter.com/dashboard/pivot redirects there).
- Resume Studio, requested documents (https://launchyournextchapter.com/dashboard/documents, private `requested-documents` bucket), coach booking (https://launchyournextchapter.com/dashboard/book-session), coach note summaries.
- Docs on main: `docs/WORKFORCE_VENDOR_LANDSCAPE.md` (the vendor comparison and compete/partner table, extended 2026-10-15 with CareerArc/INTOO, Humanly, Jack & Jill, AIApply, Enhancv), `docs/SMOKE_TEST_2026-10-15.md`, `docs/PRIVACY_COPY_DRAFT_2026-10-15.md`, `docs/CAREER_TAXONOMY.md`.
- GitHub Actions workflow "Import career taxonomy" (`.github/workflows/import-career-taxonomy.yml`), a one-click O*NET and BLS load (found on main by the assistant in the last turn; not run, not tested).
- PRs named in the transcript: #27, #34, #42 (all merged; main was at `9aed0a8` on 2026-10-16). #42 is "Clear button for saved occupation and target role, plus occupation-matching privacy wording".
- No mockups, no artifact links, no tables saved as files for the comparison itself; the tables lived in chat and then in the landscape doc.

## 3. Owner decisions and open questions

### Decisions (owner's words where available)
- Build the seven items above; "do 1. do 2. do 3." (2026-10-15 19:14); "yes merge the pivot pages"; "merge it" (several times); "apply the tables when I merge"; "add the clear button"; "write the occupation matching privacy wording".
- Simplify: "what do you think, can we siplify and keep fucntinaonlity and data and make it even easier and more valuable: Pivot tools: do you want to keep both 'Pivot paths' and 'Explore other roles'?" (the answer is not in what I read; the pivot page is now one page and `/dashboard/pivot` redirects to it).
- Assisted apply, not mass auto-apply, is the recommended lesson from AIApply (assistant recommendation; the owner has not decided).
- Last owner instruction (2026-10-16 02:01): "Deploy the merged code. The tables and the requested-documents bucket already exist in Supabase. Confirm your deploy picks up #27, #34 and #42."

### Open questions left (from the assistant's last two messages)
- Production deploy not verified. The assistant has no Vercel access; the owner must open https://vercel.com/launchyournextchapter/nextchapter and confirm the latest production deploy is `9aed0a8` or later and Ready. Status of the session: "need_input". I could not check whether this was done afterwards.
- O*NET and BLS data load: not confirmed done. Until it is, Pivot paths shows only the market-ranked list. The Actions workflow needs `DATABASE_URL` and `DIRECT_URL` repo secrets (not confirmed to exist).
- Smoke test (pivot, resume studio, documents, booking, note summaries, clear button) not confirmed run.
- Counsel review of the privacy copy draft not confirmed; the Skills page already sends resume keywords, target role and strengths to the AI provider, and coach-note summaries go to it too.
- 30-a-day coach-note cap: owner never confirmed it.
- Google Calendar and email connection for invites and Meet links.
- "What next?" The assistant offered: payments (none exist), Resume Studio gaps vs Enhancv (LinkedIn import, more templates, view tracking), assisted apply, outcome reporting for workforce boards (needs privacy review), state-level projections. The owner did not pick one in this session.
- Partner outreach (Geographic Solutions, a workforce board) is the owner's call. Not in the transcript: any reply from any vendor.
- Not in the transcript: pricing, any decision to target workforce boards as a segment, any API confirmation from CareerTeam or myOneFlow.

## 4. What this means for the candidate-site redesign

The redesign decisions: six places (Home, Jobs, Network, Learn, Finances and benefits as money opt-in, Account and privacy, Help), personalization as the first strip on Home, Jobs, Network and Learn, one note on Home, always positive, no badges, 11 journeys, every claim says why. (Note: `docs/candidate-redesign.md` still lists "Personalize" as a place and says "Settings: Account and privacy"; the list in the task brief is newer and I treated it as current.)

### Fits
- **Pivot paths / "What would it take" / pivot radar** sit in Learn ("Other roles you could do"). They answer the Career-change journey and feed the personalization strip on Jobs ("Better jobs for you") and Learn ("Closer to hired").
- **Local pay and demand from BLS** make "every claim says why" real: a pivot suggestion can say "because 7 of your top 10 skills overlap, and local pay is X". Keep the O*NET and BLS credit as one line linking to the full notice (page contract rule 6).
- **Requested documents and Resume Studio** are working pages; they fit under Jobs or Account and privacy without a note or action plan.
- **The "complement, not compete" stance** fits the redesign goal (professional, not generic): the product is for professionals and executives, so the redesign should not copy agency-style forms or dashboards.
- **Occupation-matching privacy wording and the clear button** fit "Account and privacy": the member can see and remove what is saved.

### Conflicts
- **Pivot paths is a long stack on one page** (radar, ideas, ranked paths, what-would-it-take, history). Against the page contract (one headline, one primary action, at most three sections) it must be split by purpose, with the rest behind tabs. The existing audit `career-pivot-team-fit.md` makes the same point.
- **Stance and feeling badges** ("Excited", "Nervous", "Scared", "Not for me right now") on pivot targets: "always positive, no badges" needs these reworded or removed. Negative feelings as visible tags conflict with always positive.
- **Gap lists** ("skills you lack") read as negative. Reword as what the member already has and what is one step away, each with a reason.
- **Coach-note summaries, booking and documents** add three features a candidate can reach; each new card must say what it removes (redesign rule).
- **Prebuilt "next question" flows**: any new question set from this work (occupation choice when a title is ambiguous) must follow "two or three questions at a time, why we ask first".
- **"Assisted apply" and "mass apply"**: AIApply-style auto-apply is the opposite of the redesign's calm, progress-toward-a-job feel; keep it to review-and-submit.

### Old or stale
- Competitor facts are from 2026-10-14 web snippets (funding, headcount, state counts conflict between sources). Treat as rough.
- `docs/OPEN_ITEMS.md` was dated 2026-08-14 when the assistant used it; the "not built" list for payments etc. should be rechecked.
- `docs/SETUP.md` still says deploys are manual (`npx vercel --prod`); `vercel.json` builds only `main`, so that is out of date (assistant finding).
- The Employer / workforce-board white-label idea predates the redesign; the partner portals follow the candidate site last, per the brief.

### New ideas not yet in the redesign docs
- Put one short "why" line on each pivot suggestion from the overlap numbers (feeds "every claim says why").
- Use the Jack & Jill lesson: onboarding already collects the facts, so act on them (introductions, matched jobs) rather than asking more.
- A source-tagged referral link for workforce boards, with consented outcome counts coming back (fits the workforce portal, not the candidate site).
- Resume Studio import from LinkedIn or an uploaded resume into sections (Enhancv gap).
- Show the member the occupation we matched and let them correct it with one choice (already built as the "needs choice" list and the clear button).

## 5. What must be built or merged, and where the work lives

- **Nothing is waiting to merge from this session.** The session branch `origin/claude/upbeat-mccarthy-qbycdp` has one commit not on main by hash (`bda140bc`), but its content is on main as the squash commit `a21e7a8c` (#42). Safe to ignore the branch.
- `origin/main` was at `4ae28002` when I checked (2026-10-18); PRs #27, #34, #42 are inside it.
- The pivot and career story work is also merged into this redesign branch (`claude/candidate-dashboard-redesign-djr3g2`); see the earlier audit `docs/session-audit/career-pivot-team-fit.md`.
- **Still to do by the owner, not code:** confirm the Vercel production deploy; load the O*NET and BLS data (dry run first), or run the Actions workflow after adding the two secrets; run the smoke test; counsel review of the privacy copy; confirm the coach-note cap; connect Google for booking invites; pick the next build.
- **Still to build (only if the owner chooses):** payments; Resume Studio gaps (LinkedIn import, templates, view tracking); assisted apply; workforce-board outcome reporting and portal; state-level projections; employer pipeline stages and scheduling; events and job fairs. None of these started.
- **For the redesign:** split the pivot page by purpose in `src/app/dev-preview/` first, then wire the real data; reword stance and feeling labels; add the "why" line.

## Confidence
High on sections 1 to 3 (read from owner messages). Medium on section 2's list of what shipped (taken from the assistant's last summaries, commit messages and the repo, not from re-running the app). Section 4 is my judgment against `docs/candidate-redesign.md`; I did not open any page in a browser.
