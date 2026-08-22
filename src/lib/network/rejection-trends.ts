import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { resolveCompanySizeBand } from '@/lib/market/company-size'
import { resolveCompanyIndustry } from '@/lib/market/company-industry'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import type { TrendBreakdownEntry } from '@/lib/network/application-trends'

// Same "don't guess until there's real signal" gate as application-trends.ts
// and job-discovery.ts's generateJobPattern — with fewer than this many
// actual rejections, any company-type/level pattern would be noise.
export const MIN_REJECTIONS_FOR_PATTERN = 5

export type LevelFitLabel = 'stretch' | 'match' | 'step_down'

export interface RejectionTrendsResult {
  eligible: boolean
  minRequired: number
  totalRejections: number

  companySizeBreakdown: TrendBreakdownEntry[] | null
  industryBreakdown: TrendBreakdownEntry[] | null
  functionBreakdown: TrendBreakdownEntry[] | null

  // Of the rejections where the role's level could be inferred: how many
  // were a reach above the candidate's own calibrated level, a level-for-
  // level match, or a step down. A concentration in "stretch" reads very
  // differently from a concentration in "match."
  levelFitBreakdown: TrendBreakdownEntry[] | null
}

function emptyResult(totalRejections: number): RejectionTrendsResult {
  return {
    eligible: false,
    minRequired: MIN_REJECTIONS_FOR_PATTERN,
    totalRejections,
    companySizeBreakdown: null,
    industryBreakdown: null,
    functionBreakdown: null,
    levelFitBreakdown: null,
  }
}

function buildBreakdown(values: (string | null)[]): TrendBreakdownEntry[] | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

const LEVEL_FIT_LABEL: Record<LevelFitLabel, string> = {
  stretch: 'A reach above your level',
  match: 'A level-for-level match',
  step_down: 'A step down from your level',
}

// Computed only at Market Reality Report (re)generation time — never on a
// live page render — same reasoning as computeApplicationTrends: the one
// new metered cost, resolveCompanySizeBand/resolveCompanyIndustry's LLM
// classification, only ever fires for a company name never seen platform-
// wide before, is deferred via after(), and is cached forever once seen.
export async function computeRejectionTrends(candidateId: string): Promise<RejectionTrendsResult> {
  const [rejectedJobs, levelRank] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { candidateId, declinedAt: { not: null } },
      select: { title: true, companyName: true },
    }),
    getCandidateLevelRank(candidateId),
  ])

  const totalRejections = rejectedJobs.length
  if (totalRejections < MIN_REJECTIONS_FOR_PATTERN) return emptyResult(totalRejections)

  const functionBreakdown = buildBreakdown(rejectedJobs.map((j) => (j.title ? inferFunctionFromTitle(j.title) : null)))

  const uniqueCompanyNames = Array.from(
    new Set(rejectedJobs.map((j) => j.companyName).filter((name): name is string => !!name))
  )
  const [sizeLookups, industryLookups] = await Promise.all([
    Promise.all(uniqueCompanyNames.map(async (name) => [name, (await resolveCompanySizeBand(name)).band] as const)),
    Promise.all(uniqueCompanyNames.map(async (name) => [name, (await resolveCompanyIndustry(name)).bucket] as const)),
  ])
  const sizeByCompany = new Map(sizeLookups)
  const industryByCompany = new Map(industryLookups)

  const companySizeBreakdown = buildBreakdown(
    rejectedJobs.map((j) => (j.companyName ? (sizeByCompany.get(j.companyName) ?? null) : null))
  )
  const industryBreakdown = buildBreakdown(
    rejectedJobs.map((j) => (j.companyName ? (industryByCompany.get(j.companyName) ?? null) : null))
  )

  let levelFitBreakdown: TrendBreakdownEntry[] | null = null
  if (levelRank.score !== null) {
    const levelFits = rejectedJobs
      .map((j): LevelFitLabel | null => {
        if (!j.title) return null
        const roleScore = calibratedLevelRank(inferLevelFromTitle(j.title), null)
        if (roleScore === null) return null
        if (roleScore > levelRank.score!) return 'stretch'
        if (roleScore < levelRank.score!) return 'step_down'
        return 'match'
      })
      .filter((f): f is LevelFitLabel => f !== null)
    levelFitBreakdown = buildBreakdown(levelFits.map((f) => LEVEL_FIT_LABEL[f]))
  }

  return {
    eligible: true,
    minRequired: MIN_REJECTIONS_FOR_PATTERN,
    totalRejections,
    companySizeBreakdown,
    industryBreakdown,
    functionBreakdown,
    levelFitBreakdown,
  }
}
