import { NextResponse } from 'next/server'
import { runSendBatch } from '@/lib/mailing/editions'
import { syncWebsiteSignups } from '@/lib/mailing/lists'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

/**
 * Every five minutes: starts scheduled editions that are due and sends the
 * next slice of any edition that's sending, within the hourly rate in
 * Mailing settings (50 an hour by default). Also keeps website signups in
 * step with the Monthly Update list.
 */
export const GET = withCronRun('mailing-send', async () => {
  const signups = await syncWebsiteSignups()
  // 45 every five minutes lets the hourly rate in Mailing settings go up to about 540 (it was 25, a ceiling of 300 an hour).
  const result = await runSendBatch(45)
  return NextResponse.json({ signups, ...result })
})
