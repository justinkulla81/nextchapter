# Claimable pages: brand colors, launch kit, public counts

Decisions (owner, 2026-10-26/27): an organization's page and emails carry its own colors before it claims; the page keeps the line that it is independent and uses no logo until a verified claim. Claiming is free; what the organization adds on top comes later. Design prototype: https://claude.ai/artifact/F9pcnkp6D5tY2PxTtq8uZ6

## Brand colors
- `src/lib/branding/scan.ts` (pure) reads the two brand colors from a site's HTML and CSS: the theme-color tag and brand-named custom properties count most, backgrounds more than text, and near-white, near-black, grays, framework defaults (WordPress, Bootstrap) and social-network colors are dropped. The secondary is a clearly different hue or lightness, preferring a real accent to a pale tint or a very dark ink color. `fetch-site.ts` fetches the home page and up to five stylesheets through `safeFetch`.
- Sites that refuse bots or draw their colors with script: `scripts/branding/scan-orgs.ts --browser` renders the page and reads computed colors.
- Stored in `OrgBrand` (kind + sourceId, like `PublicOrgPage`; SQL `prisma/manual/2026-10-27-org-brand.sql`, applied to production 2026-10-27). Reads are fail-soft: no table or row means NextChapter's own look. `source` is SCAN or MANUAL; a hand-set pair is never overwritten by a rescan unless the script is told to.
- `theme.ts` turns a pair into `--org-1`, `--org-2`, `--org-1-ink`, `--org-2-ink`, `--org-1-text`, `--org-1-soft`, `--org-cta`, `--org-cta-ink`. Text colors are chosen for contrast (WCAG AA); the button on a primary band is the secondary only when it stands out 3:1.
- Used on: the workforce board page (candidate band and share image) and the launch kit and flyer.

## Launch kit (workforce boards)
- `scripts/branding/prepare-board-kits.ts --ids KY-247,... [--apply]` creates four tracked links per board (`ReferralLink` labels `ob:<boardId>:email|web|social|print`, the same machinery as the layoff-cohort kit) and prints the kit and flyer addresses. Dry run by default; nothing is sent to anyone.
- Kit page `/prepared/<claim slug>/kit` (unlisted, no personal data) and printable flyer `.../kit/flyer`. A board without links has no kit page (404).
- Clicks are counted per place; people who registered after a click are counted per place; the joined numbers show only once the total reaches 10.

## Public counts
- `src/lib/affiliations/public-count.ts`: members connected to a board, former employees of a company, alumni of a school. Real members only (not Confidential Search Mode, not system or sample accounts); a former employer means a job that has ended; "verified" means from the resume or confirmed. Under 10 (`PUBLIC_COUNT_FLOOR`, same as the cohort kit) nothing is shown.
- Shown on the board page and the board's claim page. Not on employer pages (owner rule: nothing there that reads as shaming).

## Events
`org_page_candidate_cta_clicked`, `org_kit_viewed`, `org_kit_copied`, `org_kit_flyer_printed`, `org_kit_link_clicked`, `org_claim_page_viewed` (now with `peopleShown`).

## Not built yet
Resume-first intake with no account, the onboarding email stream, a self-serve claim that creates the workspace from the brand and kit, the website widget, and the other organization types (colleges, employers, job centers) for the brand and kit.
