import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runFilingPosts } from '@/lib/social/filings'

export const maxDuration = 120

// Hourly: posts new WARN filings of 100+ workers to Bluesky, Mastodon, Telegram, Discord, Slack, Threads and Facebook, whichever
// are configured, and 250+ worker filings to X, three a day at most (src/lib/social/filings.ts). A dry run until SOCIAL_POSTING_ENABLED=1.
export const GET = withCronRun('social-filings', async () => NextResponse.json(await runFilingPosts()))
