import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runMobilePush } from '@/lib/mobile/push'

// No cron in vercel.json while this is off (saves a slot of the 100 allowed); add one back when switching it on. See CRON_BUNDLES in lib/cron/schedule.ts.
export const maxDuration = 300

// Hourly: push new matches for saved searches and new layoff filings at saved employers to the app. Off until MOBILE_PUSH_ENABLED=1.
export const GET = withCronRun('mobile-push', async () => {
  if (process.env.MOBILE_PUSH_ENABLED !== '1') return NextResponse.json({ skipped: 'MOBILE_PUSH_ENABLED is not 1' })
  return NextResponse.json(await runMobilePush())
})
