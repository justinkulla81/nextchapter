import 'server-only'
// What the cohorts a person fits have posted: the candidate side of Talent Hub cohorts. Three organizations, 50 cohorts and at most
// 2 updates each; the match uses the person's own coarse fields and never leaves this function.

import { prisma } from '@/lib/prisma'
import { cohortMatches, ruleLine } from './talent-cohorts'

export type CohortUpdate = { id: string; body: string; org: string; cohort: string; why: string; at: Date }

const WEEK = 7 * 86_400_000

export async function cohortUpdatesFor(
  candidateId: string,
  p: { industry: string | null; function: string | null; level: string | null; years: number | null; journey: string | null; journeyStage: string | null; journeyChangedAt: Date | null },
): Promise<CohortUpdate[]> {
  const memberships = await prisma.institutionMember.findMany({
    where: { candidateId, status: { in: ['CLAIMED', 'ACTIVE'] }, institution: { orgType: { not: 'COLLEGE' } } },
    take: 3,
    select: { institutionId: true, institution: { select: { name: true, programBrandName: true } } },
  })
  if (memberships.length === 0) return []
  const weeksOut = p.journey === 'LAID_OFF' && p.journeyStage !== 'LANDED' && p.journeyChangedAt ? Math.floor((Date.now() - p.journeyChangedAt.getTime()) / WEEK) : null
  const cohorts = await prisma.talentCohort.findMany({
    where: { institutionId: { in: memberships.map((m) => m.institutionId) }, posts: { some: {} } },
    take: 50,
    select: { id: true, name: true, institutionId: true, industries: true, functions: true, levels: true, minWeeksOut: true, posts: { orderBy: { createdAt: 'desc' }, take: 2, select: { id: true, body: true, createdAt: true } } },
  })
  const orgOf = new Map(memberships.map((m) => [m.institutionId, m.institution.programBrandName ?? m.institution.name]))
  return cohorts
    .filter((c) => cohortMatches(c, { industry: p.industry, function: p.function, level: p.level, years: p.years, weeksOut }))
    .flatMap((c) => c.posts.map((post) => ({ id: post.id, body: post.body, org: orgOf.get(c.institutionId) ?? 'Your program', cohort: c.name, why: ruleLine(c), at: post.createdAt })))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 3)
}
