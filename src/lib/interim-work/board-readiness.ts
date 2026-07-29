import type { CandidateProfile } from '@prisma/client'

// Prompt 68 section 4 — deliberately NOT a raw title-string match (a "VP"
// title at a small company doesn't mean board-ready, and a title match
// alone would let through candidates this section isn't useful for).
// Uses the actual level + years-of-experience signal already captured at
// onboarding instead. This is a first-pass heuristic, not a validated
// instrument — revisit once there's real outcome data on who actually
// lands board/advisory seats.
type ProfileForBoardReadiness = Pick<CandidateProfile, 'highestLevelReached' | 'yearsExperience'>

export function isBoardReady(profile: ProfileForBoardReadiness): boolean {
  const years = profile.yearsExperience ?? 0
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
