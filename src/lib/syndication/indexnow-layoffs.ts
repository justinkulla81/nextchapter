import 'server-only'
import { revalidatePath } from 'next/cache'
import { SITE_URL } from '@/lib/seo/facts'
import { planOrgPageUpdates } from '@/lib/seo/org-page-rules'
import { meetsCompanyLayoffBar } from '@/lib/seo/page-bars'
import { stateSlug } from '@/lib/seo/states'
import { isNetworkCompany } from '@/lib/network/eligibility'
import { getAnnouncements, hasRecentAnnouncement } from '@/lib/warn/company-announcements'
import { getCompanies, getPublicNotices, getStateSummaries } from '@/lib/warn/layoff-pages'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { WEBSUB_HUB } from '@/lib/feeds/rss'
import { chunk, INDEXNOW_BATCH, INDEXNOW_ENDPOINT, indexNowBody } from '@/lib/syndication/syndication'

// Hourly: every layoff page whose record changed since it was last announced (a new WARN notice, a new announcement,
// a new state notice) is refreshed on our side first (the pages are cached for a day) and then sent to IndexNow, so
// a new layoff is crawlable within the hour instead of the next day. Only pages that are indexable are sent. Safe to
// run again: it only sends what has not been announced. Google reads the hourly sitemap; it has no push for these pages.

const STATE_PATH = 'indexnow/layoff-pages.json.gz'
interface State { v: 1; pages: Record<string, string> }
interface Page { path: string; lastModified: string }

async function currentPages(): Promise<Page[]> {
  const [notices, companies, states, announcements] = await Promise.all([
    getPublicNotices(), getCompanies(), getStateSummaries(), getAnnouncements().catch(() => new Map()),
  ])
  // The stamp moves when a notice is collected, not only when its date is new: a state can publish an old filing late.
  const fetchedBy = new Map<string, number>()
  let newest = 0
  for (const n of notices) {
    fetchedBy.set(n.slug, Math.max(fetchedBy.get(n.slug) ?? 0, n.fetchedAt.getTime()))
    newest = Math.max(newest, n.fetchedAt.getTime())
  }
  const out: Page[] = [{ path: '/layoffs', lastModified: `${newest}:${notices.length}` }]
  for (const s of states) {
    const inState = notices.filter((n) => n.state === s.state)
    out.push({ path: `/layoffs/${stateSlug(s.state)}`, lastModified: `${Math.max(...inState.map((n) => n.fetchedAt.getTime()))}:${inState.length}` })
  }
  const seen = new Set<string>()
  for (const c of companies.values()) {
    const a = announcements.get(c.slug)
    const recent = hasRecentAnnouncement(a)
    if (!meetsCompanyLayoffBar(c) && !recent) continue
    seen.add(c.slug)
    const stamp = `${fetchedBy.get(c.slug) ?? 0}:${c.notices.length}:${a?.items.length ?? 0}`
    out.push({ path: `/layoffs/company/${c.slug}`, lastModified: stamp })
    if (isNetworkCompany(c)) out.push({ path: `/network/company/${c.slug}`, lastModified: stamp })
  }
  for (const a of announcements.values()) {
    if (seen.has(a.slug) || !hasRecentAnnouncement(a)) continue
    out.push({ path: `/layoffs/company/${a.slug}`, lastModified: `0:0:${a.items.length}` })
  }
  return out
}

/** Feeds whose content changed: the all-states feeds always, plus each state feed whose state page is due. */
export function changedFeeds(duePaths: string[]): string[] {
  const feeds = new Set<string>([`${SITE_URL}/feeds/layoffs`, `${SITE_URL}/feeds/layoffs-100plus.xml`, `${SITE_URL}/feeds/layoffs-weekly.xml`])
  for (const p of duePaths) {
    const m = /^\/layoffs\/([a-z-]+)$/.exec(p)
    if (m && !['this-week', 'week', 'by-state', 'company'].includes(m[1])) feeds.add(`${SITE_URL}/feeds/layoffs/${m[1]}`)
  }
  return [...feeds]
}

async function pingWebSub(due: string[]): Promise<string> {
  try {
    const feeds = changedFeeds(due)
    const body = new URLSearchParams({ 'hub.mode': 'publish' })
    for (const f of feeds) body.append('hub.url', f)
    const res = await fetch(WEBSUB_HUB, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15_000) })
    return `${feeds.length} feeds, hub answered ${res.status}`
  } catch (e) {
    return `failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200)
  }
}

export async function runLayoffIndexNow(opts: { dryRun?: boolean } = {}) {
  const [current, saved] = await Promise.all([currentPages(), readJsonGz<State>(STATE_BUCKET, STATE_PATH)])
  const announced = { ...(saved?.pages ?? {}) }
  const stamp = new Map(current.map((p) => [p.path, p.lastModified]))
  const due = planOrgPageUpdates(current, announced)
  const result = { dryRun: !!opts.dryRun, pages: current.length, due: due.length, refreshed: 0, sent: 0, stoppedEarly: null as string | null, websub: null as string | null, sample: due.slice(0, 3).map((p) => `${SITE_URL}${p}`) }
  if (opts.dryRun || !due.length) return result
  // First run: the whole set is "due". Announce it, but only refresh pages when a handful changed; a mass refresh is a deploy's job.
  if (due.length <= 200) {
    for (const p of due) { revalidatePath(p); result.refreshed++ }
  }
  // Tell WebSub hubs which layoff feeds changed, so readers like Feedly show the notice within seconds. Best effort.
  result.websub = await pingWebSub(due)
  for (const batch of chunk(due, INDEXNOW_BATCH)) {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowBody(batch.map((p) => `${SITE_URL}${p}`))),
      signal: AbortSignal.timeout(60_000),
    })
    if (res.status !== 200 && res.status !== 202) {
      result.stoppedEarly = `IndexNow answered ${res.status}: ${(await res.text()).slice(0, 300)}`
      break
    }
    for (const p of batch) announced[p] = stamp.get(p)!
    result.sent += batch.length
    await writeJsonGz(STATE_BUCKET, STATE_PATH, { v: 1, pages: announced } satisfies State)
  }
  return result
}
