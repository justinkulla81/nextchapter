// A signed-in member who lands on a public job page (a search result, a shared link, an old email) is sent to the same
// job inside the portal. There the save, the apply and the follow-up are recorded on their profile and feed their job
// search strategy; on the public page they are not. Crawlers and signed-out visitors carry no session cookie, so the
// public page (and its cache) is untouched for them.
const PUBLIC_JOB_PATH = /^\/jobs\/(c[a-z0-9]{20,32})\/?$/

export function portalJobPath(pathname: string, hasSession: boolean): string | null {
  if (!hasSession) return null
  const m = PUBLIC_JOB_PATH.exec(pathname)
  return m ? `/dashboard/jobs/${m[1]}?src=public_page` : null
}
