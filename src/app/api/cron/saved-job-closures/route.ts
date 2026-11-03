import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runSavedJobClosures } from '@/lib/jobs/saved-job-closures'

// Daily, in the 12:00 UTC bundle: after the 09:00 UTC run that expires old postings (expire-job-postings). Tells the owner which
// saved jobs were taken down and who saved them, and (with SAVED_JOB_CLOSURE_EMAILS=true) emails each member with similar open jobs.
export const maxDuration = 300

export const GET = withCronRun('saved-job-closures', async () => NextResponse.json(await runSavedJobClosures()))
