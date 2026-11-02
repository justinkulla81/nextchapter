import { NextRequest, NextResponse } from 'next/server'
import { runLayoffNewsCheck } from '@/lib/warn/news-check'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'
import { runLinkedInDraftSweep } from '@/lib/linkedin/layoff-post-sweep'
import { retryHeldLayoffAlerts } from '@/lib/warn/layoff-alert'
import { runLayoffIndexNow } from '@/lib/syndication/indexnow-layoffs'

export const maxDuration = 300

/**
 * Hourly fast lane of the layoff news check: only the last few hours of Google News, a handful of broad queries
 * (runLayoffNewsCheck({ fast: true })). The full check every three hours reads the whole week and picked a layoff up a median of
 * 11 hours after it was published; this one catches it within the hour it is indexed. Same rules as the full check: a second
 * publisher or a trusted outlet, nothing already on file, mentions keyed by URL, so running both never adds a layoff twice.
 *
 * Only when a layoff was added does it do the rest of the chain: held alert retry, the suggested LinkedIn post, and the page
 * refresh and IndexNow ping, so the page is up and announced the same hour. The primary-contact sweep stays with the full check.
 */
export const GET = withCronRun('layoff-news-fast', async (_request: NextRequest) => {
  let news: Awaited<ReturnType<typeof runLayoffNewsCheck>> | { error: string }
  try {
    news = await runLayoffNewsCheck({ fast: true })
    captureServerEvent('cron', 'layoff_news_check_run', {
      mentions: news.mentions, added: news.added.length, covered: news.covered, lookups: news.lookups, contacts: news.contacts, source: 'layoff-news-fast',
    })
  } catch (e) {
    news = { error: e instanceof Error ? e.message : String(e) }
  }
  if (!('added' in news) || news.added.length === 0) return NextResponse.json({ news })
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
  return NextResponse.json({ news, held, linkedin, indexnow })
})
