// A seat an organization pays for starts a journey. Outplacement seats start
// Laid off. Career growth seats (current employees whose company sponsors their
// development) start one of the journeys for people who are staying or moving
// up. Pure and client-safe; the write lives in src/lib/employer.

import type { JourneyStage, JourneyType } from '@prisma/client'
import { getJourney } from './journey'

export const SPONSORED_JOURNEYS: { key: JourneyType; label: string; hint: string }[] = [
  { key: 'LAID_OFF', label: 'Outplacement', hint: 'People who are leaving. Starts Laid off, applying.' },
  { key: 'GROWING', label: 'Managing their career', hint: 'Career growth for people who are staying.' },
  { key: 'PROMOTION', label: 'Going for a promotion', hint: 'A promotion-track cohort.' },
  { key: 'CAREER_CHANGE', label: 'Changing careers', hint: 'Internal mobility or a move into a new field.' },
]

export function isSponsoredJourney(j: unknown): j is JourneyType {
  return SPONSORED_JOURNEYS.some((s) => s.key === j)
}

export type SponsoredStart = { journey: JourneyType; stage: JourneyStage; onlyIfNotSearching: boolean }

// What a seat does to the member's journey. Outplacement always applies (the job
// ended). A career growth seat never overrides someone who is in a job search:
// it only sets the journey for a member with none, or one who is not looking.
export function sponsoredStart(contractJourney: JourneyType | null | undefined): SponsoredStart {
  if (!contractJourney || contractJourney === 'LAID_OFF') return { journey: 'LAID_OFF', stage: 'APPLYING', onlyIfNotSearching: false }
  return { journey: contractJourney, stage: getJourney(contractJourney).defaultStage, onlyIfNotSearching: true }
}

export function shouldApplySponsoredStart(start: SponsoredStart, current: JourneyType | null, currentStage: JourneyStage | null): boolean {
  if (!start.onlyIfNotSearching) return true
  if (!current) return true
  if (current === start.journey) return false
  // Searching journeys keep their journey; people who are staying take the sponsor's.
  return !getJourney(current).searching || currentStage === 'STAYING'
}
