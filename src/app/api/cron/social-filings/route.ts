import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runBlsReleasePosts } from '@/lib/social/bls-release'
import { runFilingPosts } from '@/lib/social/filings'

export const maxDuration = 120

// Hourly: posts new WARN filings of 100+ workers to Bluesky, Mastodon, Telegram, Discord, Slack, Threads and Facebook, whichever
// are configured, and 250+ worker filings to X, three a day at most (src/lib/social/filings.ts). Also posts the emailed layoff
// announcements that an SEC filing or two outlets back, and the BLS jobs report and JOLTS releases the day they come out
// (src/lib/social/bls-release.ts). A dry run until SOCIAL_POSTING_ENABLED=1.
export const GET = withCronRun('social-filings', async () => {
  const filings = await runFilingPosts()
  // A BLS outage must never stop the filings stream, or the other way round.
  const bls = await runBlsReleasePosts().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))
  return NextResponse.json({ ...filings, bls })
})
