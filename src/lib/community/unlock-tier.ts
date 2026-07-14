import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'

export type UnlockTier = 1 | 2 | 3 | 4 | 5

export const TIER_NAME: Record<UnlockTier, string> = {
  1: 'Getting Started',
  2: 'In Motion',
  3: 'Building Momentum',
  4: 'On Track',
  5: 'Unstoppable',
}

// What each tier unlocks. Several items from the original spec (outreach
// scripts, recruiter list, job surfacing, thought leadership tools,
// fractional portal, coaching access) don't exist as built features yet —
// those gates will apply automatically once those features land in later
// slices. For now this tier only actually gates The Circle.
export const TIER_UNLOCKS: Record<UnlockTier, string> = {
  1: 'Grade report, Success Sprint, resume feedback, coach chat',
  2: 'Nothing new yet — outreach scripts and networking tools unlock here once built',
  3: 'The Circle (read-only)',
  4: 'The Circle (post + send support notes)',
  5: 'A-List eligibility highlight',
}

export interface UnlockTierSignals {
  confirmedCount: number
  totalCompletedSprintActions: number
  checkInCount: number
  referencesCount: number
  referencesCompletedCount: number
  workSamplesCount: number
  linkedInActivityCount: number
  currentStreak: number
  hasCurrentWeekSprint: boolean
}

export function computeUnlockTier(signals: UnlockTierSignals): UnlockTier {
  const totalActions = signals.confirmedCount + signals.totalCompletedSprintActions + signals.checkInCount

  if (
    signals.currentStreak >= 30 &&
    signals.linkedInActivityCount >= 5 &&
    signals.referencesCompletedCount >= 2
  ) {
    return 5
  }
  if (
    totalActions >= 20 &&
    signals.linkedInActivityCount >= 1 &&
    signals.referencesCount >= 3 &&
    signals.hasCurrentWeekSprint
  ) {
    return 4
  }
  if (totalActions >= 10 && signals.referencesCount >= 2 && signals.workSamplesCount >= 1) {
    return 3
  }
  if (totalActions >= 5 && signals.referencesCount >= 1) {
    return 2
  }
  return 1
}

export async function getUnlockTierSignals(candidateId: string): Promise<UnlockTierSignals> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      references: true,
      workSamples: true,
      linkedInActivityLogs: true,
      weeklySprints: true,
      dailyCheckIns: true,
    },
  })

  const confirmations = [
    candidate.profileConfirmedAt,
    candidate.industryConfirmedAt,
    candidate.functionConfirmedAt,
    candidate.salaryConfirmedAt,
    candidate.workAuthConfirmedAt,
    candidate.linkedInConfirmedAt,
    candidate.networkingListSubmittedAt,
    candidate.askedForHelpAt,
  ]
  const confirmedCount = confirmations.filter(Boolean).length

  const totalCompletedSprintActions = candidate.weeklySprints.reduce((sum, sprint) => {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    return sum + actions.filter((a) => a.completed).length
  }, 0)

  const weekStartDate = getMondayOfWeek(new Date())
  const hasCurrentWeekSprint = candidate.weeklySprints.some(
    (s) => s.weekStartDate.getTime() === weekStartDate.getTime()
  )

  return {
    confirmedCount,
    totalCompletedSprintActions,
    checkInCount: candidate.dailyCheckIns.length,
    referencesCount: candidate.references.length,
    referencesCompletedCount: candidate.references.filter((r) => r.status === 'COMPLETED').length,
    workSamplesCount: candidate.workSamples.length,
    linkedInActivityCount: candidate.linkedInActivityLogs.length,
    currentStreak: candidate.currentStreak,
    hasCurrentWeekSprint,
  }
}

export async function computeUnlockTierForCandidate(candidateId: string): Promise<UnlockTier> {
  const signals = await getUnlockTierSignals(candidateId)
  return computeUnlockTier(signals)
}
