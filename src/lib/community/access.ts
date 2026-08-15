import 'server-only'
import { computeMilestoneBadges } from '@/lib/badges/milestone-badges'

// Master Build Script §14: "Gate: any qualifying badge (§7.8 — Connected
// does not qualify)." CONNECTED never appears in MilestoneBadgeKey at all
// (see milestone-badges.ts's own header comment), so "any qualifying badge"
// is exactly "any of computeMilestoneBadges' 16 keys earned" — no separate
// allowlist to maintain here.
export async function hasQualifyingCommunityBadge(candidateId: string): Promise<boolean> {
  const badges = await computeMilestoneBadges(candidateId)
  return badges.some((b) => b.earned)
}

// Community access requires BOTH a qualifying badge (the real "you've done
// real work" gate the spec calls for) AND being visible in some form —
// either a Public/Semi-Public privacy tier, OR Confidential Search Mode.
//
// These used to be the same check (privacyTier alone), which conflated two
// different questions: "is this candidate allowed to act" (participation)
// vs. "is this candidate allowed to be identified by their real name"
// (identity display). A Confidential Search Mode candidate deliberately
// carries a non-public privacyTier for safety reasons unrelated to
// Community readiness — under the old check they could never post at all.
// Per spec §4.2, they must still be able to post/react/participate, just
// always under a generated handle with no employer/title/location, on
// every render surface (see src/lib/community/identity.ts's
// resolveCommunityIdentity, the single place that identity substitution
// happens). A candidate who is neither Public/Semi-Public NOR in
// Confidential Search Mode (e.g. still LOCKED/PRIVATE/STEALTH while
// deciding) still can't post under a name no one else can resolve, so that
// half of the gate is unchanged.
export async function canParticipateInCommunity(
  candidateId: string,
  privacyTier: string,
  confidentialSearchMode: boolean
): Promise<boolean> {
  const visibleSomehow = privacyTier === 'PUBLIC' || privacyTier === 'SEMI_PUBLIC' || confidentialSearchMode
  if (!visibleSomehow) return false
  return hasQualifyingCommunityBadge(candidateId)
}
