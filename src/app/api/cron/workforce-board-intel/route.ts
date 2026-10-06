import { NextRequest, NextResponse } from 'next/server'
import { syncBoardPartners } from '@/lib/workforce/partners'
import { refreshBoardNews } from '@/lib/workforce/board-news'
import { refreshCountyLabor } from '@/lib/workforce/labor'
import { derivePlaceCounties } from '@/lib/workforce/match'

export const maxDuration = 300

/**
 * Daily: what each workforce board page shows besides its layoffs.
 *
 *   News — layoffs and AI-and-jobs stories naming the board's area, for
 *     boards with layoffs, the ones checked longest ago first.
 *   Job centers — the board's American Job Centers, a few dozen boards a
 *     day, so the whole directory turns over every couple of weeks.
 *   Unemployment — county figures from BLS, only for counties not updated
 *     in 25 days, so most days this asks BLS for nothing.
 *
 * Each step has its own budget and a failure in one does not stop the rest.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const run = async <T,>(fn: () => Promise<T>) => {
    try { return await fn() } catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
  }
  const places = await run(() => derivePlaceCounties(15_000))
  const news = await run(() => refreshBoardNews(90_000))
  const partners = await run(() => syncBoardPartners(100_000))
  const labor = await run(() => refreshCountyLabor(60_000))
  return NextResponse.json({ places, news, partners, labor })
}
