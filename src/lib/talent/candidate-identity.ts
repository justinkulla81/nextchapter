import type { CandidateProfile } from '@prisma/client'

// Shared by CandidateCard (client) and the employer market-digest email
// (server) — no 'server-only' import here since a client component needs
// it too.
export function candidateDisplayName(
  candidate: Pick<CandidateProfile, 'privacyTier' | 'firstName' | 'lastName' | 'highestLevelReached' | 'primaryFunction'>,
  // Locked (Dossier not unlocked) candidates stay anonymized regardless of
  // their own privacyTier choice — the teaser is the same for everyone
  // until real evidence/effort is on file, not something a PUBLIC-tier
  // candidate can opt out of by their privacy setting alone.
  locked: boolean
): string {
  if (!locked && candidate.privacyTier === 'PUBLIC' && candidate.firstName) {
    return `${candidate.firstName} ${candidate.lastName?.charAt(0) ?? ''}.`.trim()
  }
  const level = candidate.highestLevelReached ?? 'Experienced'
  const fn = candidate.primaryFunction ?? 'professional'
  return `${level} ${fn} professional`
}
