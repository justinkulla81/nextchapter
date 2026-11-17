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
- Portals (recruiter, employer, hiring, coach, higher education and workforce): the portal look (owner decision, 2026-11-17). The layout adds `theme-portal` and `portalStyle(type)` (`src/lib/partners/portal-types.ts`): white page, every `<h1>` in the serif display face in navy with the squiggle drawn under it in the portal's own color (a page's own `<Squiggle />` is hidden so there is one), small-capital `<h2>` labels become sentence-case serif headings, buttons are the orange action color, and the menu is a light rail whose active item takes the portal's tint (`nc-portal-rail`, `nc-portal-link`). The customer's brand is the logo, name and thin rule in the top bar; it no longer colors buttons or the page. Working tables stay dense. No paper note, signature or number box. Preview: `src/app/dev-preview/_mockups/portal-look.tsx`.
- Portal Homes (recruiter, employer, hiring, coach, workforce Talent Hub, higher education career services and alumni "Waiting for you"): the portal Home pattern (`src/components/partners/PortalHome.tsx`, 2026-11-17). One headline, one line and one primary action; then at most three sections: what needs you (`PortalNeeds`, the portal's tint, each item with its reason and one action), three numbers that each say where they come from (`PortalNumbers`), and one dense working table (`PortalTable`). Everything else sits closed under `PortalHomeMore`. The workforce Talent Hub Home keeps the organization's region picture visible under the primary action (owner decision, 2026-11-17). Acting on a Home item fires `portal_home_action_clicked` `{ portal, item }` (no link: some carry an access token).
- The coach client workspace (documents, full view, client brief, client list, invite a client, branding) has the squiggle too.
- The staff admin area (every page under the admin portal layout) carries `AdminBanner`: a navy "Internal · NextChapter staff only" bar with a "Not a member page" tag, like staff emails. It does not get the squiggle, the paper note or the other member-facing elements.
- Deliberately not covered: the admin sign-in, forgot-password and MFA pages (before sign-in), onboarding flows, legal pages, the manager reference flow, and transactional pages (unsubscribe, confirmations, application and sign-up forms, token links). Pages whose headline spans several lines in the source (why you're stuck, scam watch, vs, the jobs hub, the no-experience pages, a few reports and insights) now carry it too.

## Rules

- The paper note stays on Home. The redesign brief allows one note per page and none on working pages.
- Public pages keep one registration ask (the `NextStepBox`). The paper note and signature stay off them.
- The site's action color is `--action` (orange). Decoration near an action stays blue or pale.
- Not yet live: the handwritten aside on Home. It needs the week's numbers above the note, which are computed further down the page.

## Adding a page

- A new candidate page: use `PageHeader`; the squiggle comes with it.
- A new public page: use `SeoPage` or `TopicShell`; the squiggle comes with them. A page with its own headline markup adds `<Squiggle />` under its `<h1>` (centered pages: `className="mx-auto mt-2 block"`).
- Do not add a second registration ask or a paper note to a public page.
