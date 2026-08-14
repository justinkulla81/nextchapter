import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { computeSkillGap, type RankedSkill } from '@/lib/companies/skills-extraction'

// "Your fit" (Prompt 3) — reuses the existing enriched fit scorer
// (computeBoardListingFitBucket, src/lib/jobs/job-fit-bucket.ts) against
// this company's own currently-open postings, rather than building new
// matching logic. No aggregate "company-level fit" function existed before
// this — this is a thin new wrapper, not a new scoring model.
//
// The spec also asks for "which of their resume versions is the best fit" —
// there's no existing resume-version comparison utility in this codebase to
// reuse (Resume rows aren't scored against a specific employer's postings
// anywhere today), and building one is a real separate feature, not a
// wrapper around existing code. Deliberately not built this pass — the fit
// bucket and skills-gap output below stand alone without it.

const FIT_CANDIDATE_SELECT = {
  primaryFunction: true,
  secondaryFunction: true,
  highestLevelReached: true,
  levelRankScore: true,
  remotePreference: true,
  currentCity: true,
  currentState: true,
  openToRelocation: true,
  targetCompMin: true,
  compFlexible: true,
  targetRoleType: true,
  resumeKeywords: true,
  yearsExperience: true,
  industryContext: true,
  secondaryIndustryContext: true,
  targetIndustries: true,
  hasJD: true,
  hasMD: true,
  hasDO: true,
  targetCompanySize: true,
  priorityMaxComp: true,
  priorityWorkLife: true,
  priorityBrandName: true,
  priorityMission: true,
} as const

// Best-bucket-wins ordering — a candidate should see their strongest real
// match among this company's open roles, not an arbitrary one.
const BUCKET_RANK: Record<FitBucket, number> = {
  strong: 0,
  good: 1,
  overqualified: 2,
  below_level: 3,
  stretch: 4,
}

export interface CompanyFitResult {
  bucket: FitBucket | null // null if the company has no open postings to compare against
  bestPostingTitle: string | null
  matchedSkills: string[]
  missingSkills: string[]
}

export async function computeCompanyFitForCandidate(
  candidateId: string,
  canonicalNameNormalized: string,
  topSkillsRequested: RankedSkill[]
): Promise<CompanyFitResult> {
  const [candidate, openPostings] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: FIT_CANDIDATE_SELECT }),
    prisma.exclusiveJobPosting.findMany({
      where: { archivedAt: null },
      select: {
        title: true,
        description: true,
        targetFunction: true,
        targetLevel: true,
        targetRemotePolicy: true,
        targetLocation: true,
        location: true,
        salaryMin: true,
        salaryMax: true,
        companyName: true,
      },
    }),
  ])

  const { matched, missing } = candidate
    ? computeSkillGap(topSkillsRequested, candidate.resumeKeywords)
    : { matched: [], missing: topSkillsRequested.map((s) => s.term) }

  if (!candidate) {
    return { bucket: null, bestPostingTitle: null, matchedSkills: matched, missingSkills: missing }
  }

  const companyPostings = openPostings.filter((p) => normalizeOrgName(p.companyName) === canonicalNameNormalized)
  if (companyPostings.length === 0) {
    return { bucket: null, bestPostingTitle: null, matchedSkills: matched, missingSkills: missing }
  }

  let best: { bucket: FitBucket; title: string } | null = null
  for (const posting of companyPostings) {
    const bucket = computeBoardListingFitBucket(candidate, posting)
    if (!best || BUCKET_RANK[bucket] < BUCKET_RANK[best.bucket]) {
      best = { bucket, title: posting.title }
    }
  }

  return {
    bucket: best?.bucket ?? null,
    bestPostingTitle: best?.title ?? null,
    matchedSkills: matched,
    missingSkills: missing,
  }
}
