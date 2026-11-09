import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import type { BoardRow } from '@/lib/segments/types'

// The one whole-board read behind the segment lists. It runs only in the weekly job (/api/cron/job-segments), never on a page
// view. The board is read once through a cursor, 20,000 rows at a time, and each row is sorted into segments in memory (defs.ts).
//
// It used to read `ORDER BY id LIMIT 20000` pages with `id > after`. Postgres plans that as an index scan plus a sort of every live
// row for each page (the id bound is only a filter), so the job did the whole scan about 30 times and its time grew with the board:
// 183 s, 231 s, 301 s, then 651 s (2026-11-03 to 11-09), and the Sunday runs were cut off. A cursor reads the board one time.

const PAGE = 20_000
const WHERE = Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} AND "locationState" IS NOT NULL`

interface Raw {
  id: string; title: string; company: string; companyId: string | null; st: string | null; city: string | null; level: string | null
  payMin: number | null; payMax: number | null; payPeriod: string | null; currency: string | null
  postedAt: Date | null; createdAt: Date; industry: string | null; reqTags: string | null; postingType: string | null; sourceCategory: string | null; skills: string[]; noExp: string | null; soc: string | null; socCode: string | null; sector: string | null
}

const COLUMNS = Prisma.sql`id, title, "companyName" AS company, "companyId", "locationState" AS st, "locationCity" AS city, level,
        "salaryMin" AS "payMin", "salaryMax" AS "payMax", "payPeriod", "salaryCurrency" AS currency, "postedAt", "createdAt",
        industry, "requirementTags" AS "reqTags", "postingType", "sourceCategory", skills, "noExperiencePhrase" AS "noExp", "socTitle" AS soc, "socCode", "employerSector" AS sector`

const toRow = (r: Raw): BoardRow => ({
  id: r.id, title: r.title, company: r.company, companyId: r.companyId, st: r.st, city: r.city, level: r.level,
  payMin: r.payMin, payMax: r.payMax, payPeriod: r.payPeriod, currency: r.currency,
  postedAt: r.postedAt ? r.postedAt.toISOString() : null, createdAt: r.createdAt.toISOString(),
  industry: r.industry, reqTags: r.reqTags, postingType: r.postingType, sourceCategory: r.sourceCategory, skills: r.skills ?? [], noExperience: !!r.noExp, soc: r.soc, socCode: r.socCode, sector: r.sector,
})

/** A cursor cannot take bound parameters, so the query's numeric constants (the verified and ghost-age day counts) are written in. */
function inline(query: Prisma.Sql): string {
  return query.text.replace(/\$(\d+)/g, (_, i: string) => {
    const value = query.values[Number(i) - 1]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('scanBoard: the cursor query takes numeric constants only')
    return String(value)
  })
}

async function page(after: string): Promise<Raw[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '300s'`)
    return tx.$queryRaw<Raw[]>`
      SELECT ${COLUMNS}
      FROM "ExclusiveJobPosting" ${WHERE} AND id > ${after}
      ORDER BY id LIMIT ${PAGE}`
  }, { timeout: 320_000, maxWait: 30_000 })
}

/** The old way: pages in key order, each a fresh scan. Kept as the fallback if the cursor cannot start. */
async function scanPaged(visit: (rows: BoardRow[]) => void): Promise<number> {
  let after = ''
  let total = 0
  for (;;) {
    const raw = await page(after)
    if (!raw.length) break
    visit(raw.map(toRow))
    total += raw.length
    after = raw[raw.length - 1].id
    if (raw.length < PAGE) break
  }
  return total
}

/** Calls `visit` with each page of live rows, so the caller never holds the whole board's rows at once beyond what it keeps. */
export async function scanBoard(visit: (rows: BoardRow[]) => void): Promise<number> {
  let visited = false
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`)
      await tx.$executeRawUnsafe(`DECLARE board_scan NO SCROLL CURSOR FOR SELECT ${inline(Prisma.sql`${COLUMNS} FROM "ExclusiveJobPosting" ${WHERE}`)}`)
      let total = 0
      for (;;) {
        const raw = await tx.$queryRawUnsafe<Raw[]>(`FETCH ${PAGE} FROM board_scan`)
        if (!raw.length) break
        visited = true
        visit(raw.map(toRow))
        total += raw.length
        if (raw.length < PAGE) break
      }
      await tx.$executeRawUnsafe(`CLOSE board_scan`)
      return total
    }, { timeout: 750_000, maxWait: 30_000 })
  } catch (error) {
    // Rows already handed to `visit` cannot be taken back, so only a cursor that never started falls back to the pages.
    if (visited) throw error
    console.error('segment scan: the cursor could not read the board, reading it in pages', error)
    return scanPaged(visit)
  }
}
