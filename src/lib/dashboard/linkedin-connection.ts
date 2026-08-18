// Two independent "Connect LinkedIn" flows exist in this codebase:
// `linkedinConnectionsImportedAt` (set only by a Connections.csv upload on
// the Contacts page — the one signal that actually unlocks warm-intro
// "who you already know" networking, since a CSV import is the only way to
// get a candidate's connections list) and `LinkedInConnection` (real
// LinkedIn OAuth, used for the "Post to LinkedIn" feature on the Marketing
// Plan page). A candidate who completes the OAuth flow — the only "Connect
// LinkedIn" button they're likely to have clicked — was being treated as
// "not connected" by every dashboard-wide activation gate (Daily Message
// box, Get Started group, Victoria unlock, the hard gate), even though
// they'd genuinely connected their account. This treats either signal as
// "connected" for those general activation checks. Networking-specific
// gates that need the actual connections list (e.g. dossier-unlock.ts's
// "who you already know") should keep checking `linkedinConnectionsImportedAt`
// directly rather than using this helper.
export function isLinkedInConnected(profile: {
  linkedinConnectionsImportedAt: Date | null
  linkedInConnection?: { disconnectedAt: Date | null } | null
}): boolean {
  return profile.linkedinConnectionsImportedAt !== null || (profile.linkedInConnection != null && profile.linkedInConnection.disconnectedAt === null)
}
