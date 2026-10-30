import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runJobFeed } from '@/lib/syndication/job-feed-server'

export const maxDuration = 800

// Daily: rebuilds the direct-listing feed (https://launchyournextchapter.com/feeds/jobs-direct.xml.gz)
// part by part, oldest first, within ~11 minutes (src/lib/syndication/job-feed-server.ts).
export const GET = withCronRun('job-feed-direct', async () => {
  const { sampleXml: _sample, ...result } = await runJobFeed({ variant: 'direct', budgetMs: 660_000 })
  return NextResponse.json(result)
})
