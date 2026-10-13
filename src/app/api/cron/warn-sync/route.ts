import { NextRequest, NextResponse } from 'next/server'
import { syncAllWarnStates, promoteNoticesForKnownOrgs } from '@/lib/warn/sync'
import { runLayoffNewsCheck } from '@/lib/warn/news-check'
import { runSec8kCheck } from '@/lib/warn/sec-8k-run'
import { runLayoffPrimarySweep } from '@/lib/warn/layoff-primary-run'
import { captureServerEvent } from '@/lib/posthog/server'
import { matchNoticesToBoards } from '@/lib/workforce/match'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 300

/**
 * Daily WARN sync — outplacement leads from official state filings — then the
 * layoff news check, which adds a layoff reported by two publishers that no
 * filing covers.
 *
 * Daily since October 2026. It was weekly, on the reasoning that a WARN notice
 * precedes its layoff by 60 days; but the tracker is now public, and a filing
 * that appears on a Tuesday should not wait until the next Monday. The sync
 * takes about half a minute now that it no longer re-asks the database about
 * every notice it has already seen.
 *
 * The news check runs after the filings so it can see what they already cover.
 * Last, new notices get their local workforce board, in whatever time is left.
 */
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  // ?promote=0 stages notices without creating leads, for a dry look.
  const promote = request.nextUrl.searchParams.get('promote') !== '0'
  let results: Awaited<ReturnType<typeof syncAllWarnStates>> | { error: string }
  try {
    results = await syncAllWarnStates(promote)
  } catch (e) {
    results = { error: e instanceof Error ? e.message : String(e) }
  }
  // Waiting notices whose employer is already in the Ecosystem become leads.
  let known: Awaited<ReturnType<typeof promoteNoticesForKnownOrgs>> | { error: string } = { checked: 0, promoted: 0 }
  if (promote) {
    try {
      known = await promoteNoticesForKnownOrgs()
    } catch (e) {
      known = { error: e instanceof Error ? e.message : String(e) }
    }
  }
  // Public companies announce a restructuring in an 8-K the day they decide it,
  // before any WARN notice or story. This replaces the laptop-run layoff watch.
  let sec: Awaited<ReturnType<typeof runSec8kCheck>> | { error: string }
  try {
    sec = await runSec8kCheck()
  } catch (e) {
    sec = { error: e instanceof Error ? e.message : String(e) }
  }
  // Independent of the filings: a state that failed does not stop the news.
  let news: Awaited<ReturnType<typeof runLayoffNewsCheck>> | { error: string }
  try {
    news = await runLayoffNewsCheck()
    captureServerEvent('cron', 'layoff_news_check_run', { mentions: news.mentions, added: news.added.length, covered: news.covered, lookups: news.lookups, contacts: news.contacts })
  } catch (e) {
    news = { error: e instanceof Error ? e.message : String(e) }
  }
  // After the news check so the layoffs it just added are in the sweep: each
  // gets a CHRO if it has none and a primary contact, a warm lead first.
  let primary: Awaited<ReturnType<typeof runLayoffPrimarySweep>> | { error: string }
  try {
    primary = await runLayoffPrimarySweep()
  } catch (e) {
    primary = { error: e instanceof Error ? e.message : String(e) }
  }
  let boards: Awaited<ReturnType<typeof matchNoticesToBoards>> | { error: string }
  try {
    boards = await matchNoticesToBoards(Math.max(0, 270_000 - (Date.now() - started)))
  } catch (e) {
    boards = { error: e instanceof Error ? e.message : String(e) }
  }
  return NextResponse.json({ results, known, sec, news, primary, boards })
}
