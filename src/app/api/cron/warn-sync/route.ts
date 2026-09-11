import { NextRequest, NextResponse } from 'next/server'
import { syncAllWarnStates } from '@/lib/warn/sync'

export const maxDuration = 300

/**
 * Weekly WARN sync — outplacement leads from official state filings.
 *
 * Weekly rather than daily because WARN is a legal filing process measured in
 * weeks: a notice must precede the layoff by 60 days, so nothing is lost by
 * checking on Mondays, and a daily fetch of the same 216-row file would be
 * pure waste.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ?promote=0 stages notices without creating leads, for a dry look.
  const promote = request.nextUrl.searchParams.get('promote') !== '0'
  try {
    return NextResponse.json({ results: await syncAllWarnStates(promote) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
