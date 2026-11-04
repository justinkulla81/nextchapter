// A signed-in member who lands on a public job page or the public job search (a result, a shared link, an old email)
// is sent to the same thing inside the portal, with their search carried over. There the save, the apply and the
// follow-up are recorded on their profile and the list is ranked for them; on the public page they are not.
// Crawlers and signed-out visitors carry no session cookie, so the public pages (and their cache) are untouched.
const PUBLIC_JOB_PATH = /^\/jobs\/(c[a-z0-9]{20,32})\/?$/
const SEARCH_KEYS = ['q', 'loc', 'remote']

export function portalJobPath(pathname: string, hasSession: boolean, search = ''): string | null {
  if (!hasSession) return null
  const m = PUBLIC_JOB_PATH.exec(pathname)
  if (m) return `/dashboard/jobs/${m[1]}?src=public_page`
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
