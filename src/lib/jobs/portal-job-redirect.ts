// A signed-in member who lands on a public job page, the public job search or a job-title page (a result, Google, a shared link, an old email)
// is sent to the same thing inside the portal, with their search carried over. There the save, the apply and the
// follow-up are recorded on their profile and the list is ranked for them; on the public page they are not.
// Crawlers and signed-out visitors carry no session cookie, so the public pages (and their cache) are untouched.
const PUBLIC_JOB_PATH = /^\/jobs\/(c[a-z0-9]{20,32})\/?$/
const SEARCH_KEYS = ['q', 'loc', 'remote']
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
  const m = PUBLIC_JOB_PATH.exec(pathname)
  if (m) return `/dashboard/jobs/${m[1]}?src=public_page`
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
