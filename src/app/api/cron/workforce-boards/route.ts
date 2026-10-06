import { NextRequest, NextResponse } from 'next/server'
import { syncWorkforceBoards } from '@/lib/workforce/directory'
import { matchNoticesToBoards } from '@/lib/workforce/match'
import { rankColleges } from '@/lib/workforce/college-rank'

export const maxDuration = 300

/**
 * Weekly: refreshes the local workforce board directory from CareerOneStop
 * (the states read longest ago first), then matches any notices still
 * waiting for a board. ?state=TX refreshes one state; ?budgetMs=0 only
 * matches; ?matchMs= sets how long matching may run.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const state = request.nextUrl.searchParams.get('state')?.toUpperCase()
  const budget = Number(request.nextUrl.searchParams.get('budgetMs') ?? 200_000)
  const boards = budget > 0 ? await syncWorkforceBoards(budget, state ? [state] : undefined) : {}
  const notices = await matchNoticesToBoards(Number(request.nextUrl.searchParams.get('matchMs') ?? 60_000))
  // Re-rank colleges against this week's layoffs.
  const colleges = await rankColleges().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))
  return NextResponse.json({ boards, notices, colleges })
}
