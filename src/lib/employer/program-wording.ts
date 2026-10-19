// How the employer portal talks about a contract. Pure and client-safe. One place so the overview,
// enrollment and sign-up pages agree: outplacement is for people who are leaving, career growth is
// for people who are staying, and in both the employer sees counts, never individuals.

import type { JourneyType } from '@prisma/client'

export type ProgramKind = 'OUTPLACEMENT' | 'GROWTH'

export const programKindOf = (journey: JourneyType | null | undefined): ProgramKind => (!journey || journey === 'LAID_OFF' ? 'OUTPLACEMENT' : 'GROWTH')

export const PROGRAM_KIND_LABEL: Record<ProgramKind, string> = { OUTPLACEMENT: 'Outplacement', GROWTH: 'Career growth' }

export const PROGRAM_KIND_BLURB: Record<ProgramKind, string> = {
  OUTPLACEMENT: 'For people who are leaving: a plan, coaching and a market read, from day one.',
  GROWTH: 'For people who are staying and growing: pay against the market, a case for the next review or promotion, skills to build, and a view of where their career could go.',
}

export const PRIVACY_NOTE =
  'You see anonymous, aggregate numbers across everyone enrolled, and only once a group is large enough that no one can be picked out. What a person writes, plans or explores, including their career story and any time off, stays private to them.'

export function enrollIntro(kinds: ProgramKind[]): string {
  const growth = kinds.includes('GROWTH')
  const out = kinds.includes('OUTPLACEMENT')
  const who = growth && out ? 'Add someone to a contract' : growth ? 'Add someone to your career growth program' : 'Add someone to a contract'
  return `${who}, one at a time or by CSV upload. They get an email with your welcome and the services in their package.${growth ? ' People on a career growth seat keep their own job search: a seat never changes a plan they already have.' : ''}`
}
