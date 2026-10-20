import { NextRequest, NextResponse } from 'next/server'
import { runLayoffNewsCheck } from '@/lib/warn/news-check'
import { runLayoffPrimarySweep } from '@/lib/warn/layoff-primary-run'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'
import { runLinkedInDraftSweep } from '@/lib/linkedin/layoff-post-sweep'

export const maxDuration = 300

/**
 * The layoff news check on its own, every three hours.
 *
 * It used to run only inside the daily warn-sync, so a story published after
 * 07:00 UTC waited up to a day to be read, and a layoff needing two publishers
 * waited for the next day's run to see the second one (Kroger's 3,000
 * corporate cuts, published on the 12th, reached the tracker on the 14th). The
 * check is idempotent (mentions are keyed by URL, a layoff already on file is
 * never added twice), so it is safe to run as often as the schedule says, and
 * warn-sync keeps its own daily pass as a backstop.
 *
 * The primary-contact sweep follows so a layoff added here gets its CHRO and
 * primary contact the same day, not at the next 07:00 run.
 */
export const GET = withCronRun('layoff-news', async (_request: NextRequest) => {
  let news: Awaited<ReturnType<typeof runLayoffNewsCheck>> | { error: string }
  try {
    news = await runLayoffNewsCheck()
    captureServerEvent('cron', 'layoff_news_check_run', {
      mentions: news.mentions, added: news.added.length, covered: news.covered, lookups: news.lookups, contacts: news.contacts, source: 'layoff-news',
    })
  } catch (e) {
    news = { error: e instanceof Error ? e.message : String(e) }
  }
  let primary: Awaited<ReturnType<typeof runLayoffPrimarySweep>> | { error: string }
  try {
    primary = await runLayoffPrimarySweep()
  } catch (e) {
    primary = { error: e instanceof Error ? e.message : String(e) }
  }
  // Suggested LinkedIn posts for the credible layoffs just filed (no model call; see the sweep).
  let linkedin: Awaited<ReturnType<typeof runLinkedInDraftSweep>> | { error: string }
  try {
    linkedin = await runLinkedInDraftSweep()
  } catch (e) {
    linkedin = { error: e instanceof Error ? e.message : String(e) }
  }
  return NextResponse.json({ news, primary, linkedin })
})
