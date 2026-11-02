import { NextRequest, NextResponse } from 'next/server'
import { runLayoffNewsCheck } from '@/lib/warn/news-check'
import { runLayoffPrimarySweep } from '@/lib/warn/layoff-primary-run'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'
import { runLinkedInDraftSweep } from '@/lib/linkedin/layoff-post-sweep'
import { retryHeldLayoffAlerts } from '@/lib/warn/layoff-alert'
import { runLayoffIndexNow } from '@/lib/syndication/indexnow-layoffs'

export const maxDuration = 300

/**
 * The layoff news check on its own, run hourly. Every third hour (UTC hours divisible by 3, the old schedule) is the full check below;
 * the hours between are the fast lane: only the last few hours of Google News, a handful of broad queries
 * (runLayoffNewsCheck({ fast: true })). The full check reads the whole week and picked a layoff up a median of 11 hours after it was
 * published (207 layoffs, October 2026); the fast lane catches it within the hour it is indexed. One cron entry, not two: the
 * project is at Vercel's limit of 100. A manual run (admin Job health) is always the full check. Same rules in both: a second
 * publisher or a trusted outlet, nothing already on file, mentions keyed by URL, so a layoff is never added twice.
 * Fast lane, only when a layoff was added: held alert retry, the suggested LinkedIn post, then page refresh and IndexNow, so the
 * page is up and announced the same hour. The primary-contact sweep stays with the full check.
 *
 * The full check, every three hours.
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
export const GET = withCronRun('layoff-news', async (request: NextRequest) => {
  const fast = request.nextUrl.searchParams.get('trigger') !== 'manual' && new Date().getUTCHours() % 3 !== 0
  if (fast) return runFastLane()
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
  // Layoff alert emails held for missing contacts: look again now that the contact lookups and primary sweep have run.
  let held: Awaited<ReturnType<typeof retryHeldLayoffAlerts>> | { error: string }
  try {
    held = await retryHeldLayoffAlerts()
  } catch (e) {
    held = { error: e instanceof Error ? e.message : String(e) }
  }
  // Suggested LinkedIn posts for the credible layoffs just filed (no model call; see the sweep).
  let linkedin: Awaited<ReturnType<typeof runLinkedInDraftSweep>> | { error: string }
  try {
    linkedin = await runLinkedInDraftSweep()
  } catch (e) {
    linkedin = { error: e instanceof Error ? e.message : String(e) }
  }
  // A layoff added above gets its page announced to IndexNow and the feed hubs now, not at the next hourly run.
  let indexnow: Awaited<ReturnType<typeof runLayoffIndexNow>> | { error: string } | { skipped: true } = { skipped: true }
  if ('added' in news && news.added.length > 0) {
    try {
      indexnow = await runLayoffIndexNow()
    } catch (e) {
      indexnow = { error: e instanceof Error ? e.message : String(e) }
    }
  }
  return NextResponse.json({ news, primary, held, linkedin, indexnow })
})

async function runFastLane(): Promise<NextResponse> {
  let news: Awaited<ReturnType<typeof runLayoffNewsCheck>> | { error: string }
  try {
    news = await runLayoffNewsCheck({ fast: true })
    captureServerEvent('cron', 'layoff_news_check_run', {
      mentions: news.mentions, added: news.added.length, covered: news.covered, lookups: news.lookups, contacts: news.contacts, source: 'layoff-news-fast',
    })
  } catch (e) {
    news = { error: e instanceof Error ? e.message : String(e) }
  }
  if (!('added' in news) || news.added.length === 0) return NextResponse.json({ lane: 'fast', news })
  const followUp = async <T,>(run: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      return await run()
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }
  const held = await followUp(retryHeldLayoffAlerts)
  const linkedin = await followUp(runLinkedInDraftSweep)
  const indexnow = await followUp(runLayoffIndexNow)
  return NextResponse.json({ lane: 'fast', news, held, linkedin, indexnow })
}
