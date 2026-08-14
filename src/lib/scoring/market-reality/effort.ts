// Your Effort component — Master Build Script §3.1/§18: renamed from
// "Channels" and expanded beyond outreach/network to also cover
// applications, interim/fractional work, and Weekly Search Sprint
// consistency ("ongoing," §3.1's fixability read for this component).
// Voice/Intake Spec §5: above director level, outreach is the dominant
// channel, and the thing that actually moves it is activity, not list
// size — a candidate can have 200 contacts and zero recent outreach.
// Weighted accordingly below.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ComponentComputation } from './types'

const ACTIVITY_WINDOW_DAYS = 30
const SPRINT_STREAK_WEEKS = 4 // matches the §7.2 "4 consecutive Sprints" Dossier gate — same streak, same cap
const SPRINT_COMPLETION_THRESHOLD = 0.3 // a week counts as "active" once ~a third of committed actions are done
const INTERIM_WORK_BONUS = 10

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

interface CommittedAction {
  completed?: boolean
}

async function computeNetworkActivityLeg(candidateId: string, windowStart: Date): Promise<{ score: number; driver: string }> {
  const [contactCount, recentOutreachCount] = await Promise.all([
    prisma.supportNetworkContact.count({ where: { candidateId, removedAt: null } }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: windowStart } } }),
  ])

  // Saturating curves — a candidate doesn't need an enormous network or a
  // daily outreach cadence to score well, just evidence the channel is
  // actually in use. 25 contacts / 8 touches in 30 days is full credit.
  const networkSizeScore = Math.min(100, contactCount * 4)
  const activityScore = Math.min(100, recentOutreachCount * 12.5)
  const score = clamp(0.4 * networkSizeScore + 0.6 * activityScore)

  const driver =
    recentOutreachCount === 0
      ? contactCount > 0
        ? `${contactCount} contacts in the network list, but no outreach logged in the last ${ACTIVITY_WINDOW_DAYS} days.`
        : 'No network contacts and no outreach logged yet.'
      : `${recentOutreachCount} outreach touches in the last ${ACTIVITY_WINDOW_DAYS} days.`

  return { score, driver }
}

async function computeApplicationsLeg(candidateId: string, windowStart: Date): Promise<{ score: number; driver: string }> {
  const applicationCount = await prisma.jobPosting.count({
    where: { candidateId, appliedAt: { gte: windowStart } },
  })
  // 5 applications in 30 days is full credit — a saturating curve, same
  // shape as the network leg, for the same reason: volume past a point
  // doesn't keep mattering.
  const score = Math.min(100, applicationCount * 20)
  const driver =
    applicationCount === 0
      ? `No applications logged in the last ${ACTIVITY_WINDOW_DAYS} days.`
      : `${applicationCount} application${applicationCount === 1 ? '' : 's'} in the last ${ACTIVITY_WINDOW_DAYS} days.`
  return { score, driver }
}

async function computeSprintConsistencyLeg(candidateId: string): Promise<{ score: number; driver: string }> {
  const recentSprints = await prisma.weeklySprint.findMany({
    where: { candidateId },
    orderBy: { weekStartDate: 'desc' },
    take: SPRINT_STREAK_WEEKS,
    select: { weekStartDate: true, committedActions: true },
  })

  let streak = 0
  let expectedWeekStart: number | null = null
  for (const sprint of recentSprints) {
    const weekStartMs = sprint.weekStartDate.getTime()
    if (expectedWeekStart !== null && weekStartMs !== expectedWeekStart) break // gap in the sequence — streak broken
    const actions = (sprint.committedActions as CommittedAction[] | null) ?? []
    const completedRatio = actions.length > 0 ? actions.filter((a) => a.completed).length / actions.length : 0
    if (completedRatio < SPRINT_COMPLETION_THRESHOLD) break
    streak += 1
    expectedWeekStart = weekStartMs - 7 * 24 * 60 * 60 * 1000
  }

  const score = clamp((streak / SPRINT_STREAK_WEEKS) * 100)
  const driver =
    streak === 0
      ? 'No active Weekly Search Sprint streak right now.'
      : `${streak} consecutive week${streak === 1 ? '' : 's'} of real Sprint activity.`
  return { score, driver }
}

async function computeInterimWorkBonus(candidateId: string): Promise<{ bonus: number; driver: string | null }> {
  const activeInterimEngagement = await prisma.workHistoryEntry.findFirst({
    where: { candidateId, isCurrent: true, engagementType: { in: ['FRACTIONAL', 'INTERIM', 'CONSULTING'] } },
    select: { id: true },
  })
  return activeInterimEngagement
    ? { bonus: INTERIM_WORK_BONUS, driver: 'Currently active in interim/fractional work — that counts as real search effort.' }
    : { bonus: 0, driver: null }
}

export async function computeEffortComponent(candidateId: string): Promise<ComponentComputation> {
  const windowStart = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [network, applications, sprintConsistency, interimWork] = await Promise.all([
    computeNetworkActivityLeg(candidateId, windowStart),
    computeApplicationsLeg(candidateId, windowStart),
    computeSprintConsistencyLeg(candidateId),
    computeInterimWorkBonus(candidateId),
  ])

  const score = clamp(0.4 * network.score + 0.3 * applications.score + 0.3 * sprintConsistency.score + interimWork.bonus)

  const drivers = [network.driver, applications.driver, sprintConsistency.driver]
  if (interimWork.driver) drivers.push(interimWork.driver)

  return { score, drivers }
}
