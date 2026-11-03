import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import type { BoardRow } from '@/lib/segments/types'

// The one whole-board read behind the segment lists. It runs only in the weekly job (/api/cron/job-segments), never on a page
// view. The board is read in key order, 20,000 rows at a time, and each row is sorted into segments in memory (defs.ts).

const PAGE = 20_000
const WHERE = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND "locationState" IS NOT NULL`

interface Raw {
  id: string; title: string; company: string; companyId: string | null; st: string | null; city: string | null; level: string | null
  payMin: number | null; payMax: number | null; payPeriod: string | null; currency: string | null
  postedAt: Date | null; createdAt: Date; industry: string | null; reqTags: string | null; postingType: string | null; sourceCategory: string | null; skills: string[]; noExp: string | null; soc: string | null
}

async function page(after: string): Promise<Raw[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '300s'`)
    return tx.$queryRaw<Raw[]>`
      SELECT id, title, "companyName" AS company, "companyId", "locationState" AS st, "locationCity" AS city, level,
        "salaryMin" AS "payMin", "salaryMax" AS "payMax", "payPeriod", "salaryCurrency" AS currency, "postedAt", "createdAt",
        industry, "requirementTags" AS "reqTags", "postingType", "sourceCategory", skills, "noExperiencePhrase" AS "noExp", "socTitle" AS soc
      FROM "ExclusiveJobPosting" ${WHERE} AND id > ${after}
      ORDER BY id LIMIT ${PAGE}`
  }, { timeout: 320_000, maxWait: 30_000 })
}

/** Calls `visit` with each page of live rows, so the caller never holds the whole board's rows at once beyond what it keeps. */
export async function scanBoard(visit: (rows: BoardRow[]) => void): Promise<number> {
  let after = ''
  let total = 0
  for (;;) {
    const raw = await page(after)
    if (!raw.length) break
    visit(raw.map((r) => ({
      id: r.id, title: r.title, company: r.company, companyId: r.companyId, st: r.st, city: r.city, level: r.level,
      payMin: r.payMin, payMax: r.payMax, payPeriod: r.payPeriod, currency: r.currency,
      postedAt: r.postedAt ? r.postedAt.toISOString() : null, createdAt: r.createdAt.toISOString(),
      industry: r.industry, reqTags: r.reqTags, postingType: r.postingType, sourceCategory: r.sourceCategory, skills: r.skills ?? [], noExperience: !!r.noExp, soc: r.soc,
    })))
    total += raw.length
    after = raw[raw.length - 1].id
    if (raw.length < PAGE) break
  }
  return total
}
