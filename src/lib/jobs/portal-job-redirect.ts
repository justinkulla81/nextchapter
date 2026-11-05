import { INDUSTRY_SLUGS } from '@/lib/segments/industry-options'
import { fitJobFromSearch } from '@/lib/jobs/fit-job-cookie'
// A signed-in member who lands on a public job page, the public job search or a job-title, entry-level, industry or job-type page (a result, Google, a shared link, an old email)
// is sent to the same thing inside the portal, with their search carried over. There the save, the apply and the
// follow-up are recorded on their profile and the list is ranked for them; on the public page they are not.
// Crawlers and signed-out visitors carry no session cookie, so the public pages (and their cache) are untouched.
const PUBLIC_JOB_PATH = /^\/jobs\/(c[a-z0-9]{20,32})\/?$/
const SEARCH_KEYS = ['q', 'loc', 'remote']
// What the public entry-level pages list: early-career and entry-level together (job-seniority.ts ENTRY_AND_EARLY_PARAM; a test keeps them equal, so the proxy imports nothing).
const ENTRY_AND_EARLY = 'EARLY_CAREER,ENTRY_LEVEL'
const ENTRY_HUB = /^\/jobs\/entry-level(?:\/category\/[a-z0-9-]{2,60})?\/?$/
const ENTRY_ROLE_PAGE = /^\/jobs\/entry-level\/([a-z0-9-]{3,80})(?:\/([a-z0-9-]{2,60}))?\/?$/
// Industry pages: every one redirects, to the board's industry filter (the same rules as the public page, segments/defs.ts), so a
// member sees the page's own jobs ranked for them. A slug that is no industry stays on the public page. src/test/industry-filter.test.ts
// keeps the list equal to the definitions.
const INDUSTRY_PAGE = /^\/jobs\/industry\/([a-z0-9-]{3,60})(?:\/[a-z0-9-]{1,40})?\/?$/
const TYPE_PAGE = /^\/jobs\/type\/([a-z-]{3,20})\/?$/
// Job-type pages: remote and hybrid are the work arrangement; the rest are the work types the portal board offers
// (work-type.ts: an interim job is a contract job there).
const TYPE_PARAMS: Record<string, [string, string]> = {
  remote: ['remote', 'remote'],
  hybrid: ['remote', 'hybrid'],
  contract: ['types', 'contract'],
  'part-time': ['types', 'part_time'],
  interim: ['types', 'contract'],
}
const TITLE_PAGE = /^\/jobs\/title\/([a-z0-9-]{3,80})(?:\/([a-z0-9-]{2,60}))?\/?$/

const words = (slug: string) => slug.split('-').filter(Boolean).join(' ')
const titleCase = (slug: string) => words(slug).replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** "texas" is the state; "chicago-il" is the city and its state code (job-title-places.ts parsePlace). */
function placeSearch(place: string): string {
  const city = /^([a-z0-9-]+)-([a-z]{2})$/.exec(place)
  return city ? `${titleCase(city[1])}, ${city[2].toUpperCase()}` : titleCase(place)
}

export function portalJobPath(pathname: string, hasSession: boolean, search = ''): string | null {
  if (!hasSession) return null
  // "Check my fit" on a public job page (the first onboarding step, with the job's id): a member already has an account and a
  // résumé, so they go to the job inside the portal, where the fit is shown, instead of starting onboarding again.
  if (pathname === '/onboarding/desire') {
    const job = fitJobFromSearch(search)
    return job ? `/dashboard/jobs/${job}?src=check_fit` : null
  }
  const m = PUBLIC_JOB_PATH.exec(pathname)
  if (m) return `/dashboard/jobs/${m[1]}?src=public_page`
  // Entry-level pages: the board's early-career and entry-level groups (2-5 and 0-2 years), with the role and place when the page has them.
  if (ENTRY_HUB.test(pathname)) return `/dashboard/find-my-job?${new URLSearchParams({ from: 'public', seniority: ENTRY_AND_EARLY }).toString()}`
  const er = ENTRY_ROLE_PAGE.exec(pathname)
  if (er) {
    const to = new URLSearchParams({ from: 'public', seniority: ENTRY_AND_EARLY, q: words(er[1]) })
    if (er[2]) to.set('loc', placeSearch(er[2]))
    return `/dashboard/find-my-job?${to.toString()}`
  }
  // Industry pages: the industry filter (above).
  const ind = INDUSTRY_PAGE.exec(pathname)
  if (ind && !INDUSTRY_SLUGS.has(ind[1])) return null
  if (ind) return `/dashboard/find-my-job?${new URLSearchParams({ from: 'public', industry: ind[1] }).toString()}`
  const ty = TYPE_PAGE.exec(pathname)
  if (ty && TYPE_PARAMS[ty[1]]) {
    const [key, value] = TYPE_PARAMS[ty[1]]
    return `/dashboard/find-my-job?${new URLSearchParams({ from: 'public', [key]: value }).toString()}`
  }
  const t = TITLE_PAGE.exec(pathname)
  if (t) {
    const to = new URLSearchParams({ from: 'public', q: words(t[1]) })
    if (t[2]) to.set('loc', placeSearch(t[2]))
    return `/dashboard/find-my-job?${to.toString()}`
  }
  if (pathname === '/jobs' || pathname === '/jobs/') {
    const from = new URLSearchParams(search)
    const to = new URLSearchParams()
    to.set('from', 'public')
    for (const k of SEARCH_KEYS) {
      const v = from.get(k)
      if (v) to.set(k, v.slice(0, 200))
    }
    const qs = to.toString()
    return `/dashboard/find-my-job${qs ? `?${qs}` : ''}`
  }
  return null
}
