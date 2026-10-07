// Platform milestones are stored as MilestoneBadge rows with a
// "PLATFORM:<platformKey>:<milestone>" key, so they ride the existing
// badge pipeline: the "New badge!" popup (getPendingBadgeNotices), the
// badge-earned email, and the admin candidate view. Pure — no DB.

import { getPlatform, type PlatformKind } from './directory'
import { stageRank, type PlatformStageKey } from './stages'

export type PlatformMilestone = 'FIRST_STEP' | 'ACCEPTED' | 'FIRST_PROJECT' | 'FIRST_PAYOUT' | 'COMPLETED'

const PREFIX = 'PLATFORM:'

export function platformBadgeKey(platformKey: string, milestone: PlatformMilestone): string {
  return `${PREFIX}${platformKey}:${milestone}`
}

export function parsePlatformBadgeKey(badgeKey: string): { platformKey: string; milestone: PlatformMilestone } | null {
  if (!badgeKey.startsWith(PREFIX)) return null
  const rest = badgeKey.slice(PREFIX.length)
  const i = rest.lastIndexOf(':')
  if (i <= 0) return null
  return { platformKey: rest.slice(0, i), milestone: rest.slice(i + 1) as PlatformMilestone }
}

/** Every milestone a platform at this stage has reached (a payout implies acceptance). */
export function milestonesForStage(kind: PlatformKind, stage: PlatformStageKey): PlatformMilestone[] {
  const out: PlatformMilestone[] = ['FIRST_STEP']
  const rank = stageRank(kind, stage)
  if (kind === 'WORK') {
    if (rank >= stageRank('WORK', 'ACCEPTED')) out.push('ACCEPTED')
    if (rank >= stageRank('WORK', 'WORKING')) out.push('FIRST_PROJECT')
    if (rank >= stageRank('WORK', 'EARNING')) out.push('FIRST_PAYOUT')
  } else if (stage === 'COMPLETED') {
    out.push('COMPLETED')
  }
  return out
}

export function platformBadgeLabel(badgeKey: string): string | null {
  const parsed = parsePlatformBadgeKey(badgeKey)
  if (!parsed) return null
  const name = getPlatform(parsed.platformKey)?.name ?? parsed.platformKey
  const kind = getPlatform(parsed.platformKey)?.kind ?? 'WORK'
  switch (parsed.milestone) {
    case 'FIRST_STEP':
      return kind === 'WORK' ? `Signed up on ${name}` : `Started on ${name}`
    case 'ACCEPTED':
      return `Accepted on ${name}`
    case 'FIRST_PROJECT':
      return `First project on ${name}`
    case 'FIRST_PAYOUT':
      return `First payout from ${name}`
    case 'COMPLETED':
      return `Completed on ${name}`
  }
}

export function platformBadgeDescription(badgeKey: string): string {
  const parsed = parsePlatformBadgeKey(badgeKey)
  if (!parsed) return ''
  switch (parsed.milestone) {
    case 'FIRST_STEP':
      return getPlatform(parsed.platformKey)?.kind === 'LEARNING'
        ? 'You took the first step. Finishing is what shows up in your Executive Dossier.'
        : 'You took the first step. Most platforms vet before they match, so finish their assessment.'
    case 'ACCEPTED':
      return 'You passed their vetting. The next milestone is your first project.'
    case 'FIRST_PROJECT':
      return 'You landed real work. That counts as income and as recent experience.'
    case 'FIRST_PAYOUT':
      return 'You got paid. Bridge income buys you time to hold out for the right role.'
    case 'COMPLETED':
      return 'You finished. It now shows in your Executive Dossier.'
  }
}
