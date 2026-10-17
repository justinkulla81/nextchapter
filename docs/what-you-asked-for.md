# Everything you asked for, and where it really stands

Written 2026-10-17 from the full session history, then checked against the code and the
production database. Statuses are strict:

- **Done**: finished and you can see it.
- **Built, never checked**: the code is merged, but nobody (including me) has opened it in a
  browser or run it against real data. Treat as unproven.
- **Partly**: some of it exists, some of what you asked for does not.
- **Not done**.

I told you several of these were "done" when they were "built, never checked". That was wrong.
The list below replaces my earlier summaries.

## A. The candidate site

| # | What you asked for | Status | What is true |
|---|---|---|---|
| 1 | Three mockups for a clearer candidate dashboard, then a better round (Jobs / Ive / Chesky critique), a new dashboard, two more ideas, the full UX architecture for each, and three more redesigns with whole homepage, navigation and forms | Done | These are pictures (published pages). They are not the product. |
| 2 | Build "Design 1": one unlock ladder, consolidated navigation, remove unneeded functionality, make clear where daily messages are, one color scheme and design language, clear pop-ups and game elements, simpler forms, clear onboarding, staged multi-page forms, consistent fonts | Partly | The code was merged (PRs #31, #38, #43, #45) but the live site does not look like the design. Jobs still has 12 tabs. Daily messages, action plans and prompts appear on many pages. Headings are plain sans, not the design's serif. Forms and onboarding were never reviewed on screen. |
| 3 | Remove the stage stepper; "I don't get this: Where you are: Applying, Change" | Not done | The stepper is gone, but the "Your plan is set up for Applying. Not quite right? Change" line you asked about is still on Home: https://launchyournextchapter.com/dashboard |
| 4 | Pop-ups can be small check-ins ("still searching? how are you doing?") | Built, never checked | Check-in dialogs exist in the dashboard layout. |
| 5 | Dossier is not its own section; it is another unlock that builds evidence of the nine traits (motivation, thoroughness, conscientiousness, helpfulness, communication, references, peak strengths...) | Partly | The trait evidence exists. But Find a job still shows a card with a lock icon that says "Your Dossier is unlocked". Once earned, nothing about it should look locked. |
| 6 | Jobs should show a number; points obvious or removed; "Duolingo for professionals" | Partly | Jobs shows a "12 new" count. The "1 point = 1 minute" rule is in the code, but I have not found it explained on a screen. |
| 7 | Many schools; alumni of several; B2B programs (outplacement, higher education, workforce, recruiters) inside Jobs, Network and Learn | Partly | Groups and "From my groups" jobs exist. How well private communities show up inside Jobs, Network and Learn has not been checked. |
| 8 | Candidate+ comes from effort (minutes), recruiters and hiring managers see the mark, confidential mode hides it | Built, never checked | I could not find the 480-minute setting when I searched today. It needs checking, including that it is editable per candidate and overridable as you asked. |
| 9 | Consistent terminology (Personalize, not Prepare) | Partly | The menu says Personalize. No full sweep of every page was done. |
| 10 | Supporters (people who cheer you on) | Built, never checked | Page exists: https://launchyournextchapter.com/dashboard/supporters. The weekly supporter email is off. |
| 11 | Timeline | Built by another session, not live | "Your career story": a visual timeline of school, work, ventures, pauses and learning, with "doors you could open", a pause what-if and "people like you". It lives at https://launchyournextchapter.com/dashboard/my-career (tab "Career timeline" under Personalize) on the branch `claude/compassionate-edison-fkfdu5`, **not merged**, and needs `prisma/manual/2026-10-17-career-events.sql` applied first. It is a career history. A search-activity timeline (applications, contacts, coaching sessions, stage changes in order) still does not exist. |
| 12 | "Career explorer" | Partly live, partly in progress | The live part is "Explore other roles" (Pivot paths): https://launchyournextchapter.com/dashboard/pivot-paths. Its occupation data and 5,814 funded training programs are loaded; courses are not matched to skills (0 rows), so its course suggestions are empty. The same other branch (`claude/compassionate-edison-fkfdu5`) adds "What would it take" (a pathway map with cost, time and alternatives) and "Thinking about a pivot". Those are not live. |
| 27 | No badges. Everything the member does builds the dossier and moves them toward Candidate+ and a job | Not done | The whole badge system is still live: weekly badges ("Weekly Sprint Target", "Weekly Networking" and others) and milestone badges, the "You just earned new badges" email, the badge shelf on the Progress page, the top strip, learning badges, and an admin page for weekly recognition. Code is in `src/lib/badges/` and `src/components/dashboard/BadgeShelf.tsx`. To do: replace the email with a weekly progress note, replace the shelf with what the member has built toward the dossier, and remove badge language everywhere. |

## B. The partner portals (higher education, outplacement, coach, hiring, recruiter; workforce is another session's)

| # | What you asked for | Status | What is true |
|---|---|---|---|
| 13 | A look for the partner portals like the candidate site, more enterprise, with the partner's logo and colors | Built, never checked | Shared shell with logo, name and color in coach, recruiter, hiring, outplacement and the higher education portal. Never opened in a browser. Primary, secondary and background colors with a free picker are built and also unchecked. |
| 14 | Which features each portal needs, align them, list gaps, ideas to make them ready to sell | Partly | You got the written analysis. Built since: CSV downloads, a "Downloads and activity" log, team logging and a printable quarterly review (outplacement). Not built: acting on the connections between portals, API and webhooks. |
| 15 | Set up an organization for one or many portals, with CRM | Built, never checked | https://admin.launchyournextchapter.com/support/admin/organizations/new creates it. **Production has zero organizations: nobody has ever run this.** |
| 16 | A demo site per customer, with prepopulated data | Built, never checked | Needs the same first run. No demo exists. |
| 17 | Portals connected to each other where it makes sense, turned on | Not done | The four connection switches are saved but no portal reads them. Three of them share candidate data and need your consent design first. |
| 18 | Workforce board: do not overwrite the other session, look for gaps | Not done | I have not read it. Most of it is in the code from the other session. |
| 19 | "Where can I invite and connect to my partner?" | See below | |
| 20 | Each customer gets its own address; separate demo link; demos public but marked | Partly | Front door at `/p/<slug>` is built and merged. Subdomains (`cmu.launchyournextchapter.com`) are switched off until DNS is set. Customer portals under their own host, and custom domains, are not built. Never opened in a browser. |
| 21 | "Higher education" instead of "Higher ed" | Partly | Changed in the organization screens, admin menu and CRM colleges page. Other pages still say "Higher ed". |
| 22 | Always give full URLs | Done | In `CLAUDE.md`. |

### Where you invite and connect a partner

1. Open https://admin.launchyournextchapter.com/support/admin/organizations/new
2. Step 1: the organization's name. Step 2: choose which portals it gets (one or several). Step 3: logo and colors. Step 4: live customer or demo.
3. For a **live** customer, what happens next depends on the portal. **None of these emails the invite for you; the screen gives you the link and you send it.**
   - Higher education: creates the college portal. You then invite staff from its Staff tab.
   - Outplacement: creates the account. You add a contract at https://admin.launchyournextchapter.com/support/admin/outplacement-contracts, then invite the first admin.
   - Hiring: creates a pending workspace and a sign-up link for the hiring lead. It goes live when they sign up with the invited email.
   - Recruiter firm: creates the firm and gives you a start link, `https://launchyournextchapter.com/recruiters/start/<token>`, for the firm's first admin.
   - Coach: creates the coach record. They claim it by signing up at the coach login with the email you entered.
4. From a CRM record, https://admin.launchyournextchapter.com/support/admin/crm/organizations shows a "Customer portals" section to start the same flow.
5. Each customer's front door is `https://launchyournextchapter.com/p/<their-slug>`.

None of this has been run. The first real test is to create one demo organization and click through it.

## C. This week

| # | What you asked for | Status | What is true |
|---|---|---|---|
| 23 | Find a job: as professional as LinkedIn, Indeed and Ladders; use our extra data; show where personalizing improves results and how to widen the search; contacts first on likely openings; one-line O*NET credit; stop the one-long-page problem | Partly | Another session already shipped, on the live page: one fit verdict with one reason and one quiet facts line per job, "Likely fewer applicants" as an estimate with its reasons, and "What we know about you: your search is N% tuned" with a next step (that is where personalizing improves results). Still open: the overall layout and polish, contacts first on likely openings, the O*NET credit, and the long page. My own job-row preview is dropped because it duplicated that work. |
| 24 | Navigation: clearly navigation, fewer than 12 tabs | In progress | New menu grouping is written in code but not finished or checked. The live site is unchanged. |
| 25 | A full redo of the whole candidate site, then all other portals | Started | The rules are in `docs/candidate-redesign.md`. Nothing else is rebuilt yet. |
| 26 | A map of where everything is | Done | `docs/candidate-feature-map.md` |

## D. What other sessions are building (checked 2026-10-17)

You have several sessions working at once. This is what each one's branch contains, so nothing is
built twice.

| Branch | What it is | Live? |
|---|---|---|
| `claude/friendly-cerf-p3639f` | Job board: fit verdicts, "why this job", "What we know about you" precision meter, retuning your search, one-tap logging, Candidate+ changes | Merged into `main` |
| `claude/compassionate-edison-fkfdu5` | Personalization alignment, journeys, "What would it take" pathway map, "Thinking about a pivot", **Your career story (timeline)**, career growth seats | **Not merged**. The timeline needs a database change first |
| `claude/exciting-johnson-lcf7h8` | Jobs report: crawlers and employer sources by city (Louisville, Pittsburgh) | Not merged |
| `claude/gallant-babbage-e85kp1` | Speed: timing the dashboard's data reads, Company spelling index | Not merged |
| `claude/candidate-dashboard-redesign-djr3g2` (this session) | Partner portals, customer front door, the redesign rules and documents, menu grouping (not yet wired) | Partner portals and front door merged; the rest is documentation |
