import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { SITE_URL } from '@/lib/seo/facts'
import {
  WARM_GAP_MS, WARM_REQUEST_TIMEOUT_MS, dayNumber, groupByType, parseLocs, pickWarmPaths, sitemapsToRead,
} from '@/lib/seo/page-warmup'

export const maxDuration = 300

// Asks for a few hundred lightly visited public pages a day (src/lib/seo/page-warmup.ts), one at a time, so the first real
// visit, usually Googlebot's, is served from the cache instead of rendering the page. It reads the live sitemaps over HTTP,
// not the database, and the pages fill their own caches. Stops before the function's time limit and carries on tomorrow.
// Rerun-safe: it only reads. Skips any section PAUSE_HEAVY_PAGES switches off.
const BUDGET_MS = 270_000
const HEADERS = { 'User-Agent': 'NextChapterWarmup/1.0 (+https://launchyournextchapter.com)' }

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(WARM_REQUEST_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.text()
}

export const GET = withCronRun('page-warmup', async () => {
  const started = Date.now()
  const day = dayNumber(new Date())
  const indexLocs = parseLocs(await getText(`${SITE_URL}/sitemap-index.xml`).catch(() => ''))
  const urls: string[] = []
  const failedSitemaps: string[] = []
  for (const sm of sitemapsToRead(indexLocs, SITE_URL, day)) {
    try {
      urls.push(...parseLocs(await getText(sm)))
    } catch {
      failedSitemaps.push(sm)
    }
  }
  const paths = pickWarmPaths(groupByType(urls, SITE_URL), day)

  let hit = 0, miss = 0, other = 0, failed = 0, asked = 0
  for (const path of paths) {
    if (Date.now() - started > BUDGET_MS) break
    asked++
    try {
      const res = await fetch(`${SITE_URL}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(WARM_REQUEST_TIMEOUT_MS) })
      await res.arrayBuffer()
      const cache = res.headers.get('x-vercel-cache')
      if (cache === 'HIT') hit++
      else if (cache === 'MISS' || cache === 'STALE' || cache === 'PRERENDER') miss++
      else other++
      if (!res.ok) failed++
    } catch {
      failed++
    }
    await new Promise((r) => setTimeout(r, WARM_GAP_MS))
  }

  const result = { day, planned: paths.length, asked, alreadyCached: hit, rendered: miss, otherCache: other, failed, failedSitemaps, ms: Date.now() - started }
  // A run where most requests failed is a failed run, so the ledger and the admin Job health page show it.
  return NextResponse.json(result, { status: asked > 0 && failed > asked / 2 ? 500 : 200 })
})
