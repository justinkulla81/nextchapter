import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withStatementTimeout } from '@/lib/db/statement-timeout'
import { liveBoardWhere } from '@/lib/jobs/board-shortlist'
import { FRESH_HOURS } from '@/lib/jobs/competition'
import { readBoardFigure } from '@/lib/jobs/stored-board-figures'
import { boardLightRowsReady, mirrorCanAnswer } from '@/lib/jobs/board-light-rows'

/** The nav badge and Home prompt show "99+" past this. */
export const FRESH_PEEK_COUNT_CAP = 99
const FRESH_PEEK_SHOW = 3
/** The few newest rows the Home prompt shows: an indexed backwards walk of createdAt that stops after three (11 ms for the rarest function). */
const BADGE_STATEMENT_MS = 5_000
/**
 * The one grouped count for every function. It reads the ~57,000 jobs imported in 72 h once (5.4 s on a cold cache, 2026-11-07), not
 * once per function, and the result is shared for five minutes. The page never waits for it past the badge deadline, so it gets room.
 */
const GROUPED_STATEMENT_MS = 20_000

// Neither read may use Prisma's `count({ take })`: that adds ORDER BY id, so for a function with few new jobs Postgres walks the primary key
// of the whole job table (a 119 s query seen 2026-11-07, 26 s on average) instead of the createdAt index. Counts come from one grouped
// query; the rows shown come from a short, ordered read.

const functionsOf = (primaryFunction: string | null, secondaryFunction: string | null) =>
  [...new Set([primaryFunction, secondaryFunction].map((f) => f?.trim()).filter((f): f is string => !!f))].sort()

/**
 * A quick look at new jobs: open board jobs imported in the last 72 hours in the member's
 * own function(s), newest first. One small indexed query (createdAt) — it never loads or
 * ranks the whole board, so it's safe on every page. The full, ranked list is the Jobs
 * board; this is only "something new is there". Any error reads as "nothing new".
 */
export const getFreshJobsPeek = cache(
  // Primitive arguments, so React's cache() dedupes the layout badge and the Home prompt.
  async (primaryFunction: string | null, secondaryFunction: string | null) => {
    const functions = functionsOf(primaryFunction, secondaryFunction)
    if (functions.length === 0) return { count: 0, top: [] }
    const where = liveBoardWhere({
      createdAt: { gte: new Date(Date.now() - FRESH_HOURS * 3_600_000) },
      targetFunction: { in: functions },
    })
    try {
      const [count, top] = await Promise.all([
        // The shared grouped count (also behind the nav badge), so the number here and the badge agree.
        getFreshJobsCount(primaryFunction, secondaryFunction),
        withStatementTimeout(
          prisma.exclusiveJobPosting.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: FRESH_PEEK_SHOW,
            select: { id: true, title: true, companyName: true, disclosure: true, postedAt: true, createdAt: true },
          }),
          BADGE_STATEMENT_MS,
        ),
      ])
      // The count can be up to five minutes older than the rows: never show fewer than the jobs listed beside it.
      return { count: Math.max(count, top.length), top }
    } catch (error) {
      console.error('Failed to load fresh jobs peek:', error)
      return { count: 0, top: [] }
    }
  }
)

const FRESH_COUNT_TTL_SECONDS = 300

// New jobs per function for the whole site: one grouped query per five minutes (not one per function, and never one per page view).
// It throws on failure (never caches a quiet 0), so the caller decides what a miss looks like and the failure is recorded
// (lib/perf/timed.ts). Expired entries are served while the next one is read.
/** The grouped count over the last 72 hours of the open board (about 5 s cold). Run by the board-figures cron; a page only runs it when no stored row is usable. */
export async function buildFreshCountsByFunction(timeoutMs: number = GROUPED_STATEMENT_MS): Promise<Record<string, number>> {
  const where = liveBoardWhere({
    createdAt: { gte: new Date(Date.now() - FRESH_HOURS * 3_600_000) },
    targetFunction: { not: null },
  })
  // The narrow copy answers this in about 0.7 s; the wide table took 5 to 20 s. The wide table is the fallback.
  let groups: { targetFunction: string | null; _count: { _all: number } }[] | null = null
  if (mirrorCanAnswer(where) && (await boardLightRowsReady())) {
    try {
      groups = await withStatementTimeout(prisma.boardLightRow.groupBy({ by: ['targetFunction'], where: where as Prisma.BoardLightRowWhereInput, _count: { _all: true } }), timeoutMs)
    } catch (error) {
      console.error('Fresh counts: narrow copy failed, reading the wide table', error)
    }
  }
  groups ??= await withStatementTimeout(prisma.exclusiveJobPosting.groupBy({ by: ['targetFunction'], where, _count: { _all: true } }), timeoutMs)
  const counts: Record<string, number> = {}
  for (const g of groups) if (g.targetFunction) counts[g.targetFunction] = g._count._all
  return counts
}

/** A stored count older than this is not trusted (the cron runs twice a day): the live grouped count answers instead. */
const STORED_MAX_AGE_MS = 24 * 3_600_000

// The cron (board-figures) stores the counts, so a cold server instance or an expired cache is one primary-key read, not a 5 s scan that
// the 1.5 s badge deadline gives up on (the "slow pages" alerts of 2026-11-08 and -09). The live query is the fallback only.
async function readStoredCounts(): Promise<Record<string, number> | null> {
  try {
    const stored = await readBoardFigure<{ at: number; counts: Record<string, number> }>('fresh-job-counts')
    if (!stored || typeof stored.at !== 'number' || Date.now() - stored.at > STORED_MAX_AGE_MS) return null
    return stored.counts
  } catch {
    return null
  }
}

const cachedFreshCountsByFunction = unstable_cache(
  async (): Promise<Record<string, number>> => (await readStoredCounts()) ?? buildFreshCountsByFunction(),
  ['fresh-jobs-counts-v2'],
  { revalidate: FRESH_COUNT_TTL_SECONDS }
)

// A failed read is never cached as a quiet 0, so without this every page view re-ran the slow query while the database was struggling,
// and each retry held a connection. A failure is remembered for a minute (per server instance) and answered at once with the same error,
// so the miss is still recorded (lib/perf/timed.ts) but the database is left alone.
const FAILURE_MEMO_MS = 60_000
const MEMO_KEY = 'grouped'
const failures = new Map<string, { at: number; error: unknown }>()

/** The nav badge's count of new jobs in the member's function(s), from the shared five-minute grouped count; throws if the database does not answer. */
export async function getFreshJobsCount(primaryFunction: string | null, secondaryFunction: string | null, now: number = Date.now()): Promise<number> {
  const functions = functionsOf(primaryFunction, secondaryFunction)
  if (functions.length === 0) return 0
  const failed = failures.get(MEMO_KEY)
  if (failed && now - failed.at < FAILURE_MEMO_MS) throw failed.error
  try {
    const counts = await cachedFreshCountsByFunction()
    failures.delete(MEMO_KEY)
    return Math.min(
      functions.reduce((sum, f) => sum + (counts[f] ?? 0), 0),
      FRESH_PEEK_COUNT_CAP,
    )
  } catch (error) {
    failures.set(MEMO_KEY, { at: now, error })
    throw error
  }
}

/** For tests: forget remembered failures. */
export function resetFreshJobsFailureMemo(): void {
  failures.clear()
}
