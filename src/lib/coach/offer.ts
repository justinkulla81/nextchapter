// When we offer a coach, and the reason we say. Rules only, no model calls, and nothing is invented: every
// reason comes from a fact about this member that the card names. Pure: src/test/coach-offer.test.ts.
//
// The offer is Home's one note (src/lib/redesign/home-note.ts), so it never stacks with another card. Of the
// reasons that apply we show the strongest, in the order below. Any answer ("Not now", or opening the coach
// page) quiets the offer for 30 days, which also covers every other reason.

import type { JourneyStage } from '@/lib/journey/journey'
import { ACTIVE_SEARCH_STAGES } from '@/lib/journey/journey'

export type CoachOfferReason = 'senior' | 'pivot' | 'small_pool' | 'networking' | 'long_search' | 'not_doing_the_work'

/** Strongest first. */
export const COACH_OFFER_ORDER: readonly CoachOfferReason[] = ['senior', 'pivot', 'small_pool', 'networking', 'long_search', 'not_doing_the_work']

export const COACH_OFFER_SNOOZE_DAYS = 30
export const LONG_SEARCH_DAYS = 60
export const QUIET_WORK_DAYS = 14
export const QUIET_OUTREACH_DAYS = 30

export interface CoachOfferFacts {
  hasCoach: boolean
  stage: JourneyStage | null
  /** VP, C-level or equivalent: seniorMember() in ./seniority.ts. */
  senior: boolean
  /** Looking outside their home function, industry or place: a target function, or a widened search. */
  pivoting: boolean
  /** Fewer advertised roles fit than is workable for their level (market prompt 'too_few'). */
  smallPool: boolean
  /** Said networking is uncomfortable. */
  networkingBlocker: boolean
  /** Days since they started searching in an active stage; null when not searching. */
  daysSearching: number | null
  applicationsLast14: number
  outreachLast14: number
  outreachLast30: number
}

export interface CoachOfferState {
  /** ISO time the offer is quiet until. */
  snoozedUntil?: string | null
}

export function coachOfferReasons(f: CoachOfferFacts): CoachOfferReason[] {
  if (f.hasCoach) return []
  const searching = f.stage !== null && ACTIVE_SEARCH_STAGES.includes(f.stage)
  const out: CoachOfferReason[] = []
  if (f.senior) out.push('senior')
  if (f.pivoting) out.push('pivot')
  if (f.smallPool) out.push('small_pool')
  // Said so, or the activity shows it: a month in with not one outreach logged.
  if (f.networkingBlocker || (searching && (f.daysSearching ?? 0) >= QUIET_OUTREACH_DAYS && f.outreachLast30 === 0)) out.push('networking')
  if (searching && (f.daysSearching ?? 0) >= LONG_SEARCH_DAYS) out.push('long_search')
  if (searching && (f.daysSearching ?? 0) >= QUIET_WORK_DAYS && f.applicationsLast14 + f.outreachLast14 === 0) out.push('not_doing_the_work')
  return COACH_OFFER_ORDER.filter((r) => out.includes(r))
}

export function coachOfferQuiet(state: CoachOfferState, now = new Date()): boolean {
  const until = state.snoozedUntil ? new Date(state.snoozedUntil).getTime() : NaN
  return Number.isFinite(until) && until > now.getTime()
}

/** The reason to show today, or null: no reason applies, they have a coach, or the offer is quiet. */
export function pickCoachOffer(f: CoachOfferFacts, state: CoachOfferState = {}, now = new Date()): CoachOfferReason | null {
  if (coachOfferQuiet(state, now)) return null
  return coachOfferReasons(f)[0] ?? null
}

export interface CoachOfferCopy {
  title: string
  why: string
  whyDetail: string
}

/** Words for each reason: what to do, and why, in plain terms. Confident, because people know this and need to hear it. */
export const COACH_OFFER_COPY: Record<CoachOfferReason, CoachOfferCopy> = {
  senior: {
    title: 'At your level, a coach changes what comes your way',
    why: 'There are few roles at the top of any field, and most are filled by people who already know you. A coach builds your visibility, your recruiter relationships and the story the right people hear, and does it while you are still in your job.',
    whyDetail: 'You see this because your level means a small number of roles and a search that runs on relationships.',
  },
  pivot: {
    title: 'A move into a new field is where a coach pays off most',
    why: 'You are looking outside your home field or place. That is exactly where the market will not make the case for you. A coach helps you close the skills gap and tell the story so the people hiring see the fit.',
    whyDetail: 'You see this because your search now includes roles outside your usual function, industry or place.',
  },
  small_pool: {
    title: 'Few roles fit you, so every conversation counts',
    why: 'Only a small number of advertised roles fit your level and place, and one or two rejections can stall a search that small. A coach gets you into the unadvertised ones.',
    whyDetail: 'You see this because the count of advertised roles that fit you is low for your level.',
  },
  networking: {
    title: 'Networking is the step that gets people hired, and the one most people stall on',
    why: 'Most jobs come through people. A coach role-plays the ask with you and makes your first introductions happen, so it stops feeling like a cold call.',
    whyDetail: 'You see this because you said networking is uncomfortable, or you have not logged any outreach in a month of searching.',
  },
  long_search: {
    title: 'You have been searching for over two months',
    why: 'A search this long needs a second pair of eyes. A coach finds what is actually blocking it, whether that is your story, your targets or who you are reaching.',
    whyDetail: 'You see this because you have been in an active search for more than 60 days.',
  },
  not_doing_the_work: {
    title: 'Let someone hold the pace with you',
    why: 'No applications or outreach in two weeks usually means something is in the way. A coach helps you find it and gives you a person to answer to.',
    whyDetail: 'You see this because nothing has been logged for the last 14 days of an active search.',
  },
}

/** Where "Talk to a coach" goes. */
export const COACH_OFFER_HREF = '/dashboard/coaching-match'
