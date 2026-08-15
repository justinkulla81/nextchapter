import 'server-only'
import { prisma } from '@/lib/prisma'

// Admin-only company page data (Phase 2 Master Script, Part C, Prompt 6) —
// member concentration, demand signal, and intel health. Deliberately
// separate from src/lib/companies/nervous-employee-panel.ts, which owns the
// one sensitive metric on this page (currently-searching count) and its own
// heavier guardrails. Nothing in this file needs a minimum-cell-size
// check: "worked here" / "current employer" counts don't reveal search
// status — the candidate-facing company page already shows an unsuppressed
// insider count for the same underlying population (see
// src/app/dashboard/companies/[id]/page.tsx's "N members worked here").

// ── Member concentration ────────────────────────────────────────────────

export interface BreakdownRow {
  label: string
  count: number
}

export interface MemberConcentration {
  totalEverWorkedHere: number
  currentEmployerCount: number
  byFunction: BreakdownRow[]
  bySeniority: BreakdownRow[]
}

function tally(values: (string | null)[]): BreakdownRow[] {
  const map = new Map<string, number>()
  for (const v of values) {
    const key = v ?? 'Unknown'
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getMemberConcentration(companyId: string): Promise<MemberConcentration> {
  const rows = await prisma.memberEmployment.findMany({
    where: { companyId },
    select: { isCurrent: true, function: true, seniorityBand: true },
  })

  return {
    totalEverWorkedHere: rows.length,
    currentEmployerCount: rows.filter((r) => r.isCurrent).length,
    byFunction: tally(rows.map((r) => r.function)),
    bySeniority: tally(rows.map((r) => r.seniorityBand)),
  }
}

// ── Demand signal ────────────────────────────────────────────────────────

export interface DemandSignal {
  latestOutcome: { applications: number; responses: number; interviews: number; offers: number; weekStartDate: Date } | null
  targetCount: number // distinct members who've named this company as a watchlist/target employer
  targetRank: number | null // 1-indexed rank among all named-target companies; null if nobody targets this company
  totalNamedTargetCompanies: number
}

// CompanyWatchlistEntry is unique on [candidateId, companyNameNormalized],
// so a per-companyNameNormalized row count IS already the distinct-member
// count — no separate distinct-candidate query needed.
export async function getDemandSignal(companyId: string, canonicalNameNormalized: string): Promise<DemandSignal> {
  const [latestOutcome, watchlistGrouped] = await Promise.all([
    prisma.companyApplicationOutcome.findFirst({ where: { companyId }, orderBy: { weekStartDate: 'desc' } }),
    prisma.companyWatchlistEntry.groupBy({ by: ['companyNameNormalized'], _count: { candidateId: true } }),
  ])

  const ranked = watchlistGrouped
    .map((g) => ({ companyNameNormalized: g.companyNameNormalized, count: g._count.candidateId }))
    .sort((a, b) => b.count - a.count)

  const idx = ranked.findIndex((r) => r.companyNameNormalized === canonicalNameNormalized)

  return {
    latestOutcome: latestOutcome
      ? {
          applications: latestOutcome.applications,
          responses: latestOutcome.responses,
          interviews: latestOutcome.interviews,
          offers: latestOutcome.offers,
          weekStartDate: latestOutcome.weekStartDate,
        }
      : null,
    targetCount: idx >= 0 ? ranked[idx].count : 0,
    targetRank: idx >= 0 ? idx + 1 : null,
    totalNamedTargetCompanies: ranked.length,
  }
}

// ── Intel health ─────────────────────────────────────────────────────────

export interface IntelHealth {
  totalSubmitted: number
  published: number
  pending: number
  removed: number
  helpfulVotesTotal: number
  helpfulRatePct: number | null // % of published intel with >=1 helpful vote; null if nothing published yet
  hasCoverageGap: boolean // named as a target by at least one member, but zero published intel
}

export async function getIntelHealth(companyId: string, targetCount: number): Promise<IntelHealth> {
  const rows = await prisma.companyIntel.findMany({ where: { companyId }, select: { status: true, helpfulCount: true } })

  const published = rows.filter((r) => r.status === 'published')
  const publishedWithHelpful = published.filter((r) => r.helpfulCount > 0).length

  return {
    totalSubmitted: rows.length,
    published: published.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    removed: rows.filter((r) => r.status === 'removed').length,
    helpfulVotesTotal: rows.reduce((sum, r) => sum + r.helpfulCount, 0),
    helpfulRatePct: published.length > 0 ? Math.round((publishedWithHelpful / published.length) * 100) : null,
    hasCoverageGap: targetCount > 0 && published.length === 0,
  }
}

// ── Sitewide intel coverage gaps ────────────────────────────────────────
// A cross-company report (not scoped to one company page) for the admin
// company list — named-target companies with zero published intel, ranked
// by how many members are targeting them. Deliberately excludes companies
// with real applicant interest but no watchlist entries and no Company row
// at all, same "only cross-reference real Company rows" scoping as
// application-outcomes.ts.
export interface CoverageGapCompany {
  companyId: string
  companyName: string
  targetCount: number
}

export async function listIntelCoverageGaps(limit = 20): Promise<CoverageGapCompany[]> {
  const [watchlistGrouped, companies] = await Promise.all([
    prisma.companyWatchlistEntry.groupBy({ by: ['companyNameNormalized'], _count: { candidateId: true } }),
    prisma.company.findMany({ select: { id: true, name: true, canonicalNameNormalized: true } }),
  ])

  const companyByNorm = new Map(companies.map((c) => [c.canonicalNameNormalized, c]))
  const targetsWithCompany = watchlistGrouped
    .map((g) => ({ count: g._count.candidateId, company: companyByNorm.get(g.companyNameNormalized) }))
    .filter((t): t is { count: number; company: NonNullable<typeof t.company> } => !!t.company)
    .sort((a, b) => b.count - a.count)

  if (targetsWithCompany.length === 0) return []

  const companyIds = targetsWithCompany.map((t) => t.company.id)
  const publishedIntelCounts = await prisma.companyIntel.groupBy({
    by: ['companyId'],
    where: { companyId: { in: companyIds }, status: 'published' },
    _count: { id: true },
  })
  const publishedByCompany = new Map(publishedIntelCounts.map((p) => [p.companyId, p._count.id]))

  return targetsWithCompany
    .filter((t) => (publishedByCompany.get(t.company.id) ?? 0) === 0)
    .slice(0, limit)
    .map((t) => ({ companyId: t.company.id, companyName: t.company.name, targetCount: t.count }))
}
