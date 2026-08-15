import 'server-only'
import { createHash } from 'crypto'

// Deterministic, stable per-candidate handle — same candidateId always
// produces the same handle (so it doesn't reset on every render) but
// carries zero real-identity information, unlike anonymize() below which
// derives from the real name. This is the "generated handle" spec §4.2
// requires for Confidential Search Mode members in Community: "Generated
// handle only; name mode unavailable."
const HANDLE_ADJECTIVES = [
  'Steady',
  'Quiet',
  'Bright',
  'Focused',
  'Resilient',
  'Patient',
  'Sharp',
  'Calm',
  'Diligent',
  'Resourceful',
  'Determined',
  'Grounded',
  'Deliberate',
  'Thoughtful',
  'Tenacious',
  'Measured',
] as const
const HANDLE_NOUNS = [
  'Navigator',
  'Builder',
  'Strategist',
  'Architect',
  'Voyager',
  'Analyst',
  'Pathfinder',
  'Operator',
  'Advisor',
  'Catalyst',
  'Pioneer',
  'Craftsman',
  'Scout',
  'Anchor',
  'Compass',
  'Signal',
] as const

export function generateCommunityHandle(candidateId: string): string {
  const hash = createHash('sha256').update(candidateId).digest()
  const adjective = HANDLE_ADJECTIVES[hash.readUInt16BE(0) % HANDLE_ADJECTIVES.length]
  const noun = HANDLE_NOUNS[hash.readUInt16BE(2) % HANDLE_NOUNS.length]
  const suffix = hash.readUInt16BE(4) % 1000
  return `${adjective}${noun}${suffix}`
}

// First name + last initial — the pre-existing "anonymization," derived
// from the real name. Still used for non-confidential candidates (kept
// exactly as before — this file just centralizes it alongside the new
// handle logic so both paths live in one place).
export function anonymize(firstName: string | null, lastName: string | null): string | null {
  if (!firstName) return null
  return `${firstName} ${lastName ? `${lastName[0]}.` : ''}`.trim()
}

export interface CommunityIdentitySource {
  id: string
  firstName: string | null
  lastName: string | null
  profilePictureUrl: string | null
  confidentialSearchMode: boolean
}

// The single choke point every Community render path goes through to
// decide what to show for a participant. Confidential Search Mode
// candidates always render under their generated handle with no photo,
// regardless of privacyTier or which surface is rendering them — this is
// what makes "participation stays available, identity-display doesn't"
// actually hold across every render path instead of needing to be
// re-implemented (and potentially forgotten) at each call site.
export function resolveCommunityIdentity(candidate: CommunityIdentitySource): {
  displayName: string | null
  avatarUrl: string | null
} {
  if (candidate.confidentialSearchMode) {
    return { displayName: generateCommunityHandle(candidate.id), avatarUrl: null }
  }
  return { displayName: anonymize(candidate.firstName, candidate.lastName), avatarUrl: candidate.profilePictureUrl }
}
