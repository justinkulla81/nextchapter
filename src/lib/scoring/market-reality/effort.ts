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
export const SPRINT_STREAK_WEEKS = 4 // matches the §7.2 "4 consecutive Sprints" Dossier gate — same streak, same cap
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

// Exported so other callers needing this exact streak definition (e.g. the
// §7.2 "4 consecutive Weekly Search Sprints" Dossier-complete gate in
// dossier-unlock.ts) share one implementation rather than growing a fourth
// divergent streak computation alongside milestone-badges.ts's
// computeOverDeliveringStreak and market-reality-history.ts's
// computeSprintCompletionStreaks. This one requires consecutive
// weekStartDates with no gap and a >=30%-completion-ratio bar per week —
// deliberately different from both of those (see their own comments).
export async function computeCurrentSprintStreak(candidateId: string, maxWeeks: number = SPRINT_STREAK_WEEKS): Promise<number> {
  const recentSprints = await prisma.weeklySprint.findMany({
    where: { candidateId },
    orderBy: { weekStartDate: 'desc' },
    take: maxWeeks,
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
  return streak
}

async function computeSprintConsistencyLeg(candidateId: string): Promise<{ score: number; driver: string }> {
  const streak = await computeCurrentSprintStreak(candidateId)
  const score = clamp((streak / SPRINT_STREAK_WEEKS) * 100)
  const driver =
    streak === 0
      ? 'No active Weekly Search Sprint streak right now.'
      : `${streak} consecutive week${streak === 1 ? '' : 's'} of real Sprint activity.`
  return { score, driver }
}

// Distinguishes "never done any of this, ever" (null — no signal yet) from
// "was active, has since gone quiet" (a real, low score — legitimate
// feedback). Deliberately unwindowed (all-time counts), unlike the legs
// above which score only the last ACTIVITY_WINDOW_DAYS — a candidate who
// networked hard in week 1 and stopped shouldn't read as "no signal."
async function hasAnyEffortSignalEver(candidateId: string): Promise<boolean> {
  const [contactCount, outreachCount, applicationCount, sprintCount, interimCount] = await Promise.all([
    prisma.supportNetworkContact.count({ where: { candidateId, removedAt: null } }),
    prisma.outreachLog.count({ where: { candidateId } }),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }),
    prisma.weeklySprint.count({ where: { candidateId } }),
    prisma.workHistoryEntry.count({ where: { candidateId, engagementType: { in: ['FRACTIONAL', 'INTERIM', 'CONSULTING'] } } }),
  ])
  return contactCount > 0 || outreachCount > 0 || applicationCount > 0 || sprintCount > 0 || interimCount > 0
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

  const [everActed, network, applications, sprintConsistency, interimWork] = await Promise.all([
    hasAnyEffortSignalEver(candidateId),
    computeNetworkActivityLeg(candidateId, windowStart),
    computeApplicationsLeg(candidateId, windowStart),
    computeSprintConsistencyLeg(candidateId),
    computeInterimWorkBonus(candidateId),
  ])

  // Null, not 0 — same §3.6 contract as evidence.ts. A candidate who has
  // never logged outreach, never applied, never run a Sprint, and never done
  // interim work has generated no Effort signal at all yet; scoring that as
  // a 0 would grade them on the absence of work they haven't had reason to
  // do, not on real search behavior.
  if (!everActed) {
    return {
      score: null,
      drivers: ['No search activity logged yet — this fills in as you network, apply, and run Weekly Search Sprints.'],
    }
  }

  const score = clamp(0.4 * network.score + 0.3 * applications.score + 0.3 * sprintConsistency.score + interimWork.bonus)

  const drivers = [network.driver, applications.driver, sprintConsistency.driver]
  if (interimWork.driver) drivers.push(interimWork.driver)

  return { score, drivers }
}
