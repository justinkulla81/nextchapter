import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { isInternshipJob } from '@/lib/jobs/work-type'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'
import { subFunctionFor } from '@/lib/jobs/sub-functions'
import { aggregateStats, PRIOR_DAYS, RECENT_DAYS, type StatInput } from '@/lib/market/market-size'

const PAGE = 10_000
const WRITE_CHUNK = 2_000

/**
 * Rebuilds MarketTargetStat (market-size.ts) from the board: live jobs plus jobs archived in
 * the trend windows, read in id-ordered pages of narrow columns, aggregated in memory, then
 * swapped in one transaction. Deterministic; no API call. Nightly (cron market-size).
 */
export async function rebuildMarketTargetStats(now = new Date()): Promise<{ rowsRead: number; statsWritten: number; ms: number }> {
  const started = Date.now()
  const since = new Date(now.getTime() - (RECENT_DAYS + PRIOR_DAYS) * 86_400_000)
  const inputs: StatInput[] = []
  const buckets = new Map<string, string | null>()
  let lo = ''
  let read = 0
  for (;;) {
    const rows = await prisma.$queryRaw<
      {
        id: string
        title: string
        targetFunction: string | null
        subFunction: string | null
        level: string | null
        industry: string | null
        location: string | null
        locationState: string | null
        workArrangement: string | null
        employmentType: string | null
        postedAt: Date | null
        createdAt: Date
        archivedAt: Date | null
        closeReason: string | null
      }[]
    >`
      SELECT "id", "title", "targetFunction", "subFunction", "level", "industry", "location", "locationState",
             "workArrangement", "employmentType", "postedAt", "createdAt", "archivedAt", "closeReason"
      FROM "ExclusiveJobPosting"
      WHERE "id" > ${lo} AND "status" = 'approved' AND "institutionScopeId" IS NULL
        AND ("archivedAt" IS NULL OR "archivedAt" >= ${since})
      ORDER BY "id" LIMIT ${PAGE}`
    if (rows.length === 0) break
    lo = rows[rows.length - 1].id
    read += rows.length
    for (const r of rows) {
      if (isInternshipJob(r)) continue
      const fn = r.targetFunction ?? inferFunctionFromTitle(r.title)
      let bucket = r.industry ? buckets.get(r.industry) : null
      if (r.industry && bucket === undefined) buckets.set(r.industry, (bucket = normalizeIndustryBucket(r.industry)))
      inputs.push({
        title: r.title,
        fn,
        subFunction: r.subFunction ?? subFunctionFor({ title: r.title, fn }),
        level: r.level,
        industryBucket: bucket && bucket !== 'Other' ? bucket : null,
        location: r.location,
        locationState: r.locationState,
        workArrangement: r.workArrangement,
        postedAt: r.postedAt,
        createdAt: r.createdAt,
        archivedAt: r.archivedAt,
        closeReason: r.closeReason,
      })
    }
  }
  const stats = aggregateStats(inputs, now)
  const computedAt = new Date()
  await prisma.$transaction(
    async (tx) => {
      await tx.marketTargetStat.deleteMany({})
      for (let i = 0; i < stats.length; i += WRITE_CHUNK) {
        await tx.marketTargetStat.createMany({ data: stats.slice(i, i + WRITE_CHUNK).map((s) => ({ ...s, computedAt })) })
      }
    },
    { timeout: 120_000 }
  )
  return { rowsRead: read, statsWritten: stats.length, ms: Date.now() - started }
}
