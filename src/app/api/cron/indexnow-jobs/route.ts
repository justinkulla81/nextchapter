import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runIndexNow } from '@/lib/syndication/indexnow-server'
import { runCollegeIndexNow } from '@/lib/syndication/indexnow-colleges'

export const maxDuration = 800

// Daily: tells IndexNow (Bing, Yandex, Seznam, Naver) which public job pages
// (https://launchyournextchapter.com/jobs/<id>) closed and which are new since the last
// run (src/lib/syndication/indexnow-server.ts). Safe to run again: it only sends changes.
// The college pages (/higher-education/<state>/<college>) are pinged in the same run, when new or reloaded.
export const GET = withCronRun('indexnow-jobs', async () => {
  const jobs = await runIndexNow()
  const colleges = await runCollegeIndexNow().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))
  return NextResponse.json({ ...jobs, colleges })
})
