import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runGoogleIndexing } from '@/lib/syndication/google-indexing-server'

export const maxDuration = 800

// Daily: Google Indexing API for public job pages — closed jobs (URL_DELETED) first, then
// the newest not yet sent (URL_UPDATED), within the 200-a-day quota. Does nothing (a dry
// run) until GOOGLE_INDEXING_ENABLED and GOOGLE_INDEXING_SA_JSON are set
// (src/lib/syndication/google-indexing-server.ts).
export const GET = withCronRun('google-indexing-jobs', async () => NextResponse.json(await runGoogleIndexing()))
