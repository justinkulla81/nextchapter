# Design elements from the email look

The email look (`docs/email-look.md`) is carried onto the site in small, shared pieces. Each one is off by default and switched on where it fits.

## Pieces (`src/components/ui/`, tokens in `globals.css`)

- `Squiggle`: hand-drawn line under a headline. Brand blue, never the action color.
- `Highlight`: pale marker (`bg-marker`) behind the one number that matters. Counts only.
- `ShortVersion`: the pale box that opens a page with its facts, so every claim says why.
- `PaperNote`, `Signature`: warm paper card signed by Victoria, Vicki or Vic (images in `public/email/`, not a font, so the site keeps two typefaces).
- `BookmarkMark`: the NextChapter bookmark.
- `FocusNumber` (`src/components/candidate/`): the week's minutes as one number with its reason.

## Where they are on

- Public layoff pages (this week, state, 2026 and months, weeks, by-state, stories): squiggle, and the opening sentence in `ShortVersion`.
- Candidate Home: `HomeNote variant="paper"` (signed by Victoria, no Cue pill) and the squiggle.
- Every candidate page built on `PageHeader`: the squiggle.
- Effort and results: `FocusNumber` in place of the "This week" sentence.
- Every public page built on `SeoPage` or `TopicShell`: the squiggle. `SeoPage` skips it when the heading panel takes an organization's colors (`brand`); `squiggle={false}` turns it off.
- How it works and Pricing (own headline markup): squiggle, and the opening sentence in `ShortVersion`.
- Other public content pages and candidate pages with their own headline markup (news, data, reports, insights, resources, systems, niches, press, unemployment benefits, start, careers, jobs, and the candidate pages that do not use `PageHeader`): squiggle only.
- Deliberately not covered: partner portals (recruiters, talent, employer), onboarding flows, legal pages, and transactional pages (unsubscribe, confirmations, application and sign-up forms, token links). Pages whose headline spans several lines in the source are not covered yet (why you're stuck, scam watch, vs, the jobs hub, no-experience pages, a few reports and insights).

## Rules

- The paper note stays on Home. The redesign brief allows one note per page and none on working pages.
- Public pages keep one registration ask (the `NextStepBox`). The paper note and signature stay off them.
- The site's action color is `--action` (orange). Decoration near an action stays blue or pale.
- Not yet live: the handwritten aside on Home. It needs the week's numbers above the note, which are computed further down the page.
