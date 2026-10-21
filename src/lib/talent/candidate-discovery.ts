import 'server-only'
import type { CandidateProfile, RoleProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeMatchScore, type MatchResult } from '@/lib/matching/compute-match-score'
import { mapEmployerCompanySizeStringToBand } from '@/lib/scoring/level-rank'
import { loadVisibilityMany } from '@/lib/evidence/load'
import { compareByEvidenceThenFit } from '@/lib/evidence/score'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'
import { titlesShareRoleFamily } from '@/lib/constants/role-family-keywords'
import { getBlockedCandidateIdsForEmployer } from '@/lib/talent/conflict-check'

type ActiveRole = Pick<
  RoleProfile,
  | 'id'
  | 'roleTitle'
  | 'primaryFunction'
  | 'roleLevel'
  | 'locationRequirement'
  | 'remotePolicy'
  | 'compMin'
  | 'compMax'
  | 'type'
  | 'description'
  | 'compArrangement'
>

const CANDIDATE_SELECT = {
  id: true,
  privacyTier: true,
  firstName: true,
  lastName: true,
  highestLevelReached: true,
  primaryFunction: true,
  currentCity: true,
  remotePreference: true,
  openToRelocation: true,
  targetCompMin: true,
  compFlexible: true,
  levelRankScore: true,
  priorityMaxComp: true,
  priorityWorkLife: true,
  targetFunction: true,
  targetRoleType: true,
  _count: { select: { learningBadges: true, outreachLogs: true } },
  jobPostings: { select: { appliedAt: true } },
} as const

// "Directly looking for" = the candidate's stated target, not just an
// overlapping background — targetFunction/targetRoleType (aspirational, Part
// 4 Goals) rather than primaryFunction (resume-derived history), which
// compute-match-score.ts already covers on its own. Bidirectional substring
// match on title, same convention as matchesCertification/industry matching
// elsewhere in the codebase. Exported for reuse by
// src/lib/matching/candidate-role-matches.ts, the reverse-direction
// (candidate → roles) matcher.
export function candidateWantsRole(
  candidate: Pick<CandidateProfile, 'targetFunction' | 'targetRoleType'>,
  role: Pick<RoleProfile, 'primaryFunction' | 'roleTitle'>
): boolean {
  if (role.primaryFunction && candidate.targetFunction === role.primaryFunction) return true
  const targetRoleType = candidate.targetRoleType?.toLowerCase()
  if (!targetRoleType) return false
  const roleTitle = role.roleTitle.toLowerCase()
  if (roleTitle.includes(targetRoleType) || targetRoleType.includes(roleTitle)) return true
  // Title text alone misses functionally-related roles that share no words
  // (e.g. "Corporate Development VP" wanting "Investment Partner" openings)
  // — see role-family-keywords.ts.
  return titlesShareRoleFamily(targetRoleType, roleTitle)
}

export interface MatchedCandidate {
  candidate: Awaited<ReturnType<typeof prisma.candidateProfile.findMany<{ select: typeof CANDIDATE_SELECT }>>>[number]
  match: MatchResult
  roleId: string
  roleTitle: string
  effortSummary: string
  // Candidate+ Verified (Candidate+ plus at least one piece of evidence) and
  // the evidence score — Verified members rank first, with an Evidence badge.
  evidence: { verified: boolean; score: number }
}

// Candidates whose stated target overlaps with ANY of this employer's active
// roles, ranked by their best-matching role — the cross-role "candidates
// looking for roles like yours" view (as opposed to Match Inbox, which is
// scoped to one role's title at a time).
export async function getCandidatesLookingForYourRoles(employerId: string, limit = 8): Promise<MatchedCandidate[]> {
  const [employer, roles] = await Promise.all([
    prisma.employerProfile.findUnique({ where: { id: employerId }, select: { companySize: true } }),
    prisma.roleProfile.findMany({
      where: { employerId, isActive: true },
      select: {
        id: true,
        roleTitle: true,
        primaryFunction: true,
        roleLevel: true,
        locationRequirement: true,
        remotePolicy: true,
        compMin: true,
        compMax: true,
        type: true,
        description: true,
        compArrangement: true,
      },
    }),
  ])
  if (roles.length === 0) return []
  const employerCompanySizeBand = mapEmployerCompanySizeStringToBand(employer?.companySize ?? null)

  // Already resolved for this employer — no point resurfacing them here.
  // Also exclude any candidate this employer has an active (uncleared)
  // conflict-of-interest flag against — HiringConflictFlag, ported from the
  // retired Hiring Manager portal's §A8/§E3.5 conflict rule (see
  // src/lib/talent/conflict-check.ts) and re-keyed to EmployerProfile as
  // part of the /hiring -> /talent consolidation. This is genuinely new
  // enforcement for Talent — no equivalent filter existed here before.
  const [resolved, blockedCandidateIds] = await Promise.all([
    prisma.candidateInteraction.findMany({
      where: { employerId, status: { in: ['HIRED', 'PASSED'] } },
      select: { candidateId: true },
    }),
    getBlockedCandidateIdsForEmployer(employerId),
  ])

  const candidatesRaw = await prisma.candidateProfile.findMany({
    where: {
      recruiterDatabaseOptIn: true,
      // Confidential search is a hard rule: never shown outside NextChapter.
      confidentialSearchMode: false,
      privacyTier: { in: ['PUBLIC', 'SEMI_PUBLIC', 'PRIVATE'] },
      assessmentComplete: true,
      isSampleData: false,
      id: { notIn: [...resolved.map((r) => r.candidateId), ...blockedCandidateIds] },
    },
    select: CANDIDATE_SELECT,
    take: 300,
  })

  const intentMatched = candidatesRaw.filter((c) => roles.some((r) => candidateWantsRole(c, r)))
  if (intentMatched.length === 0) return []

  // Candidate+ is the only gate (Justin, 2026-10-16): free members are never
  // shown to employers. Same "opted-in candidates are a small pool" precedent
  // as the per-role Match Inbox — a live Candidate+ check per row is fine here.
  const visibility = await loadVisibilityMany(intentMatched.map((c) => c.id))
  const visible = intentMatched.filter((c) => visibility.get(c.id)?.candidatePlus)

  const scored: MatchedCandidate[] = visible.map((candidate) => {
    const best = roles
      .filter((r) => candidateWantsRole(candidate, r))
      .map((role) => ({ role, match: computeMatchScore(candidate, { ...role, employerCompanySizeBand }) }))
      .sort((a, b) => b.match.score - a.match.score)[0] as { role: ActiveRole; match: MatchResult }

    const effortSummary = computeEffortSummaryLines({
      learningCount: candidate._count.learningBadges,
      applicationsCount: candidate.jobPostings.filter((j) => j.appliedAt !== null).length,
      outreachCount: candidate._count.outreachLogs,
    })
      .map((line) => line.replace(/\.$/, ''))
      .join(', ')

    return {
      candidate,
      match: best.match,
      roleId: best.role.id,
      roleTitle: best.role.roleTitle,
      effortSummary,
      evidence: { verified: visibility.get(candidate.id)!.verified, score: visibility.get(candidate.id)!.score },
    }
  })

  return scored
    .sort((a, b) =>
      compareByEvidenceThenFit(
        { verified: a.evidence.verified, evidenceScore: a.evidence.score, fit: a.match.score },
        { verified: b.evidence.verified, evidenceScore: b.evidence.score, fit: b.match.score }
      )
    )
    .slice(0, limit)
}
