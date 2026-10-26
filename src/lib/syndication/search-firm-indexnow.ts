import 'server-only'
import { SITE_URL } from '@/lib/seo/facts'
import { getFirmListings } from '@/lib/seo/search-firm-pages'
import { readAnnounced, writeAnnounced } from '@/lib/syndication/indexnow-server'
import { chunk, INDEXNOW_BATCH, INDEXNOW_ENDPOINT, indexNowBody } from '@/lib/syndication/syndication'
import { planSearchFirmPings } from '@/lib/syndication/search-firm-ping'

const STATE_PATH = 'indexnow/search-firms.json.gz'

/**
 * IndexNow for the search-firm pages: tells the engines about pages that became indexable (or whose roles changed since the
 * last ping) and about pages that dropped below the bar. State is {slug: last ping date}; only changes are sent, so a rerun is safe.
 */
export async function runSearchFirmIndexNow(opts: { dryRun?: boolean } = {}) {
  const firms = await getFirmListings()
  const announced = await readAnnounced(STATE_PATH)
  const plan = planSearchFirmPings(firms.map((f) => ({ slug: f.slug, lastVerifiedAt: f.lastVerifiedAt })), announced)
  const result = { dryRun: !!opts.dryRun, live: firms.length, toSend: plan.send.length, removed: plan.removed.length, sent: 0, stoppedEarly: null as string | null }
  if (opts.dryRun || (plan.send.length === 0 && plan.removed.length === 0)) return result
  for (const urls of chunk([...plan.send, ...plan.removed].map((s) => `${SITE_URL}/search-firms/${s}`), INDEXNOW_BATCH)) {
    const res = await fetch(INDEXNOW_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(indexNowBody(urls)), signal: AbortSignal.timeout(60_000) })
    if (res.status !== 200 && res.status !== 202) { result.stoppedEarly = `IndexNow answered ${res.status}`; return result }
    result.sent += urls.length
  }
  await writeAnnounced(STATE_PATH, plan.next)
  return result
}
