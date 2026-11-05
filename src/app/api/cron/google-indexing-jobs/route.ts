import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { JOB_SEARCH_PINGS_PAUSED } from '@/lib/jobs/public-job-page'
import { runGoogleIndexing } from '@/lib/syndication/google-indexing-server'

export const maxDuration = 800

// Daily: Google Indexing API for public job pages — closed jobs (URL_DELETED) first, then
// the newest not yet sent (URL_UPDATED), within the 200-a-day quota. Does nothing (a dry
// run) until GOOGLE_INDEXING_ENABLED and GOOGLE_INDEXING_SA_JSON are set
// (src/lib/syndication/google-indexing-server.ts).
export const GET = withCronRun('google-indexing-jobs', async () => NextResponse.json(JOB_SEARCH_PINGS_PAUSED ? { paused: true } : await runGoogleIndexing()), { recordResult: true })
// recordResult keeps the answer (paused, dry run, or sent counts and a Google refusal in stoppedEarly) in CronRun.detail, which the OK status alone hides.
// Paused while JOB_SEARCH_PINGS_PAUSED is true (src/lib/jobs/public-job-page.ts).
