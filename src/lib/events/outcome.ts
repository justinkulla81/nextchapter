import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { signLink } from '@/lib/email/signed-links'
import type { Outcome } from './headsup'

/** One-click links in the check-in email. GET only confirms; POST records (mail scanners open every link). */
export function outcomeUrl(appUrl: string, interestId: string, outcome: Outcome): string {
  return `${appUrl}/api/events/outcome/${interestId}?o=${outcome}&sig=${signLink('conf-outcome', interestId, outcome)}`
}

/**
 * Records how an event went for a member. Going or speaking means we follow the event for them: when next year's
 * dates appear they get a notice. "Did not go" keeps it as a plain save.
 */
export async function applyOutcome(candidateId: string, eventId: string, outcome: Outcome): Promise<boolean> {
  const row = await prisma.conferenceInterest.findUnique({ where: { candidateId_eventId: { candidateId, eventId } } })
  if (!row) return false
  const went = outcome === 'ATTENDED' || outcome === 'SPOKE'
  await prisma.conferenceInterest.update({
    where: { id: row.id },
    data: {
      outcome,
      outcomeAt: new Date(),
      status: went ? 'FOLLOWING' : 'SAVED',
      attendedCount: row.attendedCount + (went ? 1 : 0),
      spokeCount: row.spokeCount + (outcome === 'SPOKE' ? 1 : 0),
    },
  })
  captureServerEvent(candidateId, 'conference_outcome_recorded', { eventId, outcome, attendedCount: row.attendedCount + (went ? 1 : 0), spokeCount: row.spokeCount + (outcome === 'SPOKE' ? 1 : 0) })
  return true
}
