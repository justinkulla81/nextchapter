import 'server-only'
import { prisma } from '@/lib/prisma'
import { employerCandidateAggregates, EMPLOYER_MIN_CELL_SIZE } from '@/lib/employer/candidate-identity-guard'
import { orgCandidateIds, resolveScope, type CohortScope } from '@/lib/employer/outplacement-reporting'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { GROWTH_MEASURES, growthRows, type GrowthRow } from '@/lib/employer/career-growth-metrics'

export interface CareerGrowthActivity {
  scope: CohortScope
  population: number
  hasEnoughData: boolean
  rows: GrowthRow[]
}

// Aggregate activity for a career growth cohort. Counts only, through the same
// identity guard as every employer number (candidate-identity-guard.ts); the id
// list is a WHERE filter and never leaves this function.
export async function getCareerGrowthActivity(orgUser: CurrentOutplacementOrgUser, contractId: string): Promise<CareerGrowthActivity | null> {
  const scope = await resolveScope(orgUser, contractId)
  if (!scope) return null
  const ids = await orgCandidateIds(contractId, scope.asOf)
  const population = ids.length
  if (population < EMPLOYER_MIN_CELL_SIZE) return { scope, population, hasEnoughData: false, rows: [] }

  const thirtyDaysAgo = new Date(scope.asOf.getTime() - 30 * 86_400_000)
  const [measureCounts, active] = await Promise.all([
    Promise.all(GROWTH_MEASURES.map((m) => employerCandidateAggregates.count({ where: { id: { in: ids }, ...m.where } }))),
    // The group key is a candidate id, so only the number of groups is used, never the keys.
    prisma.candidateLoginEvent.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids }, createdAt: { gte: thirtyDaysAgo, lte: scope.asOf } } }),
  ])
  const counts = { active: active.length, ...Object.fromEntries(GROWTH_MEASURES.map((m, i) => [m.key, measureCounts[i]])) }
  const labels = { active: 'Signed in, last 30 days', ...Object.fromEntries(GROWTH_MEASURES.map((m) => [m.key, m.label])) }
  return { scope, population, hasEnoughData: true, rows: growthRows(population, counts, labels) }
}
