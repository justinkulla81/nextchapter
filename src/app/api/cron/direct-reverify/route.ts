import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runDirectReverify } from '@/lib/jobs/direct-reverify'

export const maxDuration = 300

// Hourly: checks up to 500 direct jobs of one sitemap shard that the crawl last confirmed 14 to 30 days ago (hidden from Google only
// for that), refreshes the live ones and archives the ones the employer's system says are gone. See src/lib/jobs/direct-reverify.ts.
export const GET = withCronRun('direct-reverify', async () => NextResponse.json(await runDirectReverify()), { recordResult: true })
