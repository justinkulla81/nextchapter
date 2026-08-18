import 'server-only'
import type { CompanySizeBand } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'

// Statuses that represent the employer actually engaging with a candidate —
// VIEWED/SAVED are lower-touch browsing, not a real signal worth comparing
// against the posted role. Deliberately not called "applicants": no
// candidate-initiated apply flow exists in this codebase, so this compares
// candidates the employer chose to engage with, honestly labeled as such.
const ENGAGED_STATUSES = ['INTEREST_EXPRESSED', 'CANDIDATE_REVEALED', 'IN_CONVERSATION', 'HIRED'] as const

export interface RoleComparison {
  engagedCount: number
  sameFunctionCount: number
  differentFunctionCount: number
  levelHigherCount: number
  levelSameCount: number
  levelLowerCount: number
  avgCandidateTargetComp: number | null
  compAboveRoleMaxCount: number
  wantsRemoteCount: number
}

// How the candidates this employer has actually engaged with, for one
// posted role, differ from what the role asks for — function, level, comp,
// and remote preference. Returns null when there's no engagement yet
// (nothing to compare).
export async function getEngagedCandidateComparison(
  role: { id: string; primaryFunction: string | null; roleLevel: string | null; compMax: number | null },
  employerCompanySizeBand: CompanySizeBand | null
): Promise<RoleComparison | null> {
  const interactions = await prisma.candidateInteraction.findMany({
    where: { roleId: role.id, status: { in: [...ENGAGED_STATUSES] } },
    select: {
      candidate: {
        select: {
          primaryFunction: true,
          levelRankScore: true,
          highestLevelReached: true,
          targetCompMin: true,
          remotePreference: true,
        },
      },
    },
  })
  if (interactions.length === 0) return null

  const roleLevelScore = calibratedLevelRank(role.roleLevel, employerCompanySizeBand)

  let sameFunctionCount = 0
  let differentFunctionCount = 0
  let levelHigherCount = 0
  let levelSameCount = 0
  let levelLowerCount = 0
  let compSum = 0
  let compCount = 0
  let compAboveRoleMaxCount = 0
  let wantsRemoteCount = 0

  for (const { candidate: c } of interactions) {
    if (role.primaryFunction) {
      if (c.primaryFunction === role.primaryFunction) sameFunctionCount++
      else differentFunctionCount++
    }

    const candidateScore = c.levelRankScore ?? calibratedLevelRank(c.highestLevelReached, null)
    // Null on either side means insufficient data — same convention as
    // calibratedLevelDistance's "insufficient data" fallback — skip rather
    // than let JS's null-to-0 coercion silently miscategorize the candidate.
    if (roleLevelScore !== null && candidateScore !== null) {
      if (candidateScore > roleLevelScore) levelHigherCount++
      else if (candidateScore < roleLevelScore) levelLowerCount++
      else levelSameCount++
    }

    if (c.targetCompMin != null) {
      compSum += c.targetCompMin
      compCount++
      if (role.compMax != null && c.targetCompMin > role.compMax) compAboveRoleMaxCount++
    }

    if (c.remotePreference === 'remote' || c.remotePreference === 'flexible') wantsRemoteCount++
  }

  return {
    engagedCount: interactions.length,
    sameFunctionCount,
    differentFunctionCount,
    levelHigherCount,
    levelSameCount,
    levelLowerCount,
    avgCandidateTargetComp: compCount > 0 ? Math.round(compSum / compCount) : null,
    compAboveRoleMaxCount,
    wantsRemoteCount,
  }
}
