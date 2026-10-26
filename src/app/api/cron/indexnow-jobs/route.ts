import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runIndexNow } from '@/lib/syndication/indexnow-server'
import { runSearchFirmIndexNow } from '@/lib/syndication/search-firm-indexnow'

export const maxDuration = 800

// Daily: tells IndexNow (Bing, Yandex, Seznam, Naver) which public job pages
// (https://launchyournextchapter.com/jobs/<id>) closed and which are new since the last
// run (src/lib/syndication/indexnow-server.ts). Safe to run again: it only sends changes.
export const GET = withCronRun('indexnow-jobs', async () => {
  const jobs = await runIndexNow()
  // Search-firm pages ride the same daily run; a failure there must not hide the jobs result.
  const searchFirms = await runSearchFirmIndexNow().catch((e) => ({ error: String(e) }))
  return NextResponse.json({ ...jobs, searchFirms })
})
