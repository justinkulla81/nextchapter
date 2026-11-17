import 'server-only'
import { prisma } from '@/lib/prisma'
import { heapBlockCount, heapRangeSql, heapRanges } from '@/lib/db/heap-ranges'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { isInternshipJob } from '@/lib/jobs/work-type'
import { jobIndustryBucket } from '@/lib/profile/industry-reading'
import { subFunctionFor } from '@/lib/jobs/sub-functions'
import { aggregateStats, PRIOR_DAYS, RECENT_DAYS, type StatInput } from '@/lib/market/market-size'
import { aggregateCityStats, cityOf, type CityStatInput } from '@/lib/market/city-stats'

const WRITE_CHUNK = 2_000

/**
 * Rebuilds MarketTargetStat (market-size.ts) from the board: live jobs plus jobs archived in
 * the trend windows, read a block range of the table at a time (heap-ranges.ts) in narrow columns, aggregated in memory, then
 * swapped in one transaction. Deterministic; no API call. Nightly (cron market-size).
 *
 * The ranges replace id-ordered pages of 10,000, which walked the primary key and fetched each row at random: ~1.9 s a page and the whole
 * table read several times over each pass (#41 by database time in the 2026-11-17 statement stats; the same fix as the search index and
 * job occupations, #1481). A job updated mid-pass can come back twice; only its first copy is counted.
 */
export async function rebuildMarketTargetStats(now = new Date()): Promise<{ rowsRead: number; statsWritten: number; cityStatsWritten: number; ms: number }> {
  const started = Date.now()
  const since = new Date(now.getTime() - (RECENT_DAYS + PRIOR_DAYS) * 86_400_000)
  const inputs: StatInput[] = []
  // Live jobs only, for the cities (city-stats.ts): same pass, one more narrow column.
  const cityInputs: CityStatInput[] = []
  const buckets = new Map<string, string | null>()
  let read = 0
  const seen = new Set<string>()
  for (const range of heapRanges(await heapBlockCount('ExclusiveJobPosting'))) {
    const rows = await prisma.$queryRaw<
      {
        id: string
        title: string
        targetFunction: string | null
        subFunction: string | null
        level: string | null
        industry: string | null
        location: string | null
        locationCity: string | null
        locationState: string | null
        workArrangement: string | null
        employmentType: string | null
        postedAt: Date | null
        createdAt: Date
        archivedAt: Date | null
        closeReason: string | null
      }[]
    >`
      SELECT "id", "title", "targetFunction", "subFunction", "level", "industry", "location", "locationCity", "locationState",
             "workArrangement", "employmentType", "postedAt", "createdAt", "archivedAt", "closeReason"
      FROM "ExclusiveJobPosting"
      WHERE ${heapRangeSql(range)} AND "status" = 'approved' AND "institutionScopeId" IS NULL
        AND ("archivedAt" IS NULL OR "archivedAt" >= ${since})`
    read += rows.length
    for (const r of rows) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      if (isInternshipJob(r)) continue
      const fn = r.targetFunction ?? inferFunctionFromTitle(r.title)
      let bucket = r.industry ? buckets.get(r.industry) : null
      if (r.industry && bucket === undefined) buckets.set(r.industry, (bucket = jobIndustryBucket(r.industry)))
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
      if (!r.archivedAt) cityInputs.push({ fn, level: r.level, industryBucket: bucket && bucket !== 'Other' ? bucket : null, city: cityOf(r) })
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
  // Cities are written on their own, after: a failure here (say, before the table exists) never costs the counts above.
  let cityStatsWritten = 0
  try {
    const cities = aggregateCityStats(cityInputs)
    await prisma.$transaction(
      async (tx) => {
        await tx.marketCityStat.deleteMany({})
        for (let i = 0; i < cities.length; i += WRITE_CHUNK) {
          await tx.marketCityStat.createMany({ data: cities.slice(i, i + WRITE_CHUNK).map((c) => ({ ...c, computedAt })) })
        }
      },
      { timeout: 120_000 }
    )
    cityStatsWritten = cities.length
  } catch (error) {
    console.error('Market city stats not written:', error)
  }
  return { rowsRead: read, statsWritten: stats.length, cityStatsWritten, ms: Date.now() - started }
}
