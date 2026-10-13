import { NextResponse, type NextRequest } from 'next/server'
import { sendWeeklyDigests } from '@/lib/higher-ed/inbox'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 120

// Monday morning: one email per college office with what's waiting for it.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await sendWeeklyDigests()
  captureServerEvent('cron', 'he_weekly_digest_sent', result)
  return NextResponse.json({ ok: true, ...result })
}
