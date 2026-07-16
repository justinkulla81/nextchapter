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

function levelDistance(a: string | null, b: string | null): number {
  if (!a || !b) return 2
  const levels = HIGHEST_LEVEL_OPTIONS as readonly string[]
  const ia = levels.indexOf(a)
  const ib = levels.indexOf(b)
  if (ia === -1 || ib === -1) return 2
  return Math.abs(ia - ib)
}

export function computeMatchScore(
  candidate: Pick<
    CandidateProfile,
    'primaryFunction' | 'highestLevelReached' | 'remotePreference' | 'currentCity' | 'openToRelocation' | 'targetCompMin' | 'compFlexible'
  >,
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
  } else {
    score += 5
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
