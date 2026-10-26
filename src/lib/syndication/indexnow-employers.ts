import 'server-only'
import { SITE_URL } from '@/lib/seo/facts'
import { employerSlug } from '@/lib/seo/employer-slug'
import { employerPageCanonicalRows } from '@/lib/seo/employer-pages'
import { chunk, INDEXNOW_BATCH, INDEXNOW_ENDPOINT, INDEXNOW_NEW_PER_RUN, indexNowBody } from '@/lib/syndication/syndication'
import { readAnnounced, writeAnnounced } from '@/lib/syndication/indexnow-server'

// IndexNow for employer pages (https://launchyournextchapter.com/employers/<slug>): tells Bing, Yandex and the other
// IndexNow engines (which also feed Microsoft Copilot and ChatGPT search) about each indexable employer page once, as
// it first qualifies. Pages that fall below the bar stay noindex and are simply not announced again. Safe to re-run.
const STATE_PATH = 'indexnow/employers.json.gz'

export interface EmployerIndexNowResult { dryRun: boolean; indexable: number; announcedBefore: number; sent: number; stoppedEarly: string | null }

export async function runEmployerIndexNow(opts: { dryRun?: boolean } = {}): Promise<EmployerIndexNowResult> {
  const rows = await employerPageCanonicalRows()
  const slugs = rows.map((r) => employerSlug(r.canonical, r.id))
  const announced = await readAnnounced(STATE_PATH)
  const fresh = slugs.filter((s) => !announced.has(s)).slice(0, INDEXNOW_NEW_PER_RUN)
  const result: EmployerIndexNowResult = { dryRun: !!opts.dryRun, indexable: slugs.length, announcedBefore: announced.size, sent: 0, stoppedEarly: null }
  if (opts.dryRun) return result
  for (const ids of chunk(fresh, INDEXNOW_BATCH)) {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowBody(ids.map((s) => `${SITE_URL}/employers/${s}`))),
      signal: AbortSignal.timeout(60_000),
    })
    if (res.status !== 200 && res.status !== 202) {
      result.stoppedEarly = `IndexNow answered ${res.status}: ${(await res.text()).slice(0, 300)}`
      break
    }
    for (const s of ids) announced.add(s)
    result.sent += ids.length
    await writeAnnounced(STATE_PATH, announced)
  }
  return result
}
