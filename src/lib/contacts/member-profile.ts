import 'server-only'

export interface MemberVisibilitySource {
  privacyTier: string
  confidentialSearchMode: boolean
}

// A NextChapter member's profile is only ever public to other members when
// their own Privacy Settings put them at PUBLIC/SEMI_PUBLIC (the same
// PUBLIC/SEMI_PUBLIC pair used everywhere else in the app for "visible to
// fellow candidates" — see VISIBLE_TIERS in community/groups.ts and
// CANDIDATE_VISIBLE_TIERS in network/member-lookup.ts) — this feature
// reuses that existing control rather than adding a second, competing
// visibility toggle. Confidential Search Mode always wins regardless of
// tier: those candidates are excluded entirely, not shown under a masked
// identity — being both findable AND messageable under a fake name doesn't
// serve the point of Confidential mode, unlike the Community feed where
// participation-without-identity is the whole design.
export function isMemberProfilePublic(candidate: MemberVisibilitySource): boolean {
  if (candidate.confidentialSearchMode) return false
  return candidate.privacyTier === 'PUBLIC' || candidate.privacyTier === 'SEMI_PUBLIC'
}

export interface MemberIdentitySource {
  firstName: string | null
  lastName: string | null
  profilePictureUrl: string | null
  privacyTier: string
}

// PrivacyTier's own documented semantics (schema.prisma): PUBLIC = "Full
// name, photo, complete history visible to all"; SEMI_PUBLIC = "First name
// + last initial, company names, role level" — no photo. Only ever called
// after isMemberProfilePublic() has already confirmed the tier is one of
// these two.
export function getMemberDisplayIdentity(candidate: MemberIdentitySource): { displayName: string; showPhoto: boolean } {
  const isFullyPublic = candidate.privacyTier === 'PUBLIC'
  const firstName = candidate.firstName ?? 'A NextChapter member'
  const displayName = isFullyPublic
    ? `${firstName}${candidate.lastName ? ` ${candidate.lastName}` : ''}`.trim()
    : `${firstName}${candidate.lastName ? ` ${candidate.lastName[0]}.` : ''}`.trim()
  return { displayName, showPhoto: isFullyPublic }
}
