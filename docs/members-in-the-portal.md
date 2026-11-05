# Keeping members in the portal

A member's job search should happen inside the portal, where saves and applies are recorded and the list is ranked
for them. Public pages are for people we do not know yet.

## How a member is recognized on the main site

Members log in on `candidate.<site>`. Cookies are host-only (`src/lib/portal-hosts.ts`), so the main site never sees
the session cookie. Instead, the proxy sets `nc_member=1` on the whole site (`src/lib/auth/member-marker.ts`,
`markMember` in `src/proxy.ts`) the first time it sees a member session, on the candidate host or the main host.

- It is a flag, not a credential. One year, HttpOnly, Secure, SameSite=Lax.
- Only a member session sets it. Partner portal cookies (recruiter, coach, talent, employer, admin, org) do not.
- It is never set from something a visitor types (an email typed on a public page would let anyone learn which
  addresses are members).
- A member gets it the next time they use the portal. The privacy policy names it.

## Where a member is sent

`portalJobPath` (`src/lib/jobs/portal-job-redirect.ts`), called from the proxy on GET and HEAD with a member
session or the marker. Crawlers and signed-out visitors carry neither, so public pages and their cache are unchanged.

| Public page | Portal |
|---|---|
| `/jobs/<id>` | `/dashboard/jobs/<id>?src=public_page` |
| `/jobs?q&loc&remote` | `/dashboard/find-my-job?from=public&q&loc&remote` |
| `/jobs/title/<slug>[/<place>]` | the same search, title as `q`, place as `loc` |
| `/jobs/entry-level/**` | `seniority=EARLY_CAREER,ENTRY_LEVEL`, role as `q`, place as `loc` |
| `/jobs/industry/<segment>[/<cut>]` (any of the 35 industries) | `industry=<segment>`: the board's industry filter |
| `/jobs/type/remote`, `hybrid` | `remote=remote`, `remote=hybrid` |
| `/jobs/type/contract`, `interim`, `part-time` | `types=contract`, `types=contract`, `types=part_time` |

A member whose session has expired goes through `/auth/login`; the `/dashboard` page's query is kept in `next`
(`src/lib/supabase/middleware.ts`), so they return to the same search.

## Emails and the apply prompt

- Alert and saved-job emails link a member to `/dashboard/jobs/<id>` (`src/lib/leads/member-job-link.ts`).
- A logged-out member who reaches the apply prompt sees "Already a member? Sign in"
  (`src/components/jobs/ApplyAndSave.tsx`).

## Events

`search_carried_in` (`from=public` on Find a job), `job_carried_in` (`src=public_page` on the job page),
`apply_gate_sign_in_clicked`.

## Known limits

- The board's industry filter (`industry` URL parameter, the Industry dropdown in the Filters fold, `IndustryFilter`) uses the public industry page's own rules (`segmentMatcher` in `src/lib/segments/defs.ts`), so a member who comes from `/jobs/industry/retail` sees the same jobs, ranked for them. It narrows the pool before ranking (`industryKeep` in `src/lib/jobs/board-search-index.ts`). The rules read each job's industry code and posting type, which come from the board's in-memory search index; on a cold instance the page waits up to 8 seconds for it, and if it is not in the page shows every job and says the list is still loading. Partner-search jobs carry no industry data, so they are hidden while the filter is on. The dropdown's list is `src/lib/segments/industry-options.ts`; a test keeps it equal to `SEGMENTS`.
- Before this filter existed, the industry redirect searched the industry's name. Measured 2026-11-05, that found only 7% of the public retail page, 18% of restaurants and 33% of construction, because those pages are built from employer lists and patterns; only healthcare and financial services (picked by the industry label alone) were fully found, so only they redirected.
- The `seniority` parameter takes one group or a comma list (`parseSeniorityParam` in `src/lib/jobs/job-seniority.ts`). The entry-level pages ask for early-career (2-5 years) and entry-level (0-2 years) together, which is what the public pages list; the Seniority dropdown has an "Entry level and early career" option for it. Measured 2026-11-05, with both groups the portal search finds 72% to 98% of a public role page's jobs (it was 10% to 96% with entry-level alone).
- What is still missing is title wording: the search needs every word of the role name, so "marketing coordinator" misses "marketing assistant". The search is also looser than the public page, so it lists more.
