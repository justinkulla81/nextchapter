import { prisma } from '@/lib/prisma'
import { isSearchGoalsComplete, isBlockersAndMotivationsComplete } from '@/lib/search-strategy'
import { isLinkedInConnected } from '@/lib/dashboard/linkedin-connection'

export type HardGateStatus = 'exempt' | 'search_strategy_required' | 'activation_required' | 'unlocked'

// The candidate-facing Search Strategy page's own two required sections
// (Target Role & Company, Blockers and Motivations) — same bar Victoria's
// guidance is already gated on, reused here rather than inventing a
// separate completeness bar.
export function isSearchStrategyGateComplete(
  profile: Parameters<typeof isSearchGoalsComplete>[0] & Parameters<typeof isBlockersAndMotivationsComplete>[0]
): boolean {
  return isSearchGoalsComplete(profile) && isBlockersAndMotivationsComplete(profile)
}

// Real Gmail connection state — a live DB check (not a profile field) since
// EmailConnection is its own table and can be disconnected independently of
// any candidate-level flag.
export async function isGmailConnected(candidateId: string): Promise<boolean> {
  const connection = await prisma.emailConnection.findFirst({
    where: { candidateId, disconnectedAt: null },
    select: { id: true },
  })
  return !!connection
}

// The dashboard-wide hard gate: Gmail + LinkedIn ("activation") required
// first, then Search Strategy, to unlock the rest of the dashboard as a
// Search Plan. Activation comes first so Search Strategy — which asks
// what's gotten in the way, comp expectations, etc. — happens once we
// already have a real, connected account, not as a cold first question.
// Only ever applies to candidates created after this shipped — see
// subjectToHardGate's own comment in schema.prisma. Existing candidates get
// 'exempt' unconditionally and are never newly locked out.
export function getHardGateStatus(profile: {
  subjectToHardGate: boolean
  targetRoleType: string | null
  primaryFunction: string | null
  targetIndustries: string[]
  targetCompanySize: string | null
  targetCompanyStage: string | null
  remotePreference: string | null
  highestLevelReached: string | null
  blockers: string[]
  motivations: string[]
  coachingStylePreference: Parameters<typeof isBlockersAndMotivationsComplete>[0]['coachingStylePreference']
  changePacePreference: Parameters<typeof isBlockersAndMotivationsComplete>[0]['changePacePreference']
  changeReadiness: Parameters<typeof isBlockersAndMotivationsComplete>[0]['changeReadiness']
  linkedinConnectionsImportedAt: Date | null
  linkedInConnection?: { disconnectedAt: Date | null } | null
}, gmailConnected: boolean): HardGateStatus {
  if (!profile.subjectToHardGate) return 'exempt'
  if (!gmailConnected || !isLinkedInConnected(profile)) return 'activation_required'
  if (!isSearchStrategyGateComplete(profile)) return 'search_strategy_required'
  return 'unlocked'
}

// Moved to gate-exempt-paths.ts (pure, no prisma import) — re-exported here
// so existing importers of this module keep working. The actual exemption
// DECISION now happens client-side (see HardGateGate.tsx) rather than via
// this same function called server-side against a middleware-forwarded
// x-pathname header, which turned out not to reliably reach this layout in
// production — a subjectToHardGate candidate could see the gate on a page
// that was supposed to be exempt (e.g. /dashboard/search-strategy itself),
// with no way to ever clear it.
export { isGateExemptPath, GATE_EXEMPT_PATH_PREFIXES } from './gate-exempt-paths'
