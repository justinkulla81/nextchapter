import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runJobFeed } from '@/lib/syndication/job-feed-server'

export const maxDuration = 800

// Daily: rebuilds the parts older than ~40 hours of both feeds (https://launchyournextchapter.com/feeds/jobs-direct.xml.gz and
// https://launchyournextchapter.com/feeds/jobs-jooble.xml.gz) from one read of the jobs, oldest first, within ~11 minutes
// (src/lib/syndication/job-feed-server.ts). The Jooble feed had its own cron, which read every job a second time.
export const GET = withCronRun('job-feed-direct', async () => {
  const { sampleXml: _sample, ...result } = await runJobFeed({ variants: ['direct', 'jooble'], budgetMs: 660_000 })
  return NextResponse.json(result)
})
