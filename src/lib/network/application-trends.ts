import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { resolveCompanyIndustry } from '@/lib/market/company-industry'

// Same "don't guess until there's real signal" gate as generateJobPattern
// (job-discovery.ts) — with fewer than this many actual applications, any
// consistency/volume read would be noise, not a pattern.
export const MIN_APPLICATIONS_FOR_TRENDS = 5

// Trailing window used to compute an applications-per-week rate. If the
// candidate's earliest application is more recent than this, the window
// shrinks to their actual history instead of diluting the rate with weeks
// before they'd applied to anything.
const VOLUME_WINDOW_DAYS = 28

// Fallback "healthy" range used only when the candidate hasn't set a
// personal weekly target (CandidateProfile.applicationVolumeGoal) — a
// commonly cited range for an active search, not a precise claim.
const DEFAULT_HEALTHY_MIN_PER_WEEK = 3
const DEFAULT_HEALTHY_MAX_PER_WEEK = 10

export type FocusLabel = 'focused' | 'mixed' | 'scattered'
export type VolumeAssessment = 'too_few' | 'on_track' | 'too_many'

export interface TrendBreakdownEntry {
  label: string
  count: number
}

export interface ApplicationTrendsResult {
  eligible: boolean
  minRequired: number
  totalApplications: number

  functionBreakdown: TrendBreakdownEntry[] | null
  functionFocus: FocusLabel | null

  industryBreakdown: TrendBreakdownEntry[] | null
  industryFocus: FocusLabel | null

  // Only populated for postings analyzed after location extraction shipped
  // (JobPosting.location) — so this can legitimately stay null for a
  // candidate whose applications predate it, or who never ran a fit check.
  geographyBreakdown: TrendBreakdownEntry[] | null
  geographyFocus: FocusLabel | null

  applicationsPerWeek: number | null
  volumeGoalPerWeek: number | null
  volumeAssessment: VolumeAssessment | null
}

function emptyResult(totalApplications: number): ApplicationTrendsResult {
  return {
    eligible: false,
    minRequired: MIN_APPLICATIONS_FOR_TRENDS,
    totalApplications,
    functionBreakdown: null,
    functionFocus: null,
    industryBreakdown: null,
    industryFocus: null,
    geographyBreakdown: null,
    geographyFocus: null,
    applicationsPerWeek: null,
    volumeGoalPerWeek: null,
    volumeAssessment: null,
  }
}

// 1 distinct value across all applications reads as deliberately focused; 2
// as a reasonable, still-explainable mix; 3+ as scattered. A simple,
// transparent threshold rather than a scored/weighted metric — easy for a
// candidate or coach to sanity-check against the raw breakdown right next
// to it.
function focusFromDistinctCount(distinct: number): FocusLabel {
  if (distinct <= 1) return 'focused'
  if (distinct === 2) return 'mixed'
  return 'scattered'
}

function buildBreakdown(values: (string | null)[]): { breakdown: TrendBreakdownEntry[]; distinct: number } | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  const breakdown = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
  return { breakdown, distinct: counts.size }
}

// Computes whether a candidate's applications read as focused or scattered
// across job function, industry, and geography, plus whether their pace is
// too slow, healthy, or spray-and-pray — surfaced in both the Market
// Reality Report and Coaching Notes (both read this from the persisted
// MarketRealityReport.jobSearchPattern JSON rather than recomputing live, so
// the one new metered cost here — resolveCompanyIndustry's LLM call for a
// genuinely new company — only ever fires at report-(re)generation time,
// never on a page view).
export async function computeApplicationTrends(candidateId: string): Promise<ApplicationTrendsResult> {
  const [postings, candidate] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { candidateId, appliedAt: { not: null } },
      select: { title: true, companyName: true, location: true, appliedAt: true },
    }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { applicationVolumeGoal: true },
    }),
  ])

  const totalApplications = postings.length
  if (totalApplications < MIN_APPLICATIONS_FOR_TRENDS) return emptyResult(totalApplications)

  const functionResult = buildBreakdown(postings.map((p) => (p.title ? inferFunctionFromTitle(p.title) : null)))

  const uniqueCompanyNames = Array.from(
    new Set(postings.map((p) => p.companyName).filter((name): name is string => !!name))
  )
  const industryLookups = await Promise.all(
    uniqueCompanyNames.map(async (name) => [name, (await resolveCompanyIndustry(name)).bucket] as const)
  )
  const industryByCompany = new Map(industryLookups)
  const industryResult = buildBreakdown(
    postings.map((p) => (p.companyName ? industryByCompany.get(p.companyName) ?? null : null))
  )

  const geographyResult = buildBreakdown(postings.map((p) => p.location))

  const now = new Date()
  const windowStart = new Date(now.getTime() - VOLUME_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const earliestApplied = postings.reduce<Date | null>((earliest, p) => {
    if (!p.appliedAt) return earliest
    return !earliest || p.appliedAt < earliest ? p.appliedAt : earliest
  }, null)
  const rateWindowStart = earliestApplied && earliestApplied > windowStart ? earliestApplied : windowStart
  const daysInWindow = Math.max(1, (now.getTime() - rateWindowStart.getTime()) / (24 * 60 * 60 * 1000))
  const applicationsInWindow = postings.filter((p) => p.appliedAt && p.appliedAt >= rateWindowStart).length
  const applicationsPerWeek = Math.round((applicationsInWindow / daysInWindow) * 7 * 10) / 10

  const volumeGoalPerWeek = candidate.applicationVolumeGoal
  let volumeAssessment: VolumeAssessment
  if (volumeGoalPerWeek) {
    if (applicationsPerWeek < volumeGoalPerWeek * 0.5) volumeAssessment = 'too_few'
    else if (applicationsPerWeek > volumeGoalPerWeek * 2) volumeAssessment = 'too_many'
    else volumeAssessment = 'on_track'
  } else if (applicationsPerWeek < DEFAULT_HEALTHY_MIN_PER_WEEK) {
    volumeAssessment = 'too_few'
  } else if (applicationsPerWeek > DEFAULT_HEALTHY_MAX_PER_WEEK) {
    volumeAssessment = 'too_many'
  } else {
    volumeAssessment = 'on_track'
  }

  return {
    eligible: true,
    minRequired: MIN_APPLICATIONS_FOR_TRENDS,
    totalApplications,
    functionBreakdown: functionResult?.breakdown ?? null,
    functionFocus: functionResult ? focusFromDistinctCount(functionResult.distinct) : null,
    industryBreakdown: industryResult?.breakdown ?? null,
    industryFocus: industryResult ? focusFromDistinctCount(industryResult.distinct) : null,
    geographyBreakdown: geographyResult?.breakdown ?? null,
    geographyFocus: geographyResult ? focusFromDistinctCount(geographyResult.distinct) : null,
    applicationsPerWeek,
    volumeGoalPerWeek,
    volumeAssessment,
  }
}
