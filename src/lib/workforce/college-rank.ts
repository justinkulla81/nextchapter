import 'server-only'
import { prisma } from '@/lib/prisma'
import { boardCountyKeys } from './board-area'
import { isCompanyWide } from './board-report'
import { scoreCollege } from './college-score'

/**
 * Scores and ranks every college (see college-score.ts), writing score,
 * parts, tier and rank. Re-run weekly so the layoffs around each college
 * stay current; nothing here costs anything.
 */
export async function rankColleges(): Promise<{ ranked: number; tiers: Record<string, number> }> {
  const since = new Date(Date.now() - 365 * 86_400_000)
  const [colleges, contacts, boards, notices] = await Promise.all([
    prisma.localCollege.findMany({
      select: { id: true, state: true, countyKey: true, sector: true, carnegie: true, size: true, admitRate: true, interestSignals: true },
    }),
    prisma.collegeContact.findMany({ select: { collegeId: true, role: true, name: true, title: true, email: true } }),
    prisma.workforceBoard.findMany({ select: { id: true, state: true, counties: true, placeCounties: true, statewide: true } }),
    prisma.warnNotice.findMany({
      where: { workforceBoardId: { not: null }, dismissedAt: null, noticeDate: { gte: since } },
      select: { workforceBoardId: true, employees: true, source: true, sourceUrl: true },
    }),
  ])
  // Jobs in state filings per board — company-wide counts are not local.
  const jobsByBoard = new Map<string, number>()
  for (const n of notices) {
    if (isCompanyWide(n)) continue
    jobsByBoard.set(n.workforceBoardId!, (jobsByBoard.get(n.workforceBoardId!) ?? 0) + (n.employees ?? 0))
  }
  const boardsByState = new Map<string, typeof boards>()
  for (const b of boards) boardsByState.set(b.state, [...(boardsByState.get(b.state) ?? []), b])
  const contactsByCollege = new Map<string, typeof contacts>()
  for (const c of contacts) contactsByCollege.set(c.collegeId, [...(contactsByCollege.get(c.collegeId) ?? []), c])

  const scored = colleges.map((c) => {
    const stateBoards = boardsByState.get(c.state) ?? []
    const hasLocal = stateBoards.some((b) => !b.statewide)
    const areaJobsLost = Math.max(0, ...stateBoards
      .filter((b) => {
        const keys = boardCountyKeys(b)
        return keys === 'all' ? !hasLocal : !!c.countyKey && keys.includes(c.countyKey)
      })
      .map((b) => jobsByBoard.get(b.id) ?? 0))
    return { id: c.id, ...scoreCollege({ ...c, contacts: contactsByCollege.get(c.id) ?? [], areaJobsLost }) }
  // Tier first, so a community college held to C never ranks above a four-year B.
  }).sort((a, b) => a.tier.localeCompare(b.tier) || b.score - a.score)

  const now = new Date()
  const tiers: Record<string, number> = {}
  // One statement per 500 colleges rather than one per college.
  for (let i = 0; i < scored.length; i += 500) {
    const chunk = scored.slice(i, i + 500)
    await prisma.$executeRaw`
      UPDATE "LocalCollege" c SET "score" = v.score, "scoreParts" = v.parts::jsonb, "tier" = v.tier, "rank" = v.rank, "scoredAt" = ${now}
      FROM (SELECT unnest(${chunk.map((s) => s.id)}::text[]) AS id,
                   unnest(${chunk.map((s) => s.score)}::float8[]) AS score,
                   unnest(${chunk.map((s) => JSON.stringify(s.parts))}::text[]) AS parts,
                   unnest(${chunk.map((s) => s.tier)}::text[]) AS tier,
                   unnest(${chunk.map((_, j) => i + j + 1)}::int[]) AS rank) v
      WHERE c.id = v.id`
  }
  for (const s of scored) tiers[s.tier] = (tiers[s.tier] ?? 0) + 1
  return { ranked: scored.length, tiers }
}
