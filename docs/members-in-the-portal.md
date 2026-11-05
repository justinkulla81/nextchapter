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
| `/jobs/entry-level/**` | `seniority=ENTRY_LEVEL`, role as `q`, place as `loc` |
| `/jobs/industry/<segment>[/<cut>]` | industry name as `q` |
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

- Industry pages search by the industry's name; the board has no industry filter.
- An entry-level role page can return a shorter list than the public page.
