import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runIndexNow } from '@/lib/syndication/indexnow-server'
import { runEmployerIndexNow } from '@/lib/syndication/indexnow-employers'

export const maxDuration = 800

// Daily: tells IndexNow (Bing, Yandex, Seznam, Naver) which public job pages
// (https://launchyournextchapter.com/jobs/<id>) closed and which are new since the last
// run (src/lib/syndication/indexnow-server.ts), and announces newly indexable employer pages
// (src/lib/syndication/indexnow-employers.ts). Safe to run again: it only sends changes.
export const GET = withCronRun('indexnow-jobs', async () => {
  const jobs = await runIndexNow()
  // Employer pages ride the same daily run: each indexable page is announced once, as it first qualifies.
  const employers = await runEmployerIndexNow().catch((e) => ({ error: String(e?.message ?? e).slice(0, 200) }))
  return NextResponse.json({ ...jobs, employers })
})
