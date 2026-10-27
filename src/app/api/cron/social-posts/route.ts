import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runSocialPosts } from '@/lib/social/run'

export const maxDuration = 120

// Mondays: posts last week's layoff totals to Bluesky and X (src/lib/social/run.ts). A dry run until SOCIAL_POSTING_ENABLED=1;
// safe to run again, since each post goes to each channel once.
export const GET = withCronRun('social-posts', async () => NextResponse.json(await runSocialPosts()))
