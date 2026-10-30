import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { heavy } from '@/lib/db/heavy'

export interface LagRow {
  state: string
  notices: number
  /** Median days from the filing date to the day we first stored the notice. */
  medianDays: number
  p90Days: number
  /** Share collected within one day of the filing date. */
  withinOneDay: number
}

/**
 * How long a filing is on file before it reaches our record, by state, over the last 90 days of filings. This is filing date to
 * our collection date, so it includes any delay at the state; it cannot split "state published late" from "we collected late",
 * because we do not store when a state posted a notice. It is the number we could honestly quote ("on our site a median of N
 * days after the filing date"), and the one to improve by syncing a state more than once a day.
 */
export async function loadLagByState(): Promise<LagRow[]> {
  const rows = await heavy(() => prisma.$queryRaw<{ state: string; n: bigint; median: number; p90: number; within1: number }[]>(Prisma.sql`
    SELECT state,
           COUNT(*) AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY lag) AS median,
           percentile_cont(0.9) WITHIN GROUP (ORDER BY lag) AS p90,
           AVG(CASE WHEN lag <= 1 THEN 1.0 ELSE 0.0 END) AS within1
    FROM (
      SELECT state, GREATEST(0, ("fetchedAt"::date - "noticeDate"::date))::float AS lag
      FROM "WarnNotice"
      WHERE source = 'WARN_FILING' AND "dismissedAt" IS NULL AND state IS NOT NULL
        AND "noticeDate" IS NOT NULL AND "noticeDate" >= now() - interval '90 days' AND "noticeDate" <= now()
    ) t
    GROUP BY state
    HAVING COUNT(*) >= 3
    ORDER BY median ASC, n DESC
  `))
  return rows.map((r) => ({ state: r.state, notices: Number(r.n), medianDays: Number(r.median), p90Days: Number(r.p90), withinOneDay: Number(r.within1) }))
}
