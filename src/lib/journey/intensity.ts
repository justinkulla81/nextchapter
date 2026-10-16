// How hard someone is looking is a second question, separate from how close
// they are to applying. Two people can both be Applying: one needs a role as
// soon as they can, the other is doing fractional or interim work and is open
// to the right thing. They get the same tools but a different pace: lighter
// plans, slower gates, fewer nudges, and no points pressure. Pure and
// client-safe. The setting is CandidateProfile.searchIntensity.

import type { SearchIntensity } from '@prisma/client'
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

// Prisma filter for the emails that push on weekly progress (daily action,
// midweek check-in, Friday gap nudge): members looking casually are not sent
// them. They still get the Monday plan, the Saturday check-in and job alerts.
// Members with no setting yet (everyone from before) still get everything.
export const NOT_CASUAL_WHERE = { OR: [{ searchIntensity: null }, { searchIntensity: 'ACTIVELY_SEARCHING' as const }] }
