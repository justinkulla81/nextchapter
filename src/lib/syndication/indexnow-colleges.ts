import 'server-only'
import { SITE_URL } from '@/lib/seo/facts'
import { collegePath, planCollegePings } from '@/lib/seo/college-bar'
import { indexableColleges } from '@/lib/seo/college-pages'
import { stateSlug } from '@/lib/seo/states'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { INDEXNOW_BATCH, INDEXNOW_ENDPOINT, chunk, indexNowBody } from '@/lib/syndication/syndication'

// IndexNow for the college pages: each indexable college URL is sent once when it first passes the page bar, and again
// when its facts are reloaded (its lastmod in the sitemap changes). Own state file, so the job pings are untouched.
const STATE_PATH = 'indexnow/colleges.json.gz'

interface State { v: 1; urls: Record<string, string>; updatedAt: string }

export async function runCollegeIndexNow(opts: { dryRun?: boolean } = {}): Promise<{ dryRun: boolean; indexable: number; planned: number; sent: number; stoppedEarly: string | null }> {
  const rows = await indexableColleges()
  const current: Record<string, string> = {}
  for (const r of rows) current[`${SITE_URL}${collegePath(stateSlug(r.state), r.slug)}`] = r.updatedAt.toISOString()
  const announced = (await readJsonGz<State>(STATE_BUCKET, STATE_PATH))?.urls ?? {}
  const plan = planCollegePings(current, announced)
  const out = { dryRun: !!opts.dryRun, indexable: rows.length, planned: plan.length, sent: 0, stoppedEarly: null as string | null }
  if (opts.dryRun) return out
  for (const urls of chunk(plan, INDEXNOW_BATCH)) {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowBody(urls)),
      signal: AbortSignal.timeout(60_000),
    })
    if (res.status !== 200 && res.status !== 202) { out.stoppedEarly = `IndexNow answered ${res.status}: ${(await res.text()).slice(0, 300)}`; break }
    for (const u of urls) announced[u] = current[u]
    out.sent += urls.length
    await writeJsonGz(STATE_BUCKET, STATE_PATH, { v: 1, urls: announced, updatedAt: new Date().toISOString() } satisfies State)
  }
  return out
}
