import 'server-only'
import { prisma } from '@/lib/prisma'
import { getLayoffRows } from '@/lib/data/layoff-export'
import { getLayoffTracker } from '@/lib/warn/public-tracker'

// The numbers behind the definitions in layoff-definitions.ts, computed from the same rows the pages and the data file use,
// so that the figure on /layoffs, the figure on /data and the footnote that explains the gap always agree.

export interface LayoffCounts {
  asOf: string
  /** /data: filings in the last 24 months, one row each. */
  filings: { count: number; workers: number; since: string }
  /** /layoffs: layoffs counted once per employer, state and date, this calendar year. */
  layoffsYear: { year: number; layoffs: number; workers: number }
  /** Reported layoffs with a U.S. state this year, counted on the same basis. */
  reportedYear: { count: number; workers: number }
  /** Left out of every total: announcements with no U.S. state, this year. */
  notCounted: { count: number; workers: number }
}

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export async function getLayoffCounts(): Promise<LayoffCounts | null> {
  try {
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
    const [rows, tracker, reported, noState] = await Promise.all([
      getLayoffRows(null),
      getLayoffTracker(1),
      prisma.$queryRaw<{ n: number; w: number | null }[]>`
        SELECT COUNT(*)::int AS n, SUM(employees)::int AS w FROM "WarnNotice"
        WHERE "dismissedAt" IS NULL AND state IS NOT NULL AND "noticeDate" >= ${yearStart} AND "noticeDate" <= NOW()
          AND (source = 'MANUAL_ANNOUNCEMENT' OR "sourceUrl" ILIKE '%layoffs.fyi%')`,
      prisma.$queryRaw<{ n: number; w: number | null }[]>`
        SELECT COUNT(*)::int AS n, SUM(employees)::int AS w FROM "WarnNotice"
        WHERE "dismissedAt" IS NULL AND state IS NULL AND "noticeDate" >= ${yearStart} AND "noticeDate" <= NOW()`,
    ])
    if (!tracker) return null
    const oldest = rows.reduce<string | null>((m, r) => (r.notice_date && (!m || r.notice_date < m) ? r.notice_date : m), null)
    return {
      asOf: tracker.updatedLabel || day(new Date()),
      filings: { count: rows.length, workers: rows.reduce((t, r) => t + (r.workers ?? 0), 0), since: oldest ? day(new Date(oldest)) : '' },
      layoffsYear: { year: tracker.year.year, layoffs: tracker.year.layoffs, workers: tracker.year.workers },
      reportedYear: { count: reported[0]?.n ?? 0, workers: reported[0]?.w ?? 0 },
      notCounted: { count: noState[0]?.n ?? 0, workers: noState[0]?.w ?? 0 },
    }
  } catch (e) {
    console.error('Layoff counts could not be loaded', e)
    return null
  }
}
