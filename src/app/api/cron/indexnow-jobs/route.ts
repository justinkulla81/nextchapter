import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runIndexNow } from '@/lib/syndication/indexnow-server'
import { runEmployerIndexNow } from '@/lib/syndication/indexnow-employers'
import { runSearchFirmIndexNow } from '@/lib/syndication/search-firm-indexnow'

export const maxDuration = 800

// Daily: tells IndexNow (Bing, Yandex, Seznam, Naver) which public job pages
// (https://launchyournextchapter.com/jobs/<id>) closed and which are new since the last
// run (src/lib/syndication/indexnow-server.ts), and announces newly indexable employer pages
// (src/lib/syndication/indexnow-employers.ts) and search-firm pages. Safe to run again: it only sends changes.
export const GET = withCronRun('indexnow-jobs', async () => {
  const jobs = await runIndexNow()
  // Employer and search-firm pages ride the same daily run; a failure in one must not hide the others.
  const employers = await runEmployerIndexNow().catch((e) => ({ error: String(e?.message ?? e).slice(0, 200) }))
  const searchFirms = await runSearchFirmIndexNow().catch((e) => ({ error: String(e) }))
  return NextResponse.json({ ...jobs, employers, searchFirms })
})
