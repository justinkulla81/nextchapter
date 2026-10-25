import 'server-only'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { logCatalogAction } from '@/lib/weekly/sprint'

// Weekly Search Sprint credit for real conference moments. Called only when a status actually changes into the
// credited state, and the Sprint itself pays each action type once a week however often it fires, so flipping a
// status back and forth earns nothing extra. No-ops when the member has no Sprint this week.
export type ConferenceCredit = 'CONFERENCE_REGISTER' | 'CONFERENCE_SUBMISSION' | 'CONFERENCE_TALK' | 'ENGAGE_EVENT' | 'NETWORKING_LIST'

const TEXT: Record<ConferenceCredit, string> = {
  CONFERENCE_REGISTER: 'Registered for a conference',
  CONFERENCE_SUBMISSION: 'Sent a proposal, paper, entry or nomination to a conference',
  CONFERENCE_TALK: 'Delivered a talk at a conference',
  ENGAGE_EVENT: 'Attended a conference',
  NETWORKING_LIST: 'Add new contacts to your networking list',
}

export async function creditConferenceAction(candidateId: string, actionType: ConferenceCredit): Promise<void> {
  const effort = estimateActionEffort({ actionType })
  await logCatalogAction(candidateId, { text: TEXT[actionType], actionType, points: effort.points, estimatedMinutes: effort.minutes, recurring: true })
    .catch((error) => console.error(`Failed to credit ${actionType}:`, error))
}
