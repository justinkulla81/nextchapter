import { NextRequest, NextResponse } from 'next/server'
import { runSendBatch } from '@/lib/mailing/editions'
import { syncWebsiteSignups } from '@/lib/mailing/lists'

export const maxDuration = 300

/**
 * Every five minutes: starts scheduled editions that are due and sends the
 * next slice of any edition that's sending, within the hourly rate in
 * Mailing settings (50 an hour by default). Also keeps website signups in
 * step with the Monthly Update list.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const signups = await syncWebsiteSignups()
  const result = await runSendBatch(25)
  return NextResponse.json({ signups, ...result })
}
