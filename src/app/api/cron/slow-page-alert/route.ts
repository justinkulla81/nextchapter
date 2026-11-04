import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runSlowPageAlert } from '@/lib/perf/slow-alert'

export const maxDuration = 60

// Every five minutes (in bundle-every-5): looks at the last 15 minutes of slow-page and stalled-read reports and emails the admin when
// several people are waiting, at most once an hour (lib/perf/slow-alert.ts, thresholds in lib/perf/thresholds.ts).
export const GET = withCronRun('slow-page-alert', async () => NextResponse.json(await runSlowPageAlert()))
