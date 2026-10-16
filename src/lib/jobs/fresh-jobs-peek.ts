import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { liveBoardWhere } from '@/lib/jobs/board-shortlist'
import { FRESH_HOURS } from '@/lib/jobs/competition'

/** The nav badge and Home prompt show "99+" past this. */
export const FRESH_PEEK_COUNT_CAP = 99
const FRESH_PEEK_SHOW = 3

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
      audienceTier: 'ALL_CANDIDATES',
    })
    try {
      const [count, top] = await Promise.all([
        prisma.exclusiveJobPosting.count({ where, take: FRESH_PEEK_COUNT_CAP + 1 }).catch(() => 0),
        prisma.exclusiveJobPosting.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: FRESH_PEEK_SHOW,
          select: { id: true, title: true, companyName: true, disclosure: true, postedAt: true, createdAt: true },
        }),
      ])
      return { count: Math.min(count, FRESH_PEEK_COUNT_CAP), top }
    } catch (error) {
      console.error('Failed to load fresh jobs peek:', error)
      return { count: 0, top: [] }
    }
  }
)
