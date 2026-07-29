import 'server-only'
import type { CandidateProfile, RoleProfile } from '@prisma/client'
import { scoreToGrade, GRADE_LABEL, type Grade } from '@/lib/scoring/grade'
import { HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'

// P0-only heuristic — deterministic overlap across function/level/location/comp.
// This is NOT the real Hireability/Employability score and must never be fed
// one — see the note on `scoreToGrade` usage below. A real "Match Graph" (P1)
// would weigh many more signals; this is a reasonable first cut.
export interface MatchResult {
  score: number // 0-100
  grade: Grade
  label: string
}

export function levelDistance(a: string | null, b: string | null): number {
  if (!a || !b) return 2
  const levels = HIGHEST_LEVEL_OPTIONS as readonly string[]
  const ia = levels.indexOf(a)
  const ib = levels.indexOf(b)
  if (ia === -1 || ib === -1) return 2
  return Math.abs(ia - ib)
}

// Levels a role posting at this seniority genuinely requires having managed
// people, as opposed to an IC track that just carries a senior-sounding
// title. Kept here (not in onboarding constants) since it's a matching-only
// judgment call, not a real taxonomy fact.
const MANAGEMENT_LEVELS = new Set(['Manager', 'Director', 'VP', 'C-Suite'])

export function computeMatchScore(
  candidate: Pick<
    CandidateProfile,
    'primaryFunction' | 'highestLevelReached' | 'remotePreference' | 'currentCity' | 'openToRelocation' | 'targetCompMin' | 'compFlexible'
  > & {
    // Optional so existing narrower selects elsewhere keep compiling —
    // absent/null simply means the bonus below doesn't apply, never a
    // penalty.
    isPeopleManager?: boolean | null
    currentState?: string | null
  },
  role: Pick<RoleProfile, 'primaryFunction' | 'roleLevel' | 'remotePolicy' | 'locationRequirement' | 'compMin' | 'compMax'>
): MatchResult {
  let score = 0

  // Function match — largest single weight (40 pts)
  if (role.primaryFunction && candidate.primaryFunction === role.primaryFunction) {
    score += 40
  } else if (!role.primaryFunction) {
    score += 20 // role didn't specify — neutral credit rather than penalizing
  }

  // Level match — exact match full credit, adjacent partial (25 pts)
  const dist = levelDistance(candidate.highestLevelReached, role.roleLevel)
  score += dist === 0 ? 25 : dist === 1 ? 15 : dist === 2 ? 5 : 0

  // Location/remote fit (20 pts)
  if (role.remotePolicy === 'remote' || candidate.remotePreference === 'remote' || candidate.remotePreference === 'flexible') {
    score += 20
  } else if (candidate.openToRelocation) {
    score += 15
  } else if (
    role.locationRequirement &&
    candidate.currentCity &&
    role.locationRequirement.toLowerCase().includes(candidate.currentCity.toLowerCase())
  ) {
    score += 20
  } else if (
    role.locationRequirement &&
    candidate.currentState &&
    role.locationRequirement.toLowerCase().includes(candidate.currentState.toLowerCase())
  ) {
    // A state/region match without an exact city hit (e.g. posting says
    // "Austin, TX" and the candidate is in Dallas) is still meaningfully
    // closer than no location signal at all — worth more than the bare
    // insufficient-data floor, less than an exact city match.
    score += 12
  } else {
    score += 5
  }

  // Real people-management experience, when the role's level actually calls
  // for it (bonus, not its own weighted category — a refinement of the
  // level match above, not an independent signal). Never penalizes a
  // candidate with no management history; it just doesn't add the bonus.
  if (role.roleLevel && MANAGEMENT_LEVELS.has(role.roleLevel) && candidate.isPeopleManager) {
    score += 10
  }

  // Comp overlap (15 pts) — loosened if candidate is comp-flexible
  if (candidate.targetCompMin == null || role.compMax == null) {
    score += 8 // insufficient data — neutral credit
  } else if (role.compMax >= candidate.targetCompMin) {
    score += 15
  } else if (candidate.compFlexible) {
    score += 10
  } else {
    score += 0
  }

  const clamped = Math.max(0, Math.min(100, score))
  const grade = scoreToGrade(clamped)
  return { score: clamped, grade, label: GRADE_LABEL[grade] }
}
