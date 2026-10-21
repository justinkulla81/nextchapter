// How hard someone is looking is a second question, separate from how close
// they are to applying. Two people can both be Applying: one needs a role as
// soon as they can, the other is doing fractional or interim work and is open
// to the right thing. They get the same tools but a different pace: lighter
// plans, slower gates, fewer nudges, and no points pressure. Pure and
// client-safe. The setting is CandidateProfile.searchIntensity.

import type { SearchIntensity } from '@prisma/client'
import type { JourneyStage, JourneyType } from '@prisma/client'
import type { ApplyTiming } from './journey'

export const INTENSITY_OPTIONS = [
  { key: 'ACTIVELY_SEARCHING', label: 'Actively looking', hint: 'I want a new role as soon as I can.' },
  { key: 'CASUALLY_LOOKING', label: 'Casually looking', hint: "I'm open to the right opportunity and not in a hurry." },
] as const satisfies readonly { key: SearchIntensity; label: string; hint: string }[]

// Employed members already said when they want to start applying; that answer
// is also how hard they are looking.
export function intensityFromTiming(t: ApplyTiming): SearchIntensity {
  switch (t) {
    case 'now':
      return 'ACTIVELY_SEARCHING'
    case '1_3_months':
      return 'CASUALLY_LOOKING'
    default:
      return 'EXPLORING'
  }
}

export function isCasualIntensity(i: SearchIntensity | string | null | undefined): boolean {
  return i === 'CASUALLY_LOOKING' || i === 'EXPLORING' || i === 'OPEN'
}

// Optional "I'm earning from fractional, interim or part-time work right now",
// kept in journeyDetails.workingNow. It tells us the member has income, so the
// runway is less urgent, and that Work now tools are already in play.
export function workingNowOf(details: unknown): boolean {
  return (details as { workingNow?: unknown } | null)?.workingNow === true
}

// Journeys that are not a job search, and the stage for people not looking right
// now. Members here get a light pace and no progress-push emails whatever their
// "search intensity" says (it is not asked of them, so it is empty).
export const NOT_SEARCHING_JOURNEYS: readonly JourneyType[] = ['GROWING', 'ENTREPRENEUR', 'FRACTIONAL', 'TIME_OFF']

export function isNotSearching(journey: JourneyType | null | undefined, stage: JourneyStage | null | undefined): boolean {
  return (!!journey && NOT_SEARCHING_JOURNEYS.includes(journey)) || stage === 'STAYING' || stage === 'PAUSED'
}

// Prisma filter for the emails that push on weekly progress (daily action,
// midweek check-in, Friday gap nudge): members looking casually, or not looking
// at all, are not sent them. They still get the Monday plan, the Saturday
// check-in and job alerts. Members with no setting yet (everyone from before)
// still get everything.
export const NOT_CASUAL_WHERE = {
  AND: [
    { OR: [{ searchIntensity: null }, { searchIntensity: 'ACTIVELY_SEARCHING' as const }] },
    { OR: [{ journey: null }, { journey: { notIn: [...NOT_SEARCHING_JOURNEYS] } }] },
    { OR: [{ journeyStage: null }, { journeyStage: { notIn: ['STAYING' as const, 'PAUSED' as const] } }] },
  ],
}
