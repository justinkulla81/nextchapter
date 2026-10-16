import 'server-only'
import { prisma } from '@/lib/prisma'
import { CHECK_USER_AGENT, hostMatches, matchProfilePage, platformFor, robotsAllows } from './external-reviews'

const TIMEOUT_MS = 8000
const MAX_BYTES = 2_000_000

async function politeGet(url: string): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, {
      redirect: 'manual', // a redirect is usually a login wall; we don't follow it
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': `${CHECK_USER_AGENT}/1.0 (+https://launchyournextchapter.com)`, Accept: 'text/html,text/plain' },
      cache: 'no-store',
    })
    const text = res.status === 200 ? (await res.text()).slice(0, MAX_BYTES) : ''
    return { status: res.status, body: text }
  } catch {
    return null
  }
}

/**
 * One polite check of an imported-review profile link: robots.txt first, then
 * a single GET of the public page, no retries, no login, no workarounds for
 * bot protection. Anything we can't confirm goes on the admin review list.
 * Only links on the platform's own hosts are ever fetched ("Other" never is).
 */
export async function checkExternalReview(id: string): Promise<void> {
  const row = await prisma.externalReviewStat.findUnique({
    where: { id },
    select: { profileUrl: true, platform: true, rating: true, reviewCount: true, status: true, candidate: { select: { firstName: true, lastName: true } } },
  })
  if (!row || row.status !== 'SELF_REPORTED') return

  const done = (status: 'LINK_CHECKED' | 'NEEDS_REVIEW', checkNote: string) =>
    prisma.externalReviewStat.update({ where: { id }, data: { status, checkNote, checkedAt: new Date() } })

  const platform = platformFor(row.platform)
  if (!platform || platform.hosts.length === 0) return void (await done('NEEDS_REVIEW', 'Other platform: not fetched; needs a person to check.'))
  if (platform.noFetch) return void (await done('NEEDS_REVIEW', platform.noFetch))

  let url: URL
  try {
    url = new URL(row.profileUrl)
  } catch {
    return void (await done('NEEDS_REVIEW', 'The link could not be read.'))
  }
  if (url.protocol !== 'https:' || !hostMatches(url.hostname, platform.hosts)) {
    return void (await done('NEEDS_REVIEW', `The link is not on ${platform.label}.`))
  }

  const robots = await politeGet(`${url.origin}/robots.txt`)
  if (!robots) return void (await done('NEEDS_REVIEW', 'Could not reach the platform to read its robots.txt.'))
  // 4xx robots.txt = no rules; anything else unusual = don't fetch.
  const robotsText = robots.status === 200 ? robots.body : robots.status >= 400 && robots.status < 500 ? '' : null
  if (robotsText === null) return void (await done('NEEDS_REVIEW', `robots.txt answered ${robots.status}; not fetched.`))
  if (!robotsAllows(robotsText, url.pathname + url.search)) {
    return void (await done('NEEDS_REVIEW', "The platform's robots.txt does not allow fetching profile pages."))
  }

  const page = await politeGet(url.toString())
  if (!page) return void (await done('NEEDS_REVIEW', 'The profile page did not load.'))
  if (page.status !== 200) {
    return void (await done('NEEDS_REVIEW', page.status >= 300 && page.status < 400 ? 'The profile link redirected (often to a login page).' : `The profile page answered ${page.status}.`))
  }
  const result = matchProfilePage(page.body, row.candidate, { rating: row.rating, reviewCount: row.reviewCount })
  await done(result.confirmed ? 'LINK_CHECKED' : 'NEEDS_REVIEW', result.note)
}
