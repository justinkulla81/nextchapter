import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runBlsReleasePosts } from '@/lib/social/bls-release'
import { runSocialStream } from '@/lib/social/stream'

export const maxDuration = 120

// Every five minutes: one tick of the social stream (src/lib/social/stream.ts). It posts at most one thing per tick, at least 20
// minutes apart, between 12:00 and 02:00 UTC: every layoff (WARN filings, and emailed announcements an SEC filing or two outlets back),
// each followed by a non-layoff post (a list, a hot skill, an AI pay finding), written from one verified fact. X gets layoffs of 250+
// workers, three a day at most, and one story a day. Once an hour it also checks for the BLS jobs report and JOLTS releases
// (src/lib/social/bls-release.ts). A dry run until SOCIAL_POSTING_ENABLED=1. The job keeps its old name for the cron ledger.
export const GET = withCronRun('social-filings', async () => {
  const stream = await runSocialStream()
  // A BLS outage must never stop the stream, or the other way round. BLS allows few requests a day, so only in the first minutes of the hour.
  const bls = new Date().getUTCMinutes() < 5 ? await runBlsReleasePosts().catch((e) => ({ error: e instanceof Error ? e.message : String(e) })) : { skipped: 'hourly' }
  return NextResponse.json({ ...stream, bls })
})
