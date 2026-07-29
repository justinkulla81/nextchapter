import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CommittedAction } from '@/lib/weekly/sprint'

// Content/thought-leadership actions from the Marketing Plan page — see
// action-effort.ts's ACTION_TYPE_LINK, all three route there.
const CONTENT_ACTION_TYPES = new Set(['LINKEDIN_POST_IDEA', 'THOUGHT_LEADERSHIP_COMMENT', 'THOUGHT_LEADERSHIP_SHARE'])
const NETWORKING_ACTION_TYPES = new Set(['OUTREACH_MESSAGE', 'OUTREACH_CALL', 'OUTREACH_FOLLOW_UP', 'NETWORKING_LIST'])

const RECENT_SPRINT_WINDOW = 4
// Matches COMFORT_LEVEL_CHOICES in content-venues.ts — 60 is "It's okay",
// 100 is "Yes, I enjoy it". Below that, having done nothing isn't a real
// mismatch, just honest disinterest.
const HIGH_CONTENT_COMFORT_THRESHOLD = 60
// Matches NETWORKING_LEVEL_OPTIONS in CircumstancesForm.tsx — value 2 is
// literally "Some, but I should do more," which is already a self-reported
// gap. Nothing to compute; just read it back.
const NETWORKING_SELF_REPORTED_GAP_VALUE = 2

export type VisibilityGap = 'wants_more_visibility' | null

export interface VisibilityCalibration {
  contentComfortLevel: number | null
  contentActionsCompletedRecently: number
  networkingLevel: number | null
  networkingActionsCompletedRecently: number
  gap: VisibilityGap
  note: string | null
}

// Compares how much a candidate SAYS they like being visible (thought
// leadership content, networking) against what they've actually done
// recently — same "don't fabricate a pattern" restraint as
// detectAvoidancePattern (needs real sprint history) and hasStableTenure
// (needs a real track record either way, not a single data point). Only
// ever fires the gap in the "says yes, does none" direction — the reverse
// (doing a lot while saying they don't like it) isn't a problem worth
// flagging, it's just someone pushing through discomfort productively.
export async function getVisibilityCalibration(candidateId: string): Promise<VisibilityCalibration> {
  const [profile, recentSprints] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { contentComfortLevel: true, networkingLevel: true },
    }),
    prisma.weeklySprint.findMany({
      where: { candidateId },
      orderBy: { weekStartDate: 'desc' },
      take: RECENT_SPRINT_WINDOW,
      select: { committedActions: true },
    }),
  ])

  let contentActionsCompletedRecently = 0
  let networkingActionsCompletedRecently = 0
  for (const sprint of recentSprints) {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    for (const action of actions) {
      if (!action.completed || !action.actionType) continue
      if (CONTENT_ACTION_TYPES.has(action.actionType)) contentActionsCompletedRecently++
      if (NETWORKING_ACTION_TYPES.has(action.actionType)) networkingActionsCompletedRecently++
    }
  }

  const hasEnoughHistory = recentSprints.length >= 2
  const contentGap =
    hasEnoughHistory &&
    (profile.contentComfortLevel ?? 0) >= HIGH_CONTENT_COMFORT_THRESHOLD &&
    contentActionsCompletedRecently === 0
  const networkingGap = profile.networkingLevel === NETWORKING_SELF_REPORTED_GAP_VALUE

  const gap: VisibilityGap = contentGap || networkingGap ? 'wants_more_visibility' : null

  let note: string | null = null
  if (contentGap && networkingGap) {
    note =
      'Says they enjoy putting themselves out there and wants to network more, but neither has shown up in recent weeks — worth talking through what\'s actually in the way.'
  } else if (contentGap) {
    note =
      'Says they enjoy thought-leadership content, but hasn\'t posted, commented, or shared anything in recent weeks — worth checking what\'s blocking it.'
  } else if (networkingGap) {
    note = 'Self-reports doing "some" networking but knows they should do more — a real, named gap worth a plan for.'
  }

  return {
    contentComfortLevel: profile.contentComfortLevel,
    contentActionsCompletedRecently,
    networkingLevel: profile.networkingLevel,
    networkingActionsCompletedRecently,
    gap,
    note,
  }
}
