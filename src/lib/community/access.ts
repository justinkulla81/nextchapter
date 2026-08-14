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
// real work" gate the spec calls for) AND a Public/Semi-Public privacy tier.
// These are orthogonal: the badge check is about earned participation, the
// privacy tier is about whether this candidate has chosen to be visible to
// others at all (their name/city/function show up on every post and group
// chip). A candidate who hasn't opened up their profile yet still
// shouldn't be posting under a name no one else can see attached to them —
// so privacyTier alone is no longer sufficient (the bug this fixes), but it
// hasn't stopped mattering either.
export async function canParticipateInCommunity(candidateId: string, privacyTier: string): Promise<boolean> {
  if (privacyTier !== 'PUBLIC' && privacyTier !== 'SEMI_PUBLIC') return false
  return hasQualifyingCommunityBadge(candidateId)
}
