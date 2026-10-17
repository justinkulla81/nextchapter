import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { closeArchivedOpenings } from '@/lib/companies/job-openings'

// Writes for the liveness system (liveness.ts, ncrawl/liveness.py): archive postings
// found dead (closeReason 'expired_checked'), stamp lastVerifiedAt on ones found live,
// and point a still-live aggregator job at its new link. Only feed rows (source
// 'ats_feed': the crawler import and the ATS feed cron) are ever archived this way —
// a job an employer or recruiter posted on NextChapter is theirs to close.

export async function archiveDeadPostings(where: { ids?: string[]; urls?: string[] }, now: Date = new Date()): Promise<number> {
  const or: Prisma.ExclusiveJobPostingWhereInput[] = []
  if (where.ids?.length) or.push({ id: { in: where.ids } })
  if (where.urls?.length) or.push({ url: { in: where.urls } })
  if (or.length === 0) return 0
  const r = await prisma.exclusiveJobPosting.updateMany({
    where: { OR: or, archivedAt: null, source: 'ats_feed' },
    data: { archivedAt: now, closeReason: 'expired_checked', lastVerifiedAt: now },
  })
  return r.count
}

/** Company job history follows the board (best-effort; the nightly index repairs it too). */
export async function closeOpeningsQuietly() {
  try {
    await closeArchivedOpenings()
  } catch (error) {
    console.error('liveness: could not close archived openings', error)
  }
}

/** lastVerifiedAt = the later of what we hold and `at`, per url. */
export async function stampVerified(rows: { url: string; at: Date }[]): Promise<number> {
  const clean = rows.filter((r) => r.url && !Number.isNaN(r.at.getTime()))
  let n = 0
  for (let i = 0; i < clean.length; i += 1000) {
    const chunk = clean.slice(i, i + 1000)
    n += await prisma.$executeRaw`
      UPDATE "ExclusiveJobPosting" p
      SET "lastVerifiedAt" = v.at
      FROM unnest(${chunk.map((r) => r.url)}::text[], ${chunk.map((r) => r.at.toISOString())}::timestamptz[]) AS v(url, at)
      WHERE p.url = v.url AND (p."lastVerifiedAt" IS NULL OR p."lastVerifiedAt" < v.at)
    `
  }
  return n
}

/** A live job re-listed under a new aggregator link (Jooble re-issues ids): move the row. */
export async function moveLinks(rows: { from: string; to: string; at: Date }[]): Promise<{ moved: number; collapsed: number }> {
  let moved = 0
  let collapsed = 0
  for (const r of rows) {
    if (!r.from || !r.to || r.from === r.to) continue
    const target = await prisma.exclusiveJobPosting.findUnique({ where: { url: r.to }, select: { id: true } })
    if (target) {
      // The new link is already on the board: the old row is a second copy of it.
      const c = await prisma.exclusiveJobPosting.updateMany({
        where: { url: r.from, archivedAt: null, source: 'ats_feed' },
        data: { archivedAt: r.at, closeReason: 'duplicate' },
      })
      collapsed += c.count
      await prisma.exclusiveJobPosting.updateMany({ where: { url: r.to }, data: { lastVerifiedAt: r.at } })
    } else {
      const c = await prisma.exclusiveJobPosting.updateMany({
        where: { url: r.from, source: 'ats_feed' },
        data: { url: r.to, lastVerifiedAt: r.at },
      })
      moved += c.count
    }
  }
  return { moved, collapsed }
}

/**
 * The board's highest-traffic live crawler jobs, for the crawler's 3-hourly hot liveness
 * pass: member clicks (last 30 days, weight 3), saves (2), fresh-job alert sends (last 7
 * days, 1).
 */
export async function hotPostingUrls(limit: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ url: string }[]>`
    WITH t AS (
      SELECT "sourceId" AS id, 3 AS w FROM "JobClickEvent"
        WHERE source = 'job_board' AND "createdAt" > now() - interval '30 days'
      UNION ALL
      SELECT "sourceId", 2 FROM "TrackedJob"
        WHERE source = 'job_board' AND "savedAt" IS NOT NULL AND "dismissedAt" IS NULL
      UNION ALL
      SELECT "postingId", 1 FROM "FreshJobAlertSend" WHERE "sentAt" > now() - interval '7 days'
    )
    SELECT p.url FROM t JOIN "ExclusiveJobPosting" p ON p.id = t.id
    WHERE p."archivedAt" IS NULL AND p."addedBy" = 'ncrawl'
    GROUP BY p.url ORDER BY sum(t.w) DESC LIMIT ${limit}
  `
  return rows.map((r) => r.url)
}

/** Crawler rows archived as dead since `since` (click-time closures the crawler should copy). */
export async function closedSince(since: Date, limit = 5000): Promise<string[]> {
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: { addedBy: 'ncrawl', closeReason: 'expired_checked', archivedAt: { gte: since } },
    select: { url: true },
    take: limit,
  })
  return rows.map((r) => r.url)
}
