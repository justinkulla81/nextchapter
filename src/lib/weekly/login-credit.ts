import 'server-only'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { autoCompleteEngagementAction, getCurrentWeekSprint, type CommittedAction } from '@/lib/weekly/sprint'

// The first time a member logs in each week earns a small credit. Showing up is the
// first step of a search, so it counts, but only a little: see LOGIN_VISIT in
// action-effort.ts and the weekly cap on engagement in scoring/effort-actions.ts.
// Once per weekly sprint, however many times they log in. A member with no sprint
// yet gets nothing and nothing is created for them.
export async function creditWeeklyLogin(candidateId: string): Promise<void> {
  const sprint = await getCurrentWeekSprint(candidateId)
  if (!sprint) return

  const actions = sprint.committedActions as unknown as CommittedAction[]
  if (actions.some((a) => a.actionType === 'LOGIN_VISIT' && a.completed)) return

  const effort = estimateActionEffort({ actionType: 'LOGIN_VISIT' })
  await autoCompleteEngagementAction(candidateId, {
    actionType: 'LOGIN_VISIT',
    text: 'Log in and work on your search',
    points: effort.points,
    estimatedMinutes: effort.minutes,
  })
  captureServerEvent(candidateId, 'weekly_login_credited', { points: effort.points })
}
