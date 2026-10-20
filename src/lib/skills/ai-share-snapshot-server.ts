import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { isInternshipJob } from '@/lib/jobs/work-type'
import { countAiShare, mondayOf, type SnapshotPosting } from '@/lib/skills/ai-share-snapshot'

const PAGE = 10_000

/**
 * Counts the live board (same population as the market-size stats: approved, not archived, not
 * a college-scoped listing, internships left out) and upserts this week's rows. Rerun-safe: the
 * unique (weekOf, fn) key means a second run the same week overwrites the first.
 */
export async function recordAiShareSnapshot(now = new Date()): Promise<{ rowsRead: number; rowsWritten: number; weekOf: string; ms: number }> {
  const started = Date.now()
  const postings: SnapshotPosting[] = []
  let lo = ''
  for (;;) {
    const rows = await prisma.$queryRaw<
      { id: string; title: string; targetFunction: string | null; aiSkillGroups: string[] | null; workArrangement: string | null; employmentType: string | null }[]
    >`
      SELECT "id", "title", "targetFunction", "aiSkillGroups", "workArrangement", "employmentType"
      FROM "ExclusiveJobPosting"
      WHERE "id" > ${lo} AND "status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL
      ORDER BY "id" LIMIT ${PAGE}`
    if (rows.length === 0) break
    lo = rows[rows.length - 1].id
    for (const r of rows) {
      if (isInternshipJob(r)) continue
      postings.push({ fn: r.targetFunction ?? inferFunctionFromTitle(r.title), aiSkillGroups: r.aiSkillGroups })
    }
  }
  const counts = countAiShare(postings)
  const weekOf = mondayOf(now)
  for (const c of counts) {
    await prisma.aiShareSnapshot.upsert({
      where: { weekOf_fn: { weekOf, fn: c.fn } },
      create: { weekOf, fn: c.fn, total: c.total, withAi: c.withAi },
      update: { total: c.total, withAi: c.withAi },
    })
  }
  return { rowsRead: postings.length, rowsWritten: counts.length, weekOf: weekOf.toISOString().slice(0, 10), ms: Date.now() - started }
}
