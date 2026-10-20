// What a company sees about a career growth cohort (seats for people who are
// staying and growing). Pure and client-safe. Every measure is something a
// member does to grow where they are, never a job-search signal: no references
// asked, no applications, no stage or journey, no mood. A company that could
// see who started looking would stop being a safe place to grow.

import type { Prisma } from '@prisma/client'

export const GROWTH_MEASURES = [
  { key: 'skills', label: 'Took the skills assessment', where: { skillsAssessmentCompletedAt: { not: null } } },
  { key: 'trackRecord', label: 'Wrote up their track record', where: { trackRecordCompletedAt: { not: null } } },
  { key: 'wins', label: 'Logged a work win', where: { inWorkWins: { some: {} } } },
  { key: 'prep', label: 'Prepared for a review or a growth conversation', where: { inWorkPreps: { some: {} } } },
  { key: 'promotionPlan', label: 'Started a promotion plan', where: { inWorkPromotionPlan: { isNot: null } } },
  { key: 'learning', label: 'Earned a learning badge', where: { learningBadges: { some: {} } } },
] as const satisfies readonly { key: string; label: string; where: Prisma.CandidateProfileWhereInput }[]

export type GrowthMeasureKey = (typeof GROWTH_MEASURES)[number]['key']

export type GrowthRow = { key: GrowthMeasureKey | 'active'; label: string; count: number | null; pct: number | null }

const MIN_CELL = 10
const ROUND_BELOW = 50

function round(value: number, population: number): number {
  return population < ROUND_BELOW ? Math.round(value / 5) * 5 : value
}

// Applies the same rules as the rest of the employer portal: a cohort under
// 10 shows nothing, under 50 rounds to the nearest 5.
export function growthRows(population: number, counts: Partial<Record<GrowthRow['key'], number>>, labels: Record<string, string>): GrowthRow[] {
  return Object.entries(counts).map(([key, n]) => {
    const suppressed = population < MIN_CELL
    return {
      key: key as GrowthRow['key'],
      label: labels[key] ?? key,
      count: suppressed ? null : round(n ?? 0, population),
      pct: suppressed || population === 0 ? null : round(Math.round(((n ?? 0) / population) * 100), population),
    }
  })
}
