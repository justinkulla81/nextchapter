import 'server-only'
import type { CompArrangement, RoleProfileType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { mapEmployerCompanySizeStringToBand } from '@/lib/scoring/level-rank'
import { candidateWantsRole } from '@/lib/talent/candidate-discovery'

// The reverse of getCandidatesLookingForYourRoles (candidate-discovery.ts) —
// "candidate -> matching roles" instead of "role -> matching candidates."
// Lower than STRONG_FIT_THRESHOLD (job-fit-bucket.ts, used for the
// fit-check-and-email trigger in notify-strong-fit-candidates.ts) —
// showing any real positive match in a dedicated section a candidate
// chose to visit is reasonable even below the bar that's worth emailing
// someone about unprompted.
export const MATCH_DISPLAY_THRESHOLD = 50

export interface MatchedRole {
  id: string
  roleTitle: string
  companyName: string
  description: string | null
  type: RoleProfileType
  compArrangement: CompArrangement
  compMin: number | null
  compMax: number | null
  score: number
}

const CANDIDATE_MATCH_SELECT = {
  recruiterDatabaseOptIn: true,
  primaryFunction: true,
  secondaryFunction: true,
  targetFunction: true,
  targetRoleType: true,
  highestLevelReached: true,
  levelRankScore: true,
  isPeopleManager: true,
  remotePreference: true,
  currentCity: true,
  currentState: true,
  openToRelocation: true,
  targetCompMin: true,
  compFlexible: true,
  priorityMaxComp: true,
  priorityWorkLife: true,
} as const

export async function getMatchedRolesForCandidate(
  candidateId: string,
  types: RoleProfileType[],
  limit = 10
): Promise<MatchedRole[]> {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: CANDIDATE_MATCH_SELECT,
  })
  // Opted out of the marketplace entirely — the same flag that already
  // gates employer-side visibility into this candidate, so opting out of
  // being found also means opting out of being shown matches.
  if (!candidate || !candidate.recruiterDatabaseOptIn) return []

  const roles = await prisma.roleProfile.findMany({
    where: { isActive: true, isSampleData: false, type: { in: types } },
    select: {
      id: true,
      roleTitle: true,
      description: true,
      type: true,
      compArrangement: true,
      compMin: true,
      compMax: true,
      primaryFunction: true,
      roleLevel: true,
      remotePolicy: true,
      locationRequirement: true,
      employer: { select: { companyName: true, companySize: true } },
    },
  })
  if (roles.length === 0) return []

  const wanted = roles.filter((role) => candidateWantsRole(candidate, role))

  return wanted
    .map((role) => ({
      role,
      match: computeMatchScore(candidate, {
        ...role,
        employerCompanySizeBand: mapEmployerCompanySizeStringToBand(role.employer.companySize),
      }),
    }))
    .filter(({ match }) => match.score >= MATCH_DISPLAY_THRESHOLD)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit)
    .map(({ role, match }) => ({
      id: role.id,
      roleTitle: role.roleTitle,
      companyName: role.employer.companyName,
      description: role.description,
      type: role.type,
      compArrangement: role.compArrangement,
      compMin: role.compMin,
      compMax: role.compMax,
      score: match.score,
    }))
}
