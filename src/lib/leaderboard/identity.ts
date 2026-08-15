import 'server-only'
import { generateCommunityHandle, anonymize } from '@/lib/community/identity'

// PART FOUR §15 — the three leaderboard display modes. Reuses Community's
// exact deterministic handle generator (same candidateId always produces the
// same handle) and its first-name+last-initial anonymize() helper — no new
// identity math, just a leaderboard-specific switch over the same building
// blocks, since leaderboards have one mode (NOT_LISTED) Community doesn't.
//
// Never called for a candidate who isn't both leaderboardOptIn AND has a
// non-null leaderboardDisplayMode — callers (queries.ts) only ever pass
// candidates who already cleared that gate, so there's no "no mode chosen
// yet" branch to handle here.
export interface LeaderboardIdentitySource {
  id: string
  firstName: string | null
  lastName: string | null
  leaderboardDisplayMode: 'FIRST_NAME_LAST_INITIAL' | 'GENERATED_HANDLE' | 'NOT_LISTED'
}

export function resolveLeaderboardIdentity(candidate: LeaderboardIdentitySource): string | null {
  switch (candidate.leaderboardDisplayMode) {
    case 'FIRST_NAME_LAST_INITIAL':
      return anonymize(candidate.firstName, candidate.lastName) ?? 'A member'
    case 'GENERATED_HANDLE':
      return generateCommunityHandle(candidate.id)
    case 'NOT_LISTED':
      return null
  }
}
