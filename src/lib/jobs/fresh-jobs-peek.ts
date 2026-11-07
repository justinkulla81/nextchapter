import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withStatementTimeout } from '@/lib/db/statement-timeout'
import { liveBoardWhere } from '@/lib/jobs/board-shortlist'
import { FRESH_HOURS } from '@/lib/jobs/competition'

/** The nav badge and Home prompt show "99+" past this. */
export const FRESH_PEEK_COUNT_CAP = 99
const FRESH_PEEK_SHOW = 3
/** A decoration read gets this long in the database, not the two-minute default. A rare function (about 150 new jobs among 60,000 in 72 h) takes ~2.4 s on a cold cache; the page itself stops waiting at 1.5 s and the result fills the shared cache. */
const BADGE_STATEMENT_MS = 5_000

// Both reads below fetch at most FRESH_PEEK_COUNT_CAP + 1 rows with a plain LIMIT and count them here. They must NOT use Prisma's
// `count({ take })`: that adds ORDER BY id, so for a function with few new jobs Postgres walks the primary key of the whole job table
// (a 119 s query seen 2026-11-07, 26 s on average) instead of the createdAt index (49 ms on the same data).

/**
 * A quick look at new jobs: open board jobs imported in the last 72 hours in the member's
 * own function(s), newest first. One small indexed query (createdAt) — it never loads or
 * ranks the whole board, so it's safe on every page. The full, ranked list is the Jobs
 * board; this is only "something new is there". Any error reads as "nothing new".
 */
export const getFreshJobsPeek = cache(
  // Primitive arguments, so React's cache() dedupes the layout badge and the Home prompt.
  async (primaryFunction: string | null, secondaryFunction: string | null) => {
    const functions = [...new Set([primaryFunction, secondaryFunction].map((f) => f?.trim()).filter((f): f is string => !!f))]
    if (functions.length === 0) return { count: 0, top: [] }
    const where = liveBoardWhere({
      createdAt: { gte: new Date(Date.now() - FRESH_HOURS * 3_600_000) },
      targetFunction: { in: functions },
    })
    try {
      // One query for both: the newest rows up to the cap. The first few are shown, and how many came back is the count.
      const rows = await withStatementTimeout(
        prisma.exclusiveJobPosting.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: FRESH_PEEK_COUNT_CAP + 1,
          select: { id: true, title: true, companyName: true, disclosure: true, postedAt: true, createdAt: true },
        }),
        BADGE_STATEMENT_MS,
      )
      return { count: Math.min(rows.length, FRESH_PEEK_COUNT_CAP), top: rows.slice(0, FRESH_PEEK_SHOW) }
    } catch (error) {
      console.error('Failed to load fresh jobs peek:', error)
      return { count: 0, top: [] }
    }
  }
)

const FRESH_COUNT_TTL_SECONDS = 300

const functionsOf = (primaryFunction: string | null, secondaryFunction: string | null) =>
  [...new Set([primaryFunction, secondaryFunction].map((f) => f?.trim()).filter((f): f is string => !!f))].sort()

// The same number for everyone with the same function(s): one query per function per five minutes for the
// whole site, not one per page view. It throws on failure (never caches a quiet 0), so the caller decides what
// a miss looks like and the failure is recorded (lib/perf/timed.ts).
const cachedFreshCount = unstable_cache(
  async (functions: string[]): Promise<number> => {
    if (functions.length === 0) return 0
    const where = liveBoardWhere({
      createdAt: { gte: new Date(Date.now() - FRESH_HOURS * 3_600_000) },
      targetFunction: { in: functions },
    })
    const rows = await withStatementTimeout(prisma.exclusiveJobPosting.findMany({ where, select: { id: true }, take: FRESH_PEEK_COUNT_CAP + 1 }), BADGE_STATEMENT_MS)
    return Math.min(rows.length, FRESH_PEEK_COUNT_CAP)
  },
  ['fresh-jobs-count-v1'],
  { revalidate: FRESH_COUNT_TTL_SECONDS }
)

// A failed read is never cached as a quiet 0, so without this every page view re-ran the slow query while the database was struggling,
// and each retry held a connection. A failure is remembered for a minute (per server instance) and answered at once with the same error,
// so the miss is still recorded (lib/perf/timed.ts) but the database is left alone.
const FAILURE_MEMO_MS = 60_000
const failures = new Map<string, { at: number; error: unknown }>()

/** The nav badge's count of new jobs in the member's function(s). Cached five minutes per function; throws if the database does not answer. */
export async function getFreshJobsCount(primaryFunction: string | null, secondaryFunction: string | null, now: number = Date.now()): Promise<number> {
  const functions = functionsOf(primaryFunction, secondaryFunction)
  const key = functions.join('|')
  const failed = failures.get(key)
  if (failed && now - failed.at < FAILURE_MEMO_MS) throw failed.error
  try {
    const count = await cachedFreshCount(functions)
    failures.delete(key)
    return count
  } catch (error) {
    if (failures.size > 200) failures.clear()
    failures.set(key, { at: now, error })
    throw error
  }
}

/** For tests: forget remembered failures. */
export function resetFreshJobsFailureMemo(): void {
  failures.clear()
}
