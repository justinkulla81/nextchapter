import { NextRequest, NextResponse } from 'next/server'
import { sweepGmail, sweepCalendar } from '@/lib/crm/sync'

export const maxDuration = 300

/**
 * Nightly CRM activity sync.
 *
 * Runs the two sweeps independently: a Gmail failure must not cost the
 * calendar's results, since the calendar is often the more accurate
 * last-contacted signal for anyone you've actually met.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = Number(request.nextUrl.searchParams.get('days') ?? '14')
  const results: Record<string, unknown> = {}

  try {
    results.gmail = await sweepGmail(days)
  } catch (e) {
    results.gmail = { error: e instanceof Error ? e.message : String(e) }
  }

  try {
    results.calendar = await sweepCalendar(days)
  } catch (e) {
    results.calendar = { error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(results)
}
