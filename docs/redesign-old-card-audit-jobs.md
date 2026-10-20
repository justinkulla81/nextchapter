# Jobs place: old cards still showing inside the redesign

Audit of the 18 Jobs-place pages that already had a redesign branch but still rendered legacy cards inside the new
layout. For each page: what was old on the first view, what replaced it, and what moved behind "Show more".
Follows `docs/candidate-redesign.md` (page contract: one headline, one primary action, three sections at most on the
first view, every claim says why, rows carry a title, one verdict with its reason, one fact).

Nothing was deleted: every capability is still reachable, and the legacy (non-redesign) render of every shared
component is unchanged (new look sits behind a `redesign` prop or in a sibling component).

## New shared pieces

| Piece | What it is | Replaces |
|---|---|---|
| `src/components/candidate/Blocks.tsx` | `SectionBlock` (serif title, one-line why, no box), `VerdictPanel` (the one boxed headline), `Figures`, `PlainNote`, `EmptyNote`, `SourceLine`, `FactList` | `Card`/`CardHeader` with a small gray title, small-caps labels, dashed empty boxes, `text-sm` body copy |
| `Avatar neutral` (`candidate/ui.tsx`) | Gray tile for real companies and people | Green and blue tiles that read as a status |
| `ExpansionToggle quiet` | Outlined switch with a check when on | A row of filled orange buttons |
| `src/lib/redesign/jobs-pages.ts` | Pure text: `payPositionText`, `hiringSignalText`, `offerClaimStatusText`, `portfolioAssetRows`, `shortMoney` (tested in `src/test/jobs-pages.test.ts`) | Sentences assembled inline in JSX |
| `MarketRedesign`, `PayRedesign`, `ResumeRedesign`, `StrengthsRedesign` | Page bodies extracted from the page files so the dev-preview renders the same code | n/a |

## Page by page

| Page | What was old (first view) | What replaced it | Behind Show more |
|---|---|---|---|
| Companies `/dashboard/companies` | Green, blue and orange avatar tiles; two orange "Best fit"/"A-Z" buttons; legacy `FeedbackRequests` and `AiPayPremiumCard` cards | Neutral avatars; sort as pills (ink); feedback requests as rows with one action; AI pay note as plain section | Filters and sort (as before), feedback requests, AI pay note, local market line |
| Company profile `/dashboard/companies/[slug]` | Four `Card`s (hiring signal with trajectory icon and "Trajectory (growing)" jargon, contacts grouped under small-caps "CURRENT"/"FORMER", insiders with lock icon and orange "Plus only" label, 2nd-degree card); more than three sections | Three sections: people you know (rows: name, role, one fact, Open), "Is it hiring?" (one verdict and the fact it rests on, plus two lines at most), members who know this company (plain empty states, rows with the ask form) | People your contacts might know, how members have fared, hiring history and pay, culture, how to get hired, recruiters |
| Your market `/dashboard/market` | Legacy empty state; legacy expansion rows with filled buttons; legacy card list in Show more | `MarketRedesign`: one verdict panel with three figures, three ways to widen as rows with quiet switches, one "good to know" paragraph | Every place, role and industry (plain rows), extra flags |
| Know your worth `/dashboard/pay` | `PayPosition` and `OfferedWagesSection` as small gray text with an "ESTIMATE" tag; section titles in `text-xl` without why | Verdict panel with the headline and range; "estimate" said in words; filed wages as a sentence, the source line and at most three tracked companies; `PayRedesign` | Advertised-pay chart, package wishes |
| Local market `/dashboard/local-market` | `AreaBriefView` with `text-base font-semibold` titles, `text-xs` notes, dashed empty boxes, full member breakdown lists | Three sections (hiring, layoffs, other members), each with its reason and top five rows | Member breakdown, local news, workforce boards (one Show more for member detail and news) |
| Interviews `/dashboard/interview-prep` | `JobDescriptionCard` with "Start here" small gray title and a second orange button; gray tab bar; My Story card; "Ways to say it" nested cards | "Which job are you preparing for?" section (quiet buttons with the reason when disabled); pill tabs; story as a serif statement; "Ways to say it" as rows that open | Culture questions, weakness guidance, guide callout, review-prep link (as before). Tabs 2 to 5 (tough questions, practice, thank-you, comfort check) still use their legacy card bodies when opened |
| Reviews and raises prep `/dashboard/review-prep` | `text-lg` titles, `text-sm` bodies, bordered conversation cards | Three sections (results, settle three things with the form, strengthen) with `SectionBlock`; gaps as rows with one action | What others say, saved conversations, link to Reviews and raises |
| Alumni jobs `/dashboard/alumni-jobs` | Already conformant (rows with title, reason, fact, one action) | No change | n/a |
| Offers `/dashboard/got-hired` | Two `Card`s, green success boxes, emoji in claim status, orange lock label with icon | Sections for "how it came together" and the claim (plain status copy, no emoji), `LockedFeatureNotice redesign` says what to do | Where you are in your search, employer sharing (quiet buttons) |
| In-work `/dashboard/in-work` | Blue tab chips, boxed `Section`s in every tab, green notices, a link above the headline | Context-driven redesign: every tab gets serif sections, ink choice buttons, pill tabs; the Build-your-case link moves below | Review dates and reminders (once a review date exists) |
| Roles at your company `/dashboard/internal-roles` | Navy "I'm interested" button | Same page; button now uses the one action color (`nc-action`) | n/a |
| Résumé `/dashboard/resume` | Small-caps "YOUR RESUME VERSIONS", "Current" chip, amber issue text, green file button and Upload, box around the upload form, `ResumeFixCard` with uppercase labels and green "After" box | Versions as rows (title, one verdict with its reason, one fact), first three fixes as rows (what is wrong, fix, what it affects, before and after in neutral boxes), upload with a reason beside the disabled button | Remaining fixes, export, expert help |
| LinkedIn `/dashboard/linkedin` | `Card` with a small gray "LinkedIn Analysis" title; boxed headshot creator; generator CTA wording | "Your LinkedIn profile" and "Write a post" sections with their reasons; idea cards at reading size | Profile shape advice, headshot and banner creator (no box) |
| Portfolio `/dashboard/portfolio` | Small-caps "YOUR ASSETS" label and six `Card`s with a small gray title each | One section of six rows (title, where it stands, why when missing, one action) | Reports and dossiers as rows; Candidate+ progress as the page's one navy block |
| Why hire me `/dashboard/strengths` | Card with the headline and write-up in small text; grid of bordered cards each with a bullet list | Verdict panel (headline and the statement in display type), strengths as rows with one line of evidence and "More evidence" | Weak spots, sharpen steps |
| Track record, How I perform | Page wrappers are already redesigned; the legacy part is the form body | Not touched (another agent rebuilds both as short rounds) | n/a |
| Early career `/dashboard/early-career` | Ten-step checklist in green on the first view, boxed school form, `text-lg` titles | Next three steps (ink checks), school form only until a school is saved, pay range with its reason | Every step, roles, promotion path, first offer, grad school |

## Not done, and why

- Interview tabs 2 to 5, the advertised-pay chart (`AdzunaMarketSection`), company hiring history, culture, intel panels and
  the "how to get hired" accordion, and the in-work tab bodies beyond the shared section and button look still carry some
  legacy markup. All are behind a click, none on the first view. Follow-up work.
- `ConversationForm`, `HireOutcomeForm` and `ResumeUploadForm` keep their field styling (labels and hints at `text-sm`
  and `text-xs`). Only their wrappers, success states and buttons changed.

## How it was checked

Dev-preview fixtures render the real components: `/dev-preview/jobs/live/companies`, `market`, `pay`, `resume`,
`whyhire`, `local`, `interviews` (`src/app/dev-preview/_mockups/jobs-redesign-live.tsx`). Screenshots taken with
Playwright and chromium at 1280px wide.
