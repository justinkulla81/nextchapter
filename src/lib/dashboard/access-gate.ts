import { prisma } from '@/lib/prisma'
import { isSearchGoalsComplete, isBlockersAndMotivationsComplete } from '@/lib/search-strategy'

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

// The dashboard-wide hard gate: Search Strategy required first, then Gmail
// + LinkedIn ("activation") to unlock the rest of the dashboard as a Search
// Plan. Only ever applies to candidates created after this shipped — see
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
}, gmailConnected: boolean): HardGateStatus {
  if (!profile.subjectToHardGate) return 'exempt'
  if (!isSearchStrategyGateComplete(profile)) return 'search_strategy_required'
  if (!gmailConnected || !profile.linkedinConnectionsImportedAt) return 'activation_required'
  return 'unlocked'
}

// Paths that must stay reachable at every gate stage — the gate's own
// required pages, the pages needed to satisfy it, and account-level actions
// that must never be blocked (settings/logout/support). Prefix-matched
// against the pathname.
const GATE_EXEMPT_PATH_PREFIXES = [
  '/dashboard/search-strategy',
  '/dashboard/skills-assessment', // singular quiz route
  '/dashboard/skills-assessments', // hub route
  '/dashboard/network', // Gmail/Calendar connect prompt + LinkedIn CSV import both live here
  '/dashboard/profile',
  '/dashboard/settings',
  '/dashboard/support',
]

export function isGateExemptPath(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    GATE_EXEMPT_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  )
}
