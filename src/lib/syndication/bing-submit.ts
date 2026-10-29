import 'server-only'
import { SITE_URL } from '@/lib/seo/facts'
import { parseSitemapEntries, pickDailyList, type Requested } from '@/lib/seo/daily-index-list'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { BING_API, bingDailyLimit, bingSubmitBody } from '@/lib/syndication/syndication'

// Daily: asks Bing (its Webmaster API) to crawl today's layoff pages: the latest layoffs first, then layoff pages never
// submitted, within the day's quota. The same choice as the daily Google run (src/lib/seo/daily-index-list.ts). IndexNow
// already tells Bing about changed pages hourly; this adds Bing's own crawl request. Does nothing until BING_WEBMASTER_API_KEY is set.

const STATE_PATH = 'bing/submitted-layoffs.json.gz'
interface State { v: 1; submitted: Requested }

export interface BingSubmitResult {
  enabled: boolean
  dryRun: boolean
  quota: number | null
  planned: number
  submitted: number
  stoppedEarly: string | null
  sample: string[]
}

export async function runBingSubmit(opts: { dryRun?: boolean } = {}): Promise<BingSubmitResult> {
  const key = process.env.BING_WEBMASTER_API_KEY
  const result: BingSubmitResult = { enabled: !!key, dryRun: !!opts.dryRun || !key, quota: null, planned: 0, submitted: 0, stoppedEarly: null, sample: [] }
  if (!key) return result

  // The day's quota decides how many; a failed quota read falls back to the configured limit.
  try {
    const res = await fetch(`${BING_API}/GetUrlSubmissionQuota?siteUrl=${encodeURIComponent(`${SITE_URL}/`)}&apikey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(30_000) })
    if (res.ok) result.quota = Number(((await res.json()) as { d?: { DailyQuota?: number } }).d?.DailyQuota ?? NaN)
    if (!Number.isFinite(result.quota)) result.quota = null
  } catch {
    result.quota = null
  }
  const size = bingDailyLimit(result.quota)
  if (size === 0) { result.stoppedEarly = 'Bing daily quota is 0'; return result }

  const [sitemap, saved] = await Promise.all([
    fetch(`${SITE_URL}/sitemap.xml`, { signal: AbortSignal.timeout(60_000) }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`sitemap.xml ${r.status}`)))),
    readJsonGz<State>(STATE_BUCKET, STATE_PATH),
  ])
  const submitted: Requested = { ...(saved?.submitted ?? {}) }
  const picks = pickDailyList(parseSitemapEntries(sitemap), submitted, size)
  result.planned = picks.length
  result.sample = picks.slice(0, 3).map((p) => p.url)
  if (result.dryRun || picks.length === 0) return result

  const res = await fetch(`${BING_API}/SubmitUrlBatch?apikey=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(bingSubmitBody(picks.map((p) => p.url))),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    result.stoppedEarly = `Bing answered ${res.status}: ${(await res.text()).slice(0, 300)}`
    return result
  }
  const at = new Date().toISOString()
  for (const p of picks) submitted[p.url] = at
  result.submitted = picks.length
  await writeJsonGz(STATE_BUCKET, STATE_PATH, { v: 1, submitted } satisfies State)
  return result
}
