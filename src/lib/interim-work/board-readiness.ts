import type { CandidateProfile } from '@prisma/client'

// Prompt 68 section 4 — deliberately NOT a raw title-string match (a "VP"
// title at a small company doesn't mean board-ready, and a title match
// alone would let through candidates this section isn't useful for). Uses
// levelRankScore (see src/lib/scoring/level-rank.ts) — the calibrated
// signal that adjusts the raw title for the size of the company it was
// held at — once available, falling back to the original title +
// years-of-experience heuristic for any candidate whose score hasn't been
// backfilled yet. This is a first-pass heuristic, not a validated
// instrument — revisit once there's real outcome data on who actually
// lands board/advisory seats.
type ProfileForBoardReadiness = Pick<CandidateProfile, 'highestLevelReached' | 'yearsExperience' | 'levelRankScore'>

export function isBoardReady(profile: ProfileForBoardReadiness): boolean {
  const years = profile.yearsExperience ?? 0

  if (profile.levelRankScore == null) {
    switch (profile.highestLevelReached) {
      case 'C-Suite':
        return years >= 10
      case 'VP':
        return years >= 15
      case 'Director':
        return years >= 20
      default:
        return false
    }
  }

  if (profile.levelRankScore >= 85) return years >= 10
  if (profile.levelRankScore >= 70) return years >= 15
  if (profile.levelRankScore >= 55) return years >= 20
  return false
}
