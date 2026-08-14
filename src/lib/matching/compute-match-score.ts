import 'server-only'
import type { CandidateProfile, RoleProfile, CompanySizeBand } from '@prisma/client'
import { scoreToGrade, GRADE_LABEL, type Grade } from '@/lib/scoring/grade'
import { HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { calibratedLevelRank, calibratedLevelDistance } from '@/lib/scoring/level-rank'

// P0-only heuristic — deterministic overlap across function/level/location/comp.
// This is NOT the real Market Reality/Employability score and must never be fed
// one — see the note on `scoreToGrade` usage below. A real "Match Graph" (P1)
// would weigh many more signals; this is a reasonable first cut.
export interface MatchResult {
  score: number // 0-100
  grade: Grade
  label: string
}

// Superseded by calibratedLevelDistance (src/lib/scoring/level-rank.ts) for
// any caller with a company-size signal available — that version adjusts
// for the size of the company a title was held at, so e.g. a VP at a
// mega-cap and a C-Suite title at a mid-size company register as an exact
// match instead of a full level apart. Kept here, unused internally, only
// because it's still a harmless plain ordinal distance and nothing outside
// this file/ats-job-board-feed.ts imports it.
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

// Soft per-candidate weighting from the Goals-page tradeoff ranking (1 =
// matters most, 5 = matters least, null = never ranked) — nudges the
// dimension a priority maps to up or down by a bounded amount rather than a
// full reweight, so no single priority can swing a score by more than a few
// points and results stay comparable across the whole candidate pool
// (admin views, recruiter search, etc. all share this same scorer).
export function priorityMultiplier(rank: number | null): number {
  if (rank === 1 || rank === 2) return 1.3
  if (rank === 4 || rank === 5) return 0.7
  return 1
}

export function computeMatchScore(
  candidate: Pick<
    CandidateProfile,
    | 'primaryFunction'
    | 'highestLevelReached'
    | 'remotePreference'
    | 'currentCity'
    | 'openToRelocation'
    | 'targetCompMin'
    | 'compFlexible'
    | 'levelRankScore'
    | 'priorityMaxComp'
    | 'priorityWorkLife'
  > & {
    // Optional so existing narrower selects elsewhere keep compiling —
    // absent/null simply means the bonus below doesn't apply, never a
    // penalty.
    isPeopleManager?: boolean | null
    currentState?: string | null
    secondaryFunction?: string | null
  },
  role: Pick<RoleProfile, 'primaryFunction' | 'roleLevel' | 'remotePolicy' | 'locationRequirement' | 'compMin' | 'compMax'> & {
    // Resolved separately by the caller — RoleProfile callers pass
    // mapEmployerCompanySizeStringToBand(employer.companySize); callers
    // with no company context (the ad hoc recruiter search filter) omit
    // it, which is treated as unknown, i.e. anchor band, no adjustment.
    employerCompanySizeBand?: CompanySizeBand | null
  }
): MatchResult {
  let score = 0

  // Function match — largest single weight (40 pts). A match against the
  // candidate's secondary function (their most recent function, when it
  // differs from their career-long primary) still counts as real signal —
  // just not as strong as a primary match, since it's a narrower slice of
  // their background.
  if (role.primaryFunction && candidate.primaryFunction === role.primaryFunction) {
    score += 40
  } else if (role.primaryFunction && candidate.secondaryFunction === role.primaryFunction) {
    score += 28
  } else if (!role.primaryFunction) {
    score += 20 // role didn't specify — neutral credit rather than penalizing
  }

  // Level match — exact match full credit, adjacent partial (25 pts).
  // Calibrated by company size on both sides where known (see
  // level-rank.ts) — falls back to the candidate's persisted baseline, or
  // an anchor-band-only live compute if that baseline isn't set yet.
  const candidateScore = candidate.levelRankScore ?? calibratedLevelRank(candidate.highestLevelReached, null)
  const roleScore = calibratedLevelRank(role.roleLevel, role.employerCompanySizeBand ?? null)
  const dist = calibratedLevelDistance(candidateScore, roleScore)
  score += dist === 0 ? 25 : dist === 1 ? 15 : dist === 2 ? 5 : 0

  // Location/remote fit (20 pts) — the positive-match branches are scaled
  // by how highly the candidate ranked work-life balance (remote/flexible
  // fit is the closest existing proxy for it); the insufficient-data floor
  // stays flat since there's no signal there to weight.
  const workLifeMultiplier = priorityMultiplier(candidate.priorityWorkLife)
  if (role.remotePolicy === 'remote' || candidate.remotePreference === 'remote' || candidate.remotePreference === 'flexible') {
    score += Math.round(20 * workLifeMultiplier)
  } else if (candidate.openToRelocation) {
    score += Math.round(15 * workLifeMultiplier)
  } else if (
    role.locationRequirement &&
    candidate.currentCity &&
    role.locationRequirement.toLowerCase().includes(candidate.currentCity.toLowerCase())
  ) {
    score += Math.round(20 * workLifeMultiplier)
  } else if (
    role.locationRequirement &&
    candidate.currentState &&
    role.locationRequirement.toLowerCase().includes(candidate.currentState.toLowerCase())
  ) {
    // A state/region match without an exact city hit (e.g. posting says
    // "Austin, TX" and the candidate is in Dallas) is still meaningfully
    // closer than no location signal at all — worth more than the bare
    // insufficient-data floor, less than an exact city match.
    score += Math.round(12 * workLifeMultiplier)
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

  // Comp overlap (15 pts) — loosened if candidate is comp-flexible, and the
  // match branches scaled by how highly the candidate ranked maximizing
  // compensation.
  const compMultiplier = priorityMultiplier(candidate.priorityMaxComp)
  if (candidate.targetCompMin == null || role.compMax == null) {
    score += 8 // insufficient data — neutral credit
  } else if (role.compMax >= candidate.targetCompMin) {
    score += Math.round(15 * compMultiplier)
  } else if (candidate.compFlexible) {
    score += Math.round(10 * compMultiplier)
  } else {
    score += 0
  }

  const clamped = Math.max(0, Math.min(100, score))
  const grade = scoreToGrade(clamped)
  return { score: clamped, grade, label: GRADE_LABEL[grade] }
}
