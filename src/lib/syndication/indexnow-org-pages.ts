import 'server-only'
import { saveOrgPageSummary } from '@/lib/seo/org-pages'
import { planOrgPageUpdates } from '@/lib/seo/org-page-rules'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { SITE_URL } from '@/lib/seo/facts'
import { chunk, INDEXNOW_BATCH, INDEXNOW_ENDPOINT, indexNowBody } from '@/lib/syndication/syndication'

// IndexNow for the American Job Center, economic development and workforce board pages: the indexable ones that are
// new, or whose last-changed date moved, since the last run. Same key, endpoint and state bucket as the job pages
// (indexnow-server.ts). A rejected batch stops the run; the rest goes next time.

const WARM_PAGES = 300

/** Opens the most recently changed pages once so the first search-engine visit is served from cache, not built. */
async function warm(paths: string[]): Promise<number> {
  let ok = 0
  for (let i = 0; i < paths.length; i += 5) {
    const res = await Promise.all(paths.slice(i, i + 5).map((p) => fetch(`${SITE_URL}${p}`, { signal: AbortSignal.timeout(30_000) }).then((r) => r.ok).catch(() => false)))
    ok += res.filter(Boolean).length
  }
  return ok
}

const STATE_PATH = 'indexnow/org-pages.json.gz'
interface State { v: 1; pages: Record<string, string> }

export async function runOrgPagesIndexNow(opts: { dryRun?: boolean } = {}) {
  const [all, saved] = await Promise.all([saveOrgPageSummary(), readJsonGz<State>(STATE_BUCKET, STATE_PATH)])
  const current = [...all.JOB_CENTER.indexable, ...all.ECON_DEV.indexable, ...all.WORKFORCE_BOARD.indexable].map((p) => ({ path: p.path, lastModified: p.lastModified.toISOString() }))
  const announced = { ...(saved?.pages ?? {}) }
  const due = planOrgPageUpdates(current, announced)
  const stamp = new Map(current.map((p) => [p.path, p.lastModified]))
  const result = { dryRun: !!opts.dryRun, indexable: current.length, due: due.length, sent: 0, stoppedEarly: null as string | null, sample: due.slice(0, 3).map((p) => `${SITE_URL}${p}`), warmed: 0 }
  if (opts.dryRun) return result
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
  const newest = [...current].sort((a, b) => b.lastModified.localeCompare(a.lastModified)).slice(0, WARM_PAGES).map((p) => p.path)
  result.warmed = await warm(newest)
  return result
}
