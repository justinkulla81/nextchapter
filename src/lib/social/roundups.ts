import 'server-only'
import { getPublicNotices } from '@/lib/warn/layoff-pages'
import { latestReport } from '@/lib/reports'
import { readRankingIndex } from '@/lib/rankings/store'
import type { Fact } from '@/lib/social/facts'
import { dailyLayoffPost, rankingsPost, reportPost, weekKey, weeklyLayoffPost, type SocialPost } from '@/lib/social/posts'

/**
 * The roundups the old daily job posted (new notices in the last day, last week's totals on Mondays, each new report edition, the
 * month's rankings), now facts in the paced stream, so they no longer land in a burst at 13:00. Their text is only totals from our
 * own data, built by the same functions as before, so it is posted as it is with no model (`plain`). They go to every channel.
 */

const utmOf = (link: string) => link.split('?')[1] ?? ''

/** A roundup that came back empty (a quiet day) is not looked for again for an hour, so the heavy notice read is not repeated every tick. */
const emptyUntil = new Map<string, number>()
const checkable = (key: string, now: Date) => (emptyUntil.get(key) ?? 0) <= now.getTime()
const markEmpty = (key: string, now: Date) => { emptyUntil.set(key, now.getTime() + 55 * 60_000) }

function roundup(post: SocialPost, path: string, campaign: string, build: (utm: string, short: boolean) => SocialPost | null, cites?: string[]): Fact {
  return {
    key: post.key,
    topic: 'roundup',
    plain: true,
    lines: [],
    path,
    campaign,
    cites,
    fallback: (link, short) => (build(utmOf(link), short) ?? post).text,
  }
}

/** The roundup that is due and not yet posted on a channel, or null. `isSent` is that channel's record. Heavy data is loaded only when needed. */
export async function dueRoundup(now: Date, isSent: (key: string) => boolean): Promise<Fact | null> {
  const hour = now.getUTCHours()

  const report = latestReport()
  if (report && !isSent(`report-${report.slug}`)) {
    const post = reportPost(report, now, 'x', true)
    if (post) return roundup(post, `/reports/${report.slug}`, 'report', (utm, short) => reportPost(report, now, utm, short), report.cites)
  }

  const edition = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  if (!isSent(`rankings-${edition}`) && checkable(`rankings-${edition}`, now)) {
    const index = await readRankingIndex().catch(() => [])
    const post = rankingsPost(index, now, 'x')
    if (post) return roundup(post, `/rankings/archive/${edition}`, 'rankings', (utm) => rankingsPost(index, now, utm))
    markEmpty(`rankings-${edition}`, now)
  }

  // The notices' roundups wait until 13:00 UTC, when the morning's filings are in.
  const weekId = `layoffs-week-${weekKey(now)}`
  const dayId = `layoffs-day-${now.toISOString().slice(0, 10)}`
  const needWeek = now.getUTCDay() === 1 && hour >= 13 && !isSent(weekId) && checkable(weekId, now)
  const needDay = hour >= 13 && !isSent(dayId) && checkable(dayId, now)
  if (needWeek || needDay) {
    const all = await getPublicNotices().catch(() => [])
    if (needWeek) {
      const dated = all.filter((x) => x.noticeDateKnown)
      const post = weeklyLayoffPost(dated, now, 'x')
      if (post) return roundup(post, '/layoffs/this-week', 'weekly-layoffs', (utm) => weeklyLayoffPost(dated, now, utm))
      markEmpty(weekId, now)
    }
    if (needDay) {
      const post = dailyLayoffPost(all, now, 'x')
      if (post) return roundup(post, '/layoffs/this-week', 'daily-layoffs', (utm) => dailyLayoffPost(all, now, utm))
      markEmpty(dayId, now)
    }
  }
  return null
}
