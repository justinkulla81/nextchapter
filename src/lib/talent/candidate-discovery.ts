import 'server-only'
import type { CandidateProfile, RoleProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeMatchScore, type MatchResult } from '@/lib/matching/compute-match-score'
import { mapEmployerCompanySizeStringToBand } from '@/lib/scoring/level-rank'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'
import { titlesShareRoleFamily } from '@/lib/constants/role-family-keywords'

type ActiveRole = Pick<
  RoleProfile,
  'id' | 'roleTitle' | 'primaryFunction' | 'roleLevel' | 'locationRequirement' | 'remotePolicy' | 'compMin' | 'compMax'
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
// elsewhere in the codebase.
function candidateWantsRole(
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
  // Dossier not yet unlocked — CandidateCard renders this row as an
  // anonymized teaser (name withheld, no Save/Compare) instead of full
  // detail. Real matches, not filtered out — see CandidateCard's `locked` prop.
  locked: boolean
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
      select: { id: true, roleTitle: true, primaryFunction: true, roleLevel: true, locationRequirement: true, remotePolicy: true, compMin: true, compMax: true },
    }),
  ])
  if (roles.length === 0) return []
  const employerCompanySizeBand = mapEmployerCompanySizeStringToBand(employer?.companySize ?? null)

  // Already resolved for this employer — no point resurfacing them here.
  const resolved = await prisma.candidateInteraction.findMany({
    where: { employerId, status: { in: ['HIRED', 'PASSED'] } },
    select: { candidateId: true },
  })

  const candidatesRaw = await prisma.candidateProfile.findMany({
    where: {
      recruiterDatabaseOptIn: true,
      privacyTier: { in: ['PUBLIC', 'SEMI_PUBLIC', 'PRIVATE'] },
      assessmentComplete: true,
      isSampleData: false,
      id: { notIn: resolved.map((r) => r.candidateId) },
    },
    select: CANDIDATE_SELECT,
    take: 300,
  })

  const intentMatched = candidatesRaw.filter((c) => roles.some((r) => candidateWantsRole(c, r)))
  if (intentMatched.length === 0) return []

  // Same "opted-in candidates are a small pool" precedent as the per-role
  // Match Inbox — live isDossierUnlocked() per row is fine here. Locked
  // candidates stay in the list (as teasers) rather than being filtered
  // out — see MatchedCandidate.locked.
  const unlockStatuses = await Promise.all(intentMatched.map((c) => isDossierUnlocked(c.id)))
  const lockedById = new Map(intentMatched.map((c, i) => [c.id, !unlockStatuses[i].unlocked]))

  const scored: MatchedCandidate[] = intentMatched.map((candidate) => {
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
      locked: lockedById.get(candidate.id) ?? false,
    }
  })

  // Unlocked candidates rank first regardless of raw match score — this is
  // a small preview widget (default limit 8), and a full-detail match is
  // worth more here than a higher-scoring teaser the employer can't act on
  // as directly yet.
  return scored
    .sort((a, b) => Number(a.locked) - Number(b.locked) || b.match.score - a.match.score)
    .slice(0, limit)
}
