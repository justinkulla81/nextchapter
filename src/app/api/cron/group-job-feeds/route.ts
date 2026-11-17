import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { syncAllFeeds } from '@/lib/workforce/job-feeds-sync'

export const maxDuration = 300

// Daily (in bundle-daily-1300): refreshes every employer job board a Talent Hub organization connected. One public request per board
// and narrow database reads (a board's own listings, at most 500 rows of id and link); new jobs wait for NextChapter review.
export const GET = withCronRun('group-job-feeds', async () => NextResponse.json(await syncAllFeeds()))
