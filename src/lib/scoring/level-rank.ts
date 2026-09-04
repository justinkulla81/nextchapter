// Pure calibration math for the internal, invisible-to-users "level rank"
// signal — no server-only dependency (mirrors grade.ts's split from
// dossier-competencies.ts), so this is importable from a standalone script
// without pulling in Prisma/the market-data resolver, and independently
// testable. See src/lib/scoring/level-rank-service.ts for the Prisma-backed
// orchestration that blends multiple work-history entries using this math.
//
// The problem this solves: HIGHEST_LEVEL_OPTIONS ('IC'|'Manager'|'Director'
// |'VP'|'C-Suite') treats a title as equally senior regardless of company
// size — a Director at a 10-person company and a Director at Google get
// identical treatment everywhere level currently gets compared
// (compute-match-score.ts, ats-job-board-feed.ts, board-readiness.ts,
// coach/matching.ts). This module produces a single calibrated 1-100 score
// per (level, company size) pair so those comparisons can be apples-to-apples.

import type { CompanySizeBand } from '@prisma/client'

const LEVEL_BASE_SCORE: Record<string, number> = {
  IC: 20,
  Manager: 40,
  Director: 55,
  VP: 70,
  'C-Suite': 85,
}

const BAND_ORDER: CompanySizeBand[] = [
  'MICRO',
  'SMALL',
  'SMALL_MID',
  'MID',
  'MID_LARGE',
  'LARGE',
  'ENTERPRISE',
  'MEGA',
]

// MID (201-1000 employees) is the calibration anchor — the closest existing
// reference point to the "500-1000 person co" example this feature was
// scoped around, and the largest band EmployerProfile.companySize already
// models before this feature's finer 8-band scale existed.
const ANCHOR_BAND_INDEX = BAND_ORDER.indexOf('MID')

// Points shifted per band-position away from the anchor. This is a
// first-pass magnitude increase (was 5), not a precisely fitted curve — the
// proxy is employee-count bands, not real revenue/market-cap, so it can't
// be tuned against actual dollar figures (no revenue data exists anywhere
// in this schema). Tuned steeper so a title's calibrated score reflects
// that the same title means far more at a large company than a small one
// (e.g. a Director at a MEGA-band company should read closer to a VP at
// the anchor band than to a Director at the anchor band).
const BAND_STEP_POINTS = 8

// The modal points-gap between adjacent titles at the anchor band (e.g.
// Manager 40 -> Director 55 is 15) — used to convert a raw score gap back
// into "how many levels apart" units so existing 0/1/2/else consumer
// thresholds (compute-match-score.ts, ats-job-board-feed.ts) keep working
// unchanged against the new continuous scale.
const LEVEL_STEP_POINTS = 15

function clamp1to100(n: number): number {
  return Math.max(1, Math.min(100, Math.round(n)))
}

// level: one of HIGHEST_LEVEL_OPTIONS. companySizeBand: null means "no size
// data available" — treated as the anchor band (zero adjustment), NEVER as
// a penalty or a guess. This is the required fallback for an LLM failure or
// an unrecognized company: the title-based score stands alone.
// scoreNudge: additive, defaults to 0 (a no-op for every existing caller) —
// only resolve-contextual-level.ts's finance-ladder branch ever passes a
// non-zero value, to place Senior Associate/VP between Manager and
// Director without inventing a new HIGHEST_LEVEL_OPTIONS value.
export function calibratedLevelRank(
  level: string | null | undefined,
  companySizeBand: CompanySizeBand | null,
  scoreNudge = 0
): number | null {
  if (!level || !(level in LEVEL_BASE_SCORE)) return null
  const bandIndex = companySizeBand ? BAND_ORDER.indexOf(companySizeBand) : ANCHOR_BAND_INDEX
  return clamp1to100(LEVEL_BASE_SCORE[level] + (bandIndex - ANCHOR_BAND_INDEX) * BAND_STEP_POINTS + scoreNudge)
}

// Converts two calibrated scores into the same "how many levels apart"
// units the old ordinal levelDistance() (compute-match-score.ts) returned
// over its 5 discrete levels (0-4). Null on either side falls back to 2,
// mirroring levelDistance's own "insufficient data" default exactly.
export function calibratedLevelDistance(scoreA: number | null, scoreB: number | null): number {
  if (scoreA === null || scoreB === null) return 2
  return Math.round(Math.abs(scoreA - scoreB) / LEVEL_STEP_POINTS)
}

// Internal/admin debugging label only — never shown to any candidate,
// recruiter, coach, or employer-facing surface.
export function scoreToLevelRankLabel(score: number | null): string | null {
  if (score === null) return null
  if (score >= 85) return 'Tier 6 — Executive/C-Suite equivalent'
  if (score >= 70) return 'Tier 5 — VP equivalent'
  if (score >= 55) return 'Tier 4 — Director equivalent'
  if (score >= 40) return 'Tier 3 — Manager equivalent'
  if (score >= 25) return 'Tier 2 — Senior IC / team-lead equivalent'
  return 'Tier 1 — Junior IC equivalent'
}

// Lossy adapter for RoleProfile's path — EmployerProfile.companySize only
// has 5 coarse bands and tops out at "1000+" (can't distinguish a
// 2,000-person company from Google). "1000+" maps to MID_LARGE, not
// LARGE/ENTERPRISE/MEGA, because this platform's employer-tenants skew
// SMB/growth-stage rather than literal mega-caps — a known, documented
// coarse-graining limitation, not a bug.
export function mapEmployerCompanySizeStringToBand(companySize: string | null | undefined): CompanySizeBand | null {
  switch (companySize) {
    case '1-10':
      return 'MICRO'
    case '11-50':
      return 'SMALL'
    case '51-200':
      return 'SMALL_MID'
    case '201-1000':
      return 'MID'
    case '1000+':
      return 'MID_LARGE'
    default:
      return null
  }
}

// Used by coach/matching.ts — converts a coach's flat HIGHEST_LEVEL_OPTIONS
// seniorityFit array into a calibrated score range (anchor band, since a
// coach's stated fit has no attached company), with a tolerance buffer to
// account for the coarse mapping.
export function coachMatchesSeniority(seniorityFit: string[], candidateScore: number, tolerance = 10): boolean {
  const scores = seniorityFit
    .map((level) => calibratedLevelRank(level, null))
    .filter((s): s is number => s !== null)
  if (scores.length === 0) return false
  return candidateScore >= Math.min(...scores) - tolerance && candidateScore <= Math.max(...scores) + tolerance
}
